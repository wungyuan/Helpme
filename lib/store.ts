// 存取层：requests / nodes / claims 的读写，行记录与领域对象的映射
import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import type { Chain, ChainNode, Claim } from './chain';
import { buildChains, indexNodes, isTokenInPath, rankChains, tracePath } from './chain';
import { getDb } from './db';

export interface HelpRequest {
  id: string;
  creatorToken: string;
  title: string;
  description: string;
  type: 'direct' | 'resource';
  targetDesc: string | null;
  status: 'open' | 'closed';
  createdAt: number;
}

interface RequestRow {
  id: string;
  creator_token: string;
  title: string;
  description: string;
  type: 'direct' | 'resource';
  target_desc: string | null;
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
  claim_type: 'is_target' | 'can_help';
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
    type: row.type,
    targetDesc: row.target_desc,
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
    claimType: row.claim_type,
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
    type: 'direct' | 'resource';
    targetDesc?: string | null;
  },
  db: Database.Database = getDb()
): { request: HelpRequest; rootNodeId: string } {
  const requestId = nanoid(10);
  const rootNodeId = nanoid(10);
  const now = Date.now();
  const insert = db.transaction(() => {
    db.prepare(
      `INSERT INTO requests (id, creator_token, title, description, type, target_desc, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`
    ).run(requestId, input.creatorToken, input.title, input.description, input.type, input.targetDesc ?? null, now);
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
    claimType: 'is_target' | 'can_help';
    contact: string;
    message?: string | null;
  },
  db: Database.Database = getDb()
): { claim: Claim } {
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
    `INSERT INTO claims (id, node_id, claim_type, contact, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, node.id, input.claimType, input.contact, input.message ?? null, Date.now());
  const row = db.prepare('SELECT * FROM claims WHERE id = ?').get(id) as ClaimRow;
  return { claim: toClaim(row) };
}

// 着陆页数据：求助信息 + 从根到当前节点的已走链条
export function getLandingData(nodeId: string, db: Database.Database = getDb()) {
  const node = getNode(nodeId, db);
  if (!node) return null;
  const request = getRequest(node.requestId, db)!;
  const byId = indexNodes(listNodes(node.requestId, db));
  const path = tracePath(byId, nodeId);
  return { request, node, path };
}

// 发起人视角：全部达成链条（含认领联系方式），按最短/最强排序
export function getRequestChains(
  requestId: string,
  db: Database.Database = getDb()
): { request: HelpRequest; chains: Chain[]; shortestClaimId: string | null; strongestClaimId: string | null } | null {
  const request = getRequest(requestId, db);
  if (!request) return null;
  const ranked = rankChains(buildChains(listNodes(requestId, db), listClaims(requestId, db)));
  return { request, ...ranked };
}

export class StoreError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'StoreError';
  }
}
