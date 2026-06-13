// 存取层：requests / nodes / claims 的读写，行记录与领域对象的映射
import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import type { Chain, ChainNode, Claim } from './chain';
import {
  buildChains,
  childrenByParent,
  indexNodes,
  isTokenInPath,
  rankChains,
  subtreeHasClaim,
  tracePath,
} from './chain';
import { getDb } from './db';

export type Visibility = 'private' | 'public';
export type RewardType = 'paid' | 'friendship';

export interface HelpRequest {
  id: string;
  creatorToken: string;
  title: string;
  description: string;
  visibility: Visibility;
  rewardType: RewardType;
  rewardNote: string | null;
  // 终止条件：达到匹配数量 或 到达截止时间，任一满足即停止；null = 不限
  targetMatchCount: number | null;
  deadlineAt: number | null;
  status: 'open' | 'closed';
  createdAt: number;
}

interface RequestRow {
  id: string;
  creator_token: string;
  title: string;
  description: string;
  visibility: Visibility;
  reward_type: RewardType;
  reward_note: string | null;
  target_match_count: number | null;
  deadline_at: number | null;
  status: 'open' | 'closed';
  created_at: number;
}

// 默认推荐前 N 条供发起人挑选（发起人设了匹配数量则用该数量）
export const DEFAULT_RECOMMEND = 3;

export interface StopState {
  open: boolean;
  // 已停止的原因：达到数量 / 到达截止 / 手动关闭
  reason: 'count' | 'deadline' | 'manual' | null;
}

// 求助是否仍开放：status 为 open、未到截止、认领数未达目标
export function requestStopState(
  request: HelpRequest,
  claimCount: number,
  now: number = Date.now()
): StopState {
  if (request.status !== 'open') return { open: false, reason: 'manual' };
  if (request.deadlineAt !== null && now >= request.deadlineAt) return { open: false, reason: 'deadline' };
  if (request.targetMatchCount !== null && claimCount >= request.targetMatchCount) {
    return { open: false, reason: 'count' };
  }
  return { open: true, reason: null };
}

// 推荐数量：发起人设的匹配数量优先，否则默认 3
function recommendCount(request: HelpRequest): number {
  return request.targetMatchCount ?? DEFAULT_RECOMMEND;
}

interface NodeRow {
  id: string;
  request_id: string;
  parent_node_id: string | null;
  visitor_token: string;
  nickname: string;
  contact: string | null;
  relation_strength: number | null;
  forward_note: string | null;
  created_at: number;
}

interface ClaimRow {
  id: string;
  node_id: string;
  contact: string;
  message: string | null;
  created_at: number;
}

function toRequest(row: RequestRow): HelpRequest {
  return {
    id: row.id,
    creatorToken: row.creator_token,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    rewardType: row.reward_type,
    rewardNote: row.reward_note,
    targetMatchCount: row.target_match_count,
    deadlineAt: row.deadline_at,
    status: row.status,
    createdAt: row.created_at,
  };
}

function toNode(row: NodeRow): ChainNode {
  return {
    id: row.id,
    requestId: row.request_id,
    parentNodeId: row.parent_node_id,
    visitorToken: row.visitor_token,
    nickname: row.nickname,
    relationStrength: row.relation_strength,
    forwardNote: row.forward_note,
    contact: row.contact,
    createdAt: row.created_at,
  };
}

function toClaim(row: ClaimRow): Claim {
  return {
    id: row.id,
    nodeId: row.node_id,
    contact: row.contact,
    message: row.message,
    createdAt: row.created_at,
  };
}

// 创建求助卡片，同时创建根节点（发起人自己是传播树的根）
export function createRequest(
  input: {
    creatorToken: string;
    nickname: string;
    title: string;
    description: string;
    visibility: Visibility;
    rewardType: RewardType;
    rewardNote?: string | null;
    targetMatchCount?: number | null;
    deadlineAt?: number | null;
  },
  db: Database.Database = getDb()
): { request: HelpRequest; rootNodeId: string } {
  const requestId = nanoid(10);
  const rootNodeId = nanoid(10);
  const now = Date.now();
  const insert = db.transaction(() => {
    db.prepare(
      `INSERT INTO requests (id, creator_token, title, description, visibility, reward_type, reward_note, target_match_count, deadline_at, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`
    ).run(
      requestId,
      input.creatorToken,
      input.title,
      input.description,
      input.visibility,
      input.rewardType,
      input.rewardNote ?? null,
      input.targetMatchCount ?? null,
      input.deadlineAt ?? null,
      now
    );
    db.prepare(
      `INSERT INTO nodes (id, request_id, parent_node_id, visitor_token, nickname, relation_strength, forward_note, created_at)
       VALUES (?, ?, NULL, ?, ?, NULL, NULL, ?)`
    ).run(rootNodeId, requestId, input.creatorToken, input.nickname, now);
  });
  insert();
  return { request: getRequest(requestId, db)!, rootNodeId };
}

export function getRequest(id: string, db: Database.Database = getDb()): HelpRequest | null {
  const row = db.prepare('SELECT * FROM requests WHERE id = ?').get(id) as RequestRow | undefined;
  return row ? toRequest(row) : null;
}

export function getNode(id: string, db: Database.Database = getDb()): ChainNode | null {
  const row = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as NodeRow | undefined;
  return row ? toNode(row) : null;
}

export function listNodes(requestId: string, db: Database.Database = getDb()): ChainNode[] {
  const rows = db.prepare('SELECT * FROM nodes WHERE request_id = ?').all(requestId) as NodeRow[];
  return rows.map(toNode);
}

export function listClaims(requestId: string, db: Database.Database = getDb()): Claim[] {
  const rows = db
    .prepare(
      `SELECT c.* FROM claims c JOIN nodes n ON c.node_id = n.id WHERE n.request_id = ?`
    )
    .all(requestId) as ClaimRow[];
  return rows.map(toClaim);
}

// 接力：在 parent 下创建新节点；同一 token 已在该链路径上则拒绝（防自环）
// 联系方式：私密求助必填（否则逆向回传找不到人），公开求助选填
export function createRelayNode(
  input: {
    parentNodeId: string;
    visitorToken: string;
    nickname: string;
    relationStrength: 1 | 2 | 3;
    contact?: string | null;
    forwardNote?: string | null;
  },
  db: Database.Database = getDb()
): { node: ChainNode } {
  const parent = getNode(input.parentNodeId, db);
  if (!parent) throw new StoreError('parent_not_found', '链接无效：上一跳节点不存在');
  const request = getRequest(parent.requestId, db)!;
  // 终止条件：手动关闭 / 到截止时间 / 已达匹配数量，任一满足即不再接受接力与认领
  const stop = requestStopState(request, listClaims(request.id, db).length);
  if (!stop.open) {
    const msg =
      stop.reason === 'deadline'
        ? '该求助已到截止时间，已结束'
        : stop.reason === 'count'
          ? '该求助已达到目标匹配数量，已结束'
          : '该求助已关闭';
    throw new StoreError('request_stopped', msg);
  }

  const contact = input.contact?.trim() || null;
  if (request.visibility === 'private' && !contact) {
    throw new StoreError('contact_required', '私密求助需要留下联系方式，便于结果逆向回传给你');
  }

  const byId = indexNodes(listNodes(parent.requestId, db));
  if (isTokenInPath(byId, parent.id, input.visitorToken)) {
    throw new StoreError('already_in_chain', '你已经在这条接力链上了');
  }

  const id = nanoid(10);
  db.prepare(
    `INSERT INTO nodes (id, request_id, parent_node_id, visitor_token, nickname, contact, relation_strength, forward_note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    parent.requestId,
    parent.id,
    input.visitorToken,
    input.nickname,
    contact,
    input.relationStrength,
    input.forwardNote ?? null,
    Date.now()
  );
  return { node: getNode(id, db)! };
}

// 认领：认领者先成为链上节点，再挂认领记录，链条由此可回溯
export function createClaim(
  input: {
    parentNodeId: string;
    visitorToken: string;
    nickname: string;
    relationStrength: 1 | 2 | 3;
    contact: string;
    message?: string | null;
  },
  db: Database.Database = getDb()
): { claim: Claim; nodeId: string } {
  const { node } = createRelayNode(
    {
      parentNodeId: input.parentNodeId,
      visitorToken: input.visitorToken,
      nickname: input.nickname,
      relationStrength: input.relationStrength,
      // 认领者的联系方式也写进节点，便于直接上一跳在分支视图里统一读取
      contact: input.contact,
    },
    db
  );
  const id = nanoid(10);
  db.prepare(
    `INSERT INTO claims (id, node_id, contact, message, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, node.id, input.contact, input.message ?? null, Date.now());
  const row = db.prepare('SELECT * FROM claims WHERE id = ?').get(id) as ClaimRow;
  return { claim: toClaim(row), nodeId: node.id };
}

// 求助根节点（发起人本人的节点）
export function getRootNode(requestId: string, db: Database.Database = getDb()): ChainNode | null {
  const row = db
    .prepare('SELECT * FROM nodes WHERE request_id = ? AND parent_node_id IS NULL')
    .get(requestId) as NodeRow | undefined;
  return row ? toNode(row) : null;
}

// 着陆页数据：求助信息 + 已走链条
// public：展示从根到当前节点的完整上游链条
// private：只展示“把这条求助转给你的人”（当前节点本人），上游对接力者不可见
export function getLandingData(nodeId: string, db: Database.Database = getDb()) {
  const node = getNode(nodeId, db);
  if (!node) return null;
  const request = getRequest(node.requestId, db)!;
  const byId = indexNodes(listNodes(node.requestId, db));
  const fullPath = tracePath(byId, nodeId);
  const visiblePath = request.visibility === 'public' ? fullPath : fullPath.slice(-1);
  const hiddenUpstream = fullPath.length - visiblePath.length;
  const stop = requestStopState(request, listClaims(request.id, db).length);
  return { request, node, path: visiblePath, hiddenUpstream, stop };
}

// 发起人视角（公开模式）：全部达成链条（含认领联系方式），按最短/最强排序
// recommendedClaimIds：最优前 N 条（N=匹配数量或默认 3）供发起人挑选
export function getRequestChains(
  requestId: string,
  db: Database.Database = getDb()
): {
  request: HelpRequest;
  chains: Chain[];
  shortestClaimId: string | null;
  strongestClaimId: string | null;
  recommendedClaimIds: string[];
  stop: StopState;
} | null {
  const request = getRequest(requestId, db);
  if (!request) return null;
  const claims = listClaims(requestId, db);
  const ranked = rankChains(buildChains(listNodes(requestId, db), claims));
  const recommendedClaimIds = ranked.chains.slice(0, recommendCount(request)).map((ch) => ch.claim.id);
  return { request, ...ranked, recommendedClaimIds, stop: requestStopState(request, claims.length) };
}

// 某一直接下游分支的达成情况
export interface BranchProgress {
  childNodeId: string;
  childNickname: string;
  // 该直接下游留下的联系方式（仅直接上一跳可见，用于顺链回传时联系到 TA）
  childContact: string | null;
  // 该直接下游本人就是认领者（最终目标）
  isClaimer: boolean;
  // 该分支子树里是否已有人认领（达成目标）
  achieved: boolean;
  // 认领者留言（仅当 isClaimer）
  claimMessage: string | null;
  // 该分支下“最优一条达成链路”的质量（跳数 / 最弱一环），未达成为 null
  bestHops: number | null;
  bestMinStrength: number | null;
  // 推荐排名：在最优前 N 条里的名次（1 起），不在则 null
  recommendRank: number | null;
}

// 节点进展：私密模式逆向反馈的核心数据载体
// 每个参与者（含发起人根节点）凭自己的 token 查看：我转给了谁、哪一支达成了、联系方式回传到我没有
export interface NodeProgress {
  request: HelpRequest;
  node: ChainNode;
  isCreator: boolean;
  depth: number; // 距根的跳数
  branches: BranchProgress[];
  achievedBranchCount: number;
  // 公开模式专用：达成后所有人可见的完整链条（联系方式仍仅发起人侧可得）
  publicChains: Chain[] | null;
  stop: StopState;
}

export function getNodeProgress(nodeId: string, db: Database.Database = getDb()): NodeProgress | null {
  const node = getNode(nodeId, db);
  if (!node) return null;
  const request = getRequest(node.requestId, db)!;
  const allNodes = listNodes(node.requestId, db);
  const claims = listClaims(node.requestId, db);
  const claimByNodeId = new Map(claims.map((c) => [c.nodeId, c]));
  const claimedNodeIds = new Set(claims.map((c) => c.nodeId));
  const childrenMap = childrenByParent(allNodes);
  const byId = indexNodes(allNodes);

  // 全局排好序的达成链条（最短→最强），用于给“经过当前节点的分支”排推荐
  const rankedChains = rankChains(buildChains(allNodes, claims)).chains;
  const nodeDepth = tracePath(byId, node.id).length - 1;
  // 经过当前节点的链条，按排名取每个直接下游分支的最优链路；orderedBranchIds 即推荐顺序
  const branchBest = new Map<string, { hops: number; minStrength: number }>();
  const orderedBranchIds: string[] = [];
  for (const ch of rankedChains) {
    const pos = ch.nodes.findIndex((n) => n.id === node.id);
    if (pos === -1 || pos + 1 >= ch.nodes.length) continue;
    const branchId = ch.nodes[pos + 1].id;
    if (!branchBest.has(branchId)) {
      branchBest.set(branchId, { hops: ch.hops, minStrength: ch.minStrength });
      orderedBranchIds.push(branchId);
    }
  }
  const topN = orderedBranchIds.slice(0, recommendCount(request));

  const children = childrenMap.get(node.id) ?? [];
  const branches: BranchProgress[] = children.map((child) => {
    const directClaim = claimByNodeId.get(child.id) ?? null;
    const best = branchBest.get(child.id) ?? null;
    const rank = topN.indexOf(child.id);
    return {
      childNodeId: child.id,
      childNickname: child.nickname,
      childContact: child.contact,
      isClaimer: directClaim !== null,
      achieved: subtreeHasClaim(childrenMap, claimedNodeIds, child.id),
      claimMessage: directClaim?.message ?? null,
      bestHops: best?.hops ?? null,
      bestMinStrength: best?.minStrength ?? null,
      recommendRank: rank === -1 ? null : rank + 1,
    };
  });
  // 推荐在前、达成在前，便于发起人挑选
  branches.sort((a, b) => {
    const ra = a.recommendRank ?? Infinity;
    const rb = b.recommendRank ?? Infinity;
    if (ra !== rb) return ra - rb;
    return Number(b.achieved) - Number(a.achieved);
  });

  const publicChains = request.visibility === 'public' ? rankedChains : null;

  return {
    request,
    node,
    isCreator: node.visitorToken === request.creatorToken,
    depth: nodeDepth,
    branches,
    achievedBranchCount: branches.filter((b) => b.achieved).length,
    publicChains,
    stop: requestStopState(request, claims.length),
  };
}

// ===== 开发者后台：统计与全量查看 =====

export type Granularity = 'day' | 'week' | 'month' | 'year';

const BUCKET_FORMAT: Record<Granularity, string> = {
  day: '%Y-%m-%d',
  week: '%Y-W%W',
  month: '%Y-%m',
  year: '%Y',
};

export interface AdminStats {
  totals: { requests: number; successes: number; relayNodes: number; successRate: number };
  byVisibility: { private: number; public: number };
  byReward: { paid: number; friendship: number };
  series: { bucket: string; requests: number; successes: number }[];
}

export function getAdminStats(granularity: Granularity, db: Database.Database = getDb()): AdminStats {
  const fmt = BUCKET_FORMAT[granularity];
  const requests = (db.prepare('SELECT COUNT(*) AS c FROM requests').get() as { c: number }).c;
  const relayNodes = (
    db.prepare('SELECT COUNT(*) AS c FROM nodes WHERE parent_node_id IS NOT NULL').get() as { c: number }
  ).c;
  const successExists =
    'EXISTS (SELECT 1 FROM claims cl JOIN nodes n ON cl.node_id = n.id WHERE n.request_id = r.id)';
  const successes = (
    db.prepare(`SELECT COUNT(*) AS c FROM requests r WHERE ${successExists}`).get() as { c: number }
  ).c;

  const visRows = db
    .prepare('SELECT visibility, COUNT(*) AS c FROM requests GROUP BY visibility')
    .all() as { visibility: 'private' | 'public'; c: number }[];
  const rewardRows = db
    .prepare('SELECT reward_type, COUNT(*) AS c FROM requests GROUP BY reward_type')
    .all() as { reward_type: 'paid' | 'friendship'; c: number }[];

  const reqSeries = db
    .prepare(
      `SELECT strftime('${fmt}', created_at / 1000, 'unixepoch', 'localtime') AS bucket, COUNT(*) AS c
       FROM requests GROUP BY bucket ORDER BY bucket`
    )
    .all() as { bucket: string; c: number }[];
  const okSeries = db
    .prepare(
      `SELECT strftime('${fmt}', r.created_at / 1000, 'unixepoch', 'localtime') AS bucket, COUNT(*) AS c
       FROM requests r WHERE ${successExists} GROUP BY bucket ORDER BY bucket`
    )
    .all() as { bucket: string; c: number }[];

  const okByBucket = new Map(okSeries.map((s) => [s.bucket, s.c]));
  const series = reqSeries.map((s) => ({
    bucket: s.bucket,
    requests: s.c,
    successes: okByBucket.get(s.bucket) ?? 0,
  }));

  return {
    totals: {
      requests,
      successes,
      relayNodes,
      successRate: requests > 0 ? Math.round((successes / requests) * 100) : 0,
    },
    byVisibility: {
      private: visRows.find((v) => v.visibility === 'private')?.c ?? 0,
      public: visRows.find((v) => v.visibility === 'public')?.c ?? 0,
    },
    byReward: {
      paid: rewardRows.find((v) => v.reward_type === 'paid')?.c ?? 0,
      friendship: rewardRows.find((v) => v.reward_type === 'friendship')?.c ?? 0,
    },
    series,
  };
}

// 开发者全量查看：每条求助的完整链条、所有节点联系方式与认领
export function getAdminRequests(db: Database.Database = getDb()): {
  request: HelpRequest;
  nodes: ChainNode[];
  chains: Chain[];
}[] {
  const rows = db.prepare('SELECT * FROM requests ORDER BY created_at DESC').all() as RequestRow[];
  return rows.map((row) => {
    const request = toRequest(row);
    const nodes = listNodes(request.id, db);
    const chains = rankChains(buildChains(nodes, listClaims(request.id, db))).chains;
    return { request, nodes, chains };
  });
}

export class StoreError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'StoreError';
  }
}
