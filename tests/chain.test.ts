import { describe, expect, it } from 'vitest';
import {
  buildChains,
  childrenByParent,
  indexNodes,
  isTokenInPath,
  rankChains,
  subtreeHasClaim,
  tracePath,
  type Chain,
  type ChainNode,
  type Claim,
} from '../lib/chain';

let seq = 0;

function node(partial: Partial<ChainNode> & { id: string }): ChainNode {
  return {
    requestId: 'req1',
    parentNodeId: null,
    visitorToken: `token-${partial.id}`,
    nickname: partial.id,
    relationStrength: null,
    forwardNote: null,
    contact: null,
    createdAt: ++seq,
    ...partial,
  };
}

function claim(id: string, nodeId: string): Claim {
  return {
    id,
    nodeId,
    contact: '13800000000',
    message: null,
    createdAt: ++seq,
  };
}

// 树形：root → a(强3) → b(中2) → c(弱1)
//             └→ d(中2) → e(强3)
function fixture(): ChainNode[] {
  return [
    node({ id: 'root' }),
    node({ id: 'a', parentNodeId: 'root', relationStrength: 3 }),
    node({ id: 'b', parentNodeId: 'a', relationStrength: 2 }),
    node({ id: 'c', parentNodeId: 'b', relationStrength: 1 }),
    node({ id: 'd', parentNodeId: 'root', relationStrength: 2 }),
    node({ id: 'e', parentNodeId: 'd', relationStrength: 3 }),
  ];
}

describe('tracePath', () => {
  it('从认领节点回溯到根，根在前', () => {
    const byId = indexNodes(fixture());
    const path = tracePath(byId, 'c');
    expect(path.map((n) => n.id)).toEqual(['root', 'a', 'b', 'c']);
  });

  it('节点不存在时抛错', () => {
    const byId = indexNodes(fixture());
    expect(() => tracePath(byId, 'nope')).toThrow(/not found/);
  });

  it('父节点悬空时抛错', () => {
    const byId = indexNodes([node({ id: 'x', parentNodeId: 'ghost', relationStrength: 2 })]);
    expect(() => tracePath(byId, 'x')).toThrow(/dangling/);
  });
});

describe('isTokenInPath', () => {
  it('检出已在链上的 token（防自环）', () => {
    const byId = indexNodes(fixture());
    expect(isTokenInPath(byId, 'b', 'token-a')).toBe(true);
    expect(isTokenInPath(byId, 'b', 'token-e')).toBe(false);
  });
});

describe('buildChains', () => {
  it('多个认领提取出多条链，强度统计不含根节点', () => {
    const chains = buildChains(fixture(), [claim('cl1', 'c'), claim('cl2', 'e')]);
    expect(chains).toHaveLength(2);

    const long = chains.find((ch) => ch.claim.id === 'cl1') as Chain;
    expect(long.hops).toBe(3);
    expect(long.minStrength).toBe(1);
    expect(long.avgStrength).toBeCloseTo(2);

    const short = chains.find((ch) => ch.claim.id === 'cl2') as Chain;
    expect(short.hops).toBe(2);
    expect(short.minStrength).toBe(2);
    expect(short.avgStrength).toBeCloseTo(2.5);
  });

  it('发起人链接直接被认领时，跳数为 1', () => {
    const nodes = [node({ id: 'root' }), node({ id: 'a', parentNodeId: 'root', relationStrength: 3 })];
    const [chain] = buildChains(nodes, [claim('cl1', 'a')]);
    expect(chain.hops).toBe(1);
    expect(chain.minStrength).toBe(3);
  });
});

describe('childrenByParent + subtreeHasClaim', () => {
  it('按父节点归类直接下游', () => {
    const map = childrenByParent(fixture());
    expect((map.get('root') ?? []).map((n) => n.id).sort()).toEqual(['a', 'd']);
    expect((map.get('a') ?? []).map((n) => n.id)).toEqual(['b']);
    expect(map.get('c')).toBeUndefined();
  });

  it('子树含认领则该支视为达成（私密模式逆向反馈）', () => {
    const nodes = fixture();
    const map = childrenByParent(nodes);
    // 认领发生在 c（在 a 这一支的子树里），不在 d 这一支
    const claimed = new Set(['c']);
    expect(subtreeHasClaim(map, claimed, 'a')).toBe(true);
    expect(subtreeHasClaim(map, claimed, 'd')).toBe(false);
    // 认领节点本身
    expect(subtreeHasClaim(map, claimed, 'c')).toBe(true);
  });
});

describe('rankChains', () => {
  it('最短=跳数最少，最强=最弱一环最大（短板效应）', () => {
    const chains = buildChains(fixture(), [claim('cl1', 'c'), claim('cl2', 'e')]);
    const ranked = rankChains(chains);
    // cl2 跳数 2 < cl1 跳数 3，最短
    expect(ranked.shortestClaimId).toBe('cl2');
    // cl2 最弱一环 2 > cl1 最弱一环 1，最强
    expect(ranked.strongestClaimId).toBe('cl2');
    expect(ranked.chains[0].claim.id).toBe('cl2');
  });

  it('短链不一定最强：长链全强边时拿最强徽标', () => {
    // root → a(弱1)，root → b(强3) → c(强3)
    const nodes = [
      node({ id: 'root' }),
      node({ id: 'a', parentNodeId: 'root', relationStrength: 1 }),
      node({ id: 'b', parentNodeId: 'root', relationStrength: 3 }),
      node({ id: 'c', parentNodeId: 'b', relationStrength: 3 }),
    ];
    const ranked = rankChains(buildChains(nodes, [claim('cl1', 'a'), claim('cl2', 'c')]));
    expect(ranked.shortestClaimId).toBe('cl1');
    expect(ranked.strongestClaimId).toBe('cl2');
  });

  it('空认领列表返回空结果', () => {
    const ranked = rankChains([]);
    expect(ranked.chains).toEqual([]);
    expect(ranked.shortestClaimId).toBeNull();
    expect(ranked.strongestClaimId).toBeNull();
  });
});
