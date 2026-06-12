// 链条引擎：传播树的路径回溯、多链提取与“最短/最强”排序
// 纯函数模块，不依赖数据库，便于单元测试

export interface ChainNode {
  id: string;
  requestId: string;
  parentNodeId: string | null;
  visitorToken: string;
  nickname: string;
  // 与上一跳的关系强度：3 强 / 2 中 / 1 弱；根节点（发起人）为 null
  relationStrength: number | null;
  forwardNote: string | null;
  createdAt: number;
}

export interface Claim {
  id: string;
  nodeId: string;
  claimType: 'is_target' | 'can_help';
  contact: string;
  message: string | null;
  createdAt: number;
}

export interface Chain {
  claim: Claim;
  // 从根（发起人）到认领者，顺序排列
  nodes: ChainNode[];
  // 跳数 = 边数 = nodes.length - 1
  hops: number;
  // 链上最弱一环的强度（短板效应）
  minStrength: number;
  avgStrength: number;
}

export interface RankedChains {
  chains: Chain[];
  shortestClaimId: string | null;
  strongestClaimId: string | null;
}

export function indexNodes(nodes: ChainNode[]): Map<string, ChainNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}

// 从某节点回溯到根，返回根在前的路径；遇到悬空 parent 或环则抛错
export function tracePath(byId: Map<string, ChainNode>, nodeId: string): ChainNode[] {
  const path: ChainNode[] = [];
  const seen = new Set<string>();
  let cur = byId.get(nodeId);
  if (!cur) throw new Error(`node not found: ${nodeId}`);
  while (cur) {
    if (seen.has(cur.id)) throw new Error(`cycle detected at node: ${cur.id}`);
    seen.add(cur.id);
    path.unshift(cur);
    if (cur.parentNodeId === null) return path;
    const parent = byId.get(cur.parentNodeId);
    if (!parent) throw new Error(`dangling parent: ${cur.parentNodeId}`);
    cur = parent;
  }
  return path;
}

// 防自环：token 是否已出现在从 startNodeId 到根的路径上
export function isTokenInPath(
  byId: Map<string, ChainNode>,
  startNodeId: string,
  token: string
): boolean {
  return tracePath(byId, startNodeId).some((n) => n.visitorToken === token);
}

export function buildChains(nodes: ChainNode[], claims: Claim[]): Chain[] {
  const byId = indexNodes(nodes);
  return claims.map((claim) => {
    const path = tracePath(byId, claim.nodeId);
    // 每个非根节点的 relationStrength 是它与上一跳之间那条边的强度
    const strengths = path.filter((n) => n.parentNodeId !== null).map((n) => n.relationStrength ?? 1);
    const hops = path.length - 1;
    const minStrength = strengths.length > 0 ? Math.min(...strengths) : 0;
    const avgStrength =
      strengths.length > 0 ? strengths.reduce((a, b) => a + b, 0) / strengths.length : 0;
    return { claim, nodes: path, hops, minStrength, avgStrength };
  });
}

// 排序规则：跳数少优先，再比最弱一环，再比均值
// 最短徽标 = 排序第一；最强徽标 = 最弱一环最大者（短板效应），平局看均值、再看跳数
export function rankChains(chains: Chain[]): RankedChains {
  const sorted = [...chains].sort(
    (a, b) => a.hops - b.hops || b.minStrength - a.minStrength || b.avgStrength - a.avgStrength
  );
  const strongest = [...chains].sort(
    (a, b) => b.minStrength - a.minStrength || b.avgStrength - a.avgStrength || a.hops - b.hops
  )[0];
  return {
    chains: sorted,
    shortestClaimId: sorted[0]?.claim.id ?? null,
    strongestClaimId: strongest?.claim.id ?? null,
  };
}
