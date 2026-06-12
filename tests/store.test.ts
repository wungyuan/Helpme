import { beforeEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { createDb } from '../lib/db';
import {
  createClaim,
  createRelayNode,
  createRequest,
  getLandingData,
  getRequestChains,
} from '../lib/store';

let db: Database.Database;

beforeEach(() => {
  db = createDb(':memory:');
});

function seedRequest() {
  return createRequest(
    {
      creatorToken: 'creator',
      nickname: '发起人',
      title: '找一位儿科专家',
      description: '孩子的疑难病例想请专家看看',
      type: 'resource',
    },
    db
  );
}

describe('createRequest', () => {
  it('创建求助时同时创建根节点', () => {
    const { request, rootNodeId } = seedRequest();
    const landing = getLandingData(rootNodeId, db)!;
    expect(landing.request.id).toBe(request.id);
    expect(landing.path).toHaveLength(1);
    expect(landing.path[0].parentNodeId).toBeNull();
  });
});

describe('createRelayNode', () => {
  it('接力后着陆页链条逐跳增长', () => {
    const { rootNodeId } = seedRequest();
    const { node: a } = createRelayNode(
      { parentNodeId: rootNodeId, visitorToken: 'ta', nickname: '甲', relationStrength: 3 },
      db
    );
    const { node: b } = createRelayNode(
      { parentNodeId: a.id, visitorToken: 'tb', nickname: '乙', relationStrength: 2 },
      db
    );
    const landing = getLandingData(b.id, db)!;
    expect(landing.path.map((n) => n.nickname)).toEqual(['发起人', '甲', '乙']);
  });

  it('同一 token 不能在同一链上出现两次（防自环）', () => {
    const { rootNodeId } = seedRequest();
    const { node: a } = createRelayNode(
      { parentNodeId: rootNodeId, visitorToken: 'ta', nickname: '甲', relationStrength: 3 },
      db
    );
    expect(() =>
      createRelayNode(
        { parentNodeId: a.id, visitorToken: 'ta', nickname: '甲', relationStrength: 2 },
        db
      )
    ).toThrow(/接力链/);
  });

  it('parent 不存在时报错', () => {
    seedRequest();
    expect(() =>
      createRelayNode(
        { parentNodeId: 'ghost', visitorToken: 'tx', nickname: '某', relationStrength: 1 },
        db
      )
    ).toThrow(/不存在/);
  });
});

describe('createClaim + getRequestChains', () => {
  it('多条分叉链认领后，发起人能看到最短/最强标注', () => {
    const { request, rootNodeId } = seedRequest();
    // 链1：root → 甲(3) → 乙(1) → 认领
    const { node: a } = createRelayNode(
      { parentNodeId: rootNodeId, visitorToken: 'ta', nickname: '甲', relationStrength: 3 },
      db
    );
    const { node: b } = createRelayNode(
      { parentNodeId: a.id, visitorToken: 'tb', nickname: '乙', relationStrength: 1 },
      db
    );
    const { claim: c1 } = createClaim(
      {
        parentNodeId: b.id,
        visitorToken: 'tc',
        nickname: '丙医生',
        relationStrength: 3,
        claimType: 'can_help',
        contact: 'wx: doctor-c',
      },
      db
    );
    // 链2：root → 丁(2) → 认领（更短，且最弱一环 2 > 链1 的 1）
    const { node: d } = createRelayNode(
      { parentNodeId: rootNodeId, visitorToken: 'td', nickname: '丁', relationStrength: 2 },
      db
    );
    const { claim: c2 } = createClaim(
      {
        parentNodeId: d.id,
        visitorToken: 'te',
        nickname: '戊医生',
        relationStrength: 2,
        claimType: 'can_help',
        contact: 'wx: doctor-e',
      },
      db
    );

    const result = getRequestChains(request.id, db)!;
    expect(result.chains).toHaveLength(2);
    expect(result.shortestClaimId).toBe(c2.id);
    expect(result.strongestClaimId).toBe(c2.id);
    const chain1 = result.chains.find((ch) => ch.claim.id === c1.id)!;
    expect(chain1.hops).toBe(3);
    expect(chain1.minStrength).toBe(1);
  });
});
