import { NextResponse } from 'next/server';
import { getNodeProgress, getRequest, getRequestChains, getRootNode } from '@/lib/store';

// GET /api/requests/:id?token=xxx 发起人视角，token 校验通过才返回敏感信息
// public：返回全部达成链条 + 认领联系方式（发起人有特权）
// private：只返回发起人“直接转发的人”里哪一支达成；联系方式仅在发起人本人是认领者直接上一跳时给出
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get('token');

  const request = getRequest(id);
  if (!request) {
    return NextResponse.json({ error: 'not_found', message: '求助不存在' }, { status: 404 });
  }
  if (token !== request.creatorToken) {
    return NextResponse.json({ error: 'forbidden', message: '只有发起人可以查看' }, { status: 403 });
  }

  const requestDto = {
    id: request.id,
    title: request.title,
    description: request.description,
    visibility: request.visibility,
    rewardType: request.rewardType,
    rewardNote: request.rewardNote,
    targetMatchCount: request.targetMatchCount,
    deadlineAt: request.deadlineAt,
    status: request.status,
    createdAt: request.createdAt,
  };

  if (request.visibility === 'public') {
    const result = getRequestChains(id)!;
    return NextResponse.json({
      mode: 'public',
      request: requestDto,
      stop: result.stop,
      // 最优前 N 条，供发起人挑选
      recommendedClaimIds: result.recommendedClaimIds,
      chains: result.chains.map((ch) => ({
        claim: { id: ch.claim.id, contact: ch.claim.contact, message: ch.claim.message },
        hops: ch.hops,
        minStrength: ch.minStrength,
        avgStrength: ch.avgStrength,
        nodes: ch.nodes.map((n) => ({
          id: n.id,
          nickname: n.nickname,
          relationStrength: n.relationStrength,
          forwardNote: n.forwardNote,
        })),
      })),
      shortestClaimId: result.shortestClaimId,
      strongestClaimId: result.strongestClaimId,
    });
  }

  // private：发起人即根节点，看自己直接下游的达成情况
  const root = getRootNode(id)!;
  const progress = getNodeProgress(root.id)!;
  return NextResponse.json({
    mode: 'private',
    request: requestDto,
    stop: progress.stop,
    achievedBranchCount: progress.achievedBranchCount,
    // 发起人直接转发的人：联系方式可见（你转发给了 TA）；recommendRank 标出最优前 N 支
    branches: progress.branches.map((b) => ({
      childNodeId: b.childNodeId,
      childNickname: b.childNickname,
      childContact: b.childContact,
      isClaimer: b.isClaimer,
      achieved: b.achieved,
      claimMessage: b.claimMessage,
      bestHops: b.bestHops,
      bestMinStrength: b.bestMinStrength,
      recommendRank: b.recommendRank,
    })),
  });
}
