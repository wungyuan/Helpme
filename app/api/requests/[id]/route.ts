import { NextResponse } from 'next/server';
import { getRequestChains } from '@/lib/store';

// GET /api/requests/:id?token=xxx 发起人视角：详情 + 全部达成链条
// token 校验通过才返回认领者联系方式
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get('token');
  const result = getRequestChains(id);
  if (!result) {
    return NextResponse.json({ error: 'not_found', message: '求助不存在' }, { status: 404 });
  }
  const isCreator = token === result.request.creatorToken;
  if (!isCreator) {
    return NextResponse.json({ error: 'forbidden', message: '只有发起人可以查看' }, { status: 403 });
  }
  const { request, chains, shortestClaimId, strongestClaimId } = result;
  return NextResponse.json({
    request: {
      id: request.id,
      title: request.title,
      description: request.description,
      type: request.type,
      targetDesc: request.targetDesc,
      status: request.status,
      createdAt: request.createdAt,
    },
    chains: chains.map((ch) => ({
      claim: ch.claim,
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
    shortestClaimId,
    strongestClaimId,
  });
}
