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
  status: 'open' | 'closed';
  created_at: number;
}

interface NodeRow {
  id: string;
  request_id: string;
  parent_node_id: string | null;
  visitor_token: string;
  nickname: string;
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
  },
  db: Database.Database = getDb()
): { request: HelpRequest; rootNodeId: string } {
  const requestId = nanoid(10);
  const rootNodeId = nanoid(10);
  const now = Date.now();
  const insert = db.transaction(() => {
    db.prepare(
      `INSERT INTO requests (id, creator_token, title, description, visibility, reward_type, reward_note, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`
    ).run(
      requestId,
      input.creatorToken,
      input.title,
      input.description,
      input.visibility,
      input.rewardType,
      input.rewardNote ?? null,
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
export function createRelayNode(
  input: {
    parentNodeId: string;
    visitorToken: string;
    nickname: string;
    relationStrength: 1 | 2 | 3;
    forwardNote?: string | null;
  },
  db: Database.Database = getDb()
): { node: ChainNode } {
  const parent = getNode(input.parentNodeId, db);
  if (!parent) throw new StoreError('parent_not_found', '链接无效：上一跳节点不存在');
  const request = getRequest(parent.requestId, db)!;
  if (request.status !== 'open') throw new StoreError('request_closed', '该求助已关闭');

  const byId = indexNodes(listNodes(parent.requestId, db));
  if (isTokenInPath(byId, parent.id, input.visitorToken)) {
    throw new StoreError('already_in_chain', '你已经在这条接力链上了');
  }

  const id = nanoid(10);
  db.prepare(
    `INSERT INTO nodes (id, request_id, parent_node_id, visitor_token, nickname, relation_strength, forward_note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    parent.requestId,
    parent.id,
    input.visitorToken,
    input.nickname,
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
  return { request, node, path: visiblePath, hiddenUpstream };
}

// 发起人视角（公开模式）：全部达成链条（含认领联系方式），按最短/最强排序
export function getRequestChains(
  requestId: string,
  db: Database.Database = getDb()
): { request: HelpRequest; chains: Chain[]; shortestClaimId: string | null; strongestClaimId: string | null } | null {
  const request = getRequest(requestId, db);
  if (!request) return null;
  const ranked = rankChains(buildChains(listNodes(requestId, db), listClaims(requestId, db)));
  return { request, ...ranked };
}

// 某一直接下游分支的达成情况
export interface BranchProgress {
  childNodeId: string;
  childNickname: string;
  // 该分支子树里是否已有人认领（达成目标）
  achieved: boolean;
  // 仅当该直接下游本人就是认领者时填（即“你”是认领者的直接上一跳）：私密模式逆向回传的落点
  claimContact: string | null;
  claimMessage: string | null;
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

  const children = childrenMap.get(node.id) ?? [];
  const branches: BranchProgress[] = children.map((child) => {
    const directClaim = claimByNodeId.get(child.id) ?? null;
    return {
      childNodeId: child.id,
      childNickname: child.nickname,
      achieved: subtreeHasClaim(childrenMap, claimedNodeIds, child.id),
      claimContact: directClaim?.contact ?? null,
      claimMessage: directClaim?.message ?? null,
    };
  });

  const publicChains =
    request.visibility === 'public'
      ? rankChains(buildChains(allNodes, claims)).chains
      : null;

  return {
    request,
    node,
    isCreator: node.visitorToken === request.creatorToken,
    depth: tracePath(byId, node.id).length - 1,
    branches,
    achievedBranchCount: branches.filter((b) => b.achieved).length,
    publicChains,
  };
}

export class StoreError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'StoreError';
  }
}
