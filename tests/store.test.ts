import { beforeEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { createDb } from '../lib/db';
import {
  createClaim,
  createRelayNode,
  createRequest,
  getLandingData,
  getNodeProgress,
  getRequestChains,
  setRequestStatus,
} from '../lib/store';

let db: Database.Database;

beforeEach(() => {
  db = createDb(':memory:');
});

function seedRequest(visibility: 'private' | 'public' = 'public') {
  return createRequest(
    {
      creatorToken: 'creator',
      nickname: '发起人',
      title: '找一位儿科专家',
      description: '孩子的疑难病例想请专家看看',
      visibility,
      rewardType: 'friendship',
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

describe('getNodeProgress（私密逆向反馈）', () => {
  it('每个节点只看到直接下游，并能拿到直接下游留的联系方式', () => {
    const { rootNodeId } = seedRequest('private');
    // root → 甲 → 乙 →(认领) 丙；每个接力者都留联系方式
    const { node: a } = createRelayNode(
      { parentNodeId: rootNodeId, visitorToken: 'ta', nickname: '甲', relationStrength: 3, contact: 'wx-a' },
      db
    );
    const { node: b } = createRelayNode(
      { parentNodeId: a.id, visitorToken: 'tb', nickname: '乙', relationStrength: 2, contact: 'wx-b' },
      db
    );
    createClaim(
      { parentNodeId: b.id, visitorToken: 'tc', nickname: '丙', relationStrength: 2, contact: 'wx-c' },
      db
    );

    // 发起人（根）只看到“甲”这一支：能拿到甲的联系方式，但 甲 不是认领者
    const rootProg = getNodeProgress(rootNodeId, db)!;
    expect(rootProg.branches.map((x) => x.childNickname)).toEqual(['甲']);
    expect(rootProg.branches[0].achieved).toBe(true);
    expect(rootProg.branches[0].childContact).toBe('wx-a');
    expect(rootProg.branches[0].isClaimer).toBe(false);

    // 乙是认领者丙的直接上一跳：丙是最终者，能拿到丙的联系方式
    const bProg = getNodeProgress(b.id, db)!;
    expect(bProg.branches[0].childNickname).toBe('丙');
    expect(bProg.branches[0].childContact).toBe('wx-c');
    expect(bProg.branches[0].isClaimer).toBe(true);
    expect(bProg.depth).toBe(2);
    // 私密模式不下发完整链条
    expect(bProg.publicChains).toBeNull();
  });

  it('私密求助接力不留联系方式则拒绝；公开求助可不留', () => {
    const { rootNodeId } = seedRequest('private');
    expect(() =>
      createRelayNode({ parentNodeId: rootNodeId, visitorToken: 'tx', nickname: '甲', relationStrength: 2 }, db)
    ).toThrow(/联系方式/);

    const pub = seedRequest('public');
    expect(() =>
      createRelayNode(
        { parentNodeId: pub.rootNodeId, visitorToken: 'ty', nickname: '乙', relationStrength: 2 },
        db
      )
    ).not.toThrow();
  });

  it('发起人手动结束后拒绝接力，重新开放后恢复', () => {
    const { request, rootNodeId } = seedRequest('public');
    setRequestStatus(request.id, 'closed', db);
    expect(getRequestChains(request.id, db)!.stop).toMatchObject({ open: false, reason: 'manual' });
    expect(() =>
      createRelayNode({ parentNodeId: rootNodeId, visitorToken: 'a', nickname: '甲', relationStrength: 2 }, db)
    ).toThrow(/关闭|结束/);
    // 重新开放后可继续接力
    setRequestStatus(request.id, 'open', db);
    expect(getRequestChains(request.id, db)!.stop.open).toBe(true);
    expect(() =>
      createRelayNode({ parentNodeId: rootNodeId, visitorToken: 'a', nickname: '甲', relationStrength: 2 }, db)
    ).not.toThrow();
  });

  it('达到匹配数量后停止接受新接力', () => {
    const { request, rootNodeId } = createRequest(
      {
        creatorToken: 'c',
        nickname: '发起',
        title: 't',
        description: 'd',
        visibility: 'public',
        rewardType: 'friendship',
        targetMatchCount: 1,
      },
      db
    );
    const { node: a } = createRelayNode(
      { parentNodeId: rootNodeId, visitorToken: 'a', nickname: '甲', relationStrength: 2 },
      db
    );
    createClaim({ parentNodeId: a.id, visitorToken: 'b', nickname: '乙', relationStrength: 2, contact: 'x' }, db);
    // 已达 1 条匹配，再接力应被拒
    expect(() =>
      createRelayNode({ parentNodeId: rootNodeId, visitorToken: 'z', nickname: '丙', relationStrength: 2 }, db)
    ).toThrow(/数量|结束/);
    expect(getRequestChains(request.id, db)!.stop.open).toBe(false);
  });

  it('到达截止时间后停止接受新接力', () => {
    const { rootNodeId } = createRequest(
      {
        creatorToken: 'c',
        nickname: '发起',
        title: 't',
        description: 'd',
        visibility: 'public',
        rewardType: 'friendship',
        deadlineAt: Date.now() - 1000,
      },
      db
    );
    expect(() =>
      createRelayNode({ parentNodeId: rootNodeId, visitorToken: 'a', nickname: '甲', relationStrength: 2 }, db)
    ).toThrow(/截止|结束/);
  });

  it('多条达成时按最优排序推荐前 N 条', () => {
    const { request, rootNodeId } = createRequest(
      {
        creatorToken: 'c',
        nickname: '发起',
        title: 't',
        description: 'd',
        visibility: 'public',
        rewardType: 'friendship',
        targetMatchCount: 2,
      },
      db
    );
    // 短链：root → 甲 → 认领（2 跳）
    const { node: a } = createRelayNode(
      { parentNodeId: rootNodeId, visitorToken: 'a', nickname: '甲', relationStrength: 3 },
      db
    );
    const { claim: short } = createClaim(
      { parentNodeId: a.id, visitorToken: 'a2', nickname: '甲目标', relationStrength: 3, contact: 'x' },
      db
    );
    // 长链：root → 乙 → 丙 → 认领（3 跳）
    const { node: b } = createRelayNode(
      { parentNodeId: rootNodeId, visitorToken: 'b', nickname: '乙', relationStrength: 3 },
      db
    );
    const { node: cc } = createRelayNode(
      { parentNodeId: b.id, visitorToken: 'c2', nickname: '丙', relationStrength: 3 },
      db
    );
    const { claim: long } = createClaim(
      { parentNodeId: cc.id, visitorToken: 'c3', nickname: '丙目标', relationStrength: 3, contact: 'y' },
      db
    );
    const result = getRequestChains(request.id, db)!;
    // N = targetMatchCount = 2，短链排在推荐第一
    expect(result.recommendedClaimIds).toEqual([short.id, long.id]);
  });

  it('私密模式给发起人的分支标推荐名次', () => {
    const { rootNodeId } = seedRequest('private');
    // 两支：甲(经2跳达成) 与 乙(经3跳达成)
    const { node: a } = createRelayNode(
      { parentNodeId: rootNodeId, visitorToken: 'a', nickname: '甲', relationStrength: 3, contact: 'ca' },
      db
    );
    createClaim({ parentNodeId: a.id, visitorToken: 'a2', nickname: '甲目标', relationStrength: 3, contact: 'x' }, db);
    const { node: b } = createRelayNode(
      { parentNodeId: rootNodeId, visitorToken: 'b', nickname: '乙', relationStrength: 3, contact: 'cb' },
      db
    );
    const { node: bc } = createRelayNode(
      { parentNodeId: b.id, visitorToken: 'b2', nickname: '乙下', relationStrength: 3, contact: 'cc' },
      db
    );
    createClaim({ parentNodeId: bc.id, visitorToken: 'b3', nickname: '乙目标', relationStrength: 3, contact: 'y' }, db);

    const prog = getNodeProgress(rootNodeId, db)!;
    const jia = prog.branches.find((x) => x.childNickname === '甲')!;
    const yi = prog.branches.find((x) => x.childNickname === '乙')!;
    expect(jia.recommendRank).toBe(1); // 短链优先
    expect(yi.recommendRank).toBe(2);
    expect(jia.bestHops).toBe(2);
    expect(yi.bestHops).toBe(3);
  });

  it('昵称重名不报错，身份由 token 区分', () => {
    const { rootNodeId } = seedRequest('public');
    const { node: a } = createRelayNode(
      { parentNodeId: rootNodeId, visitorToken: 't1', nickname: '小明', relationStrength: 2 },
      db
    );
    // 同名不同人（不同 token），且都挂在同一上一跳下
    expect(() =>
      createRelayNode(
        { parentNodeId: rootNodeId, visitorToken: 't2', nickname: '小明', relationStrength: 2 },
        db
      )
    ).not.toThrow();
    const prog = getNodeProgress(rootNodeId, db)!;
    expect(prog.branches.filter((x) => x.childNickname === '小明')).toHaveLength(2);
    // 两个分支的 childNodeId 不同，可作为唯一 key
    const ids = prog.branches.map((x) => x.childNodeId);
    expect(new Set(ids).size).toBe(ids.length);
    void a;
  });
});
