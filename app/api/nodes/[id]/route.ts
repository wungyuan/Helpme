import { NextResponse } from 'next/server';
import { getNodeProgress } from '@/lib/store';

// GET /api/nodes/:id?token=xxx 接力者查看自己这一棒的进展
// 凭自己的 token 才能看；私密模式只暴露“你直接转发的人”的达成情况与（仅直接上一跳的）联系方式回传
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get('token');

  const progress = getNodeProgress(id);
  if (!progress) {
    return NextResponse.json({ error: 'not_found', message: '接力节点不存在' }, { status: 404 });
  }
  if (token !== progress.node.visitorToken) {
    return NextResponse.json({ error: 'forbidden', message: '只能查看你自己的接力进展' }, { status: 403 });
  }

  const { request } = progress;
  const isPublic = request.visibility === 'public';

  return NextResponse.json({
    request: {
      title: request.title,
      description: request.description,
      visibility: request.visibility,
      rewardType: request.rewardType,
      rewardNote: request.rewardNote,
      status: request.status,
    },
    stop: progress.stop,
    you: { nickname: progress.node.nickname, depth: progress.depth, isCreator: progress.isCreator },
    achievedBranchCount: progress.achievedBranchCount,
    // 你直接转发的人：联系方式只对“直接上一跳”（也就是你）可见，两种模式皆然
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
    // 公开模式达成后，所有参与者可见完整链条（不含联系方式），关系强弱不下发给接力者
    publicChains:
      isPublic && progress.publicChains
        ? progress.publicChains.map((ch) => ({
            hops: ch.hops,
            nodes: ch.nodes.map((n) => ({ id: n.id, nickname: n.nickname })),
          }))
        : null,
  });
}
