import { NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/admin';
import { getAdminRequests } from '@/lib/store';

// GET /api/admin/requests?key=xxx 全量求助 + 完整链条 + 联系方式（仅开发者）
export async function GET(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: 'forbidden', message: '口令错误' }, { status: 403 });
  }
  const data = getAdminRequests().map(({ request, nodes, chains }) => ({
    request: {
      id: request.id,
      title: request.title,
      description: request.description,
      visibility: request.visibility,
      rewardType: request.rewardType,
      rewardNote: request.rewardNote,
      status: request.status,
      createdAt: request.createdAt,
    },
    nodeCount: nodes.length,
    // 完整节点（含联系方式），按创建时间排序便于阅读
    nodes: [...nodes]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((n) => ({
        id: n.id,
        parentNodeId: n.parentNodeId,
        nickname: n.nickname,
        contact: n.contact,
        relationStrength: n.relationStrength,
        forwardNote: n.forwardNote,
      })),
    chains: chains.map((ch) => ({
      hops: ch.hops,
      minStrength: ch.minStrength,
      contact: ch.claim.contact,
      message: ch.claim.message,
      path: ch.nodes.map((n) => n.nickname),
    })),
  }));
  return NextResponse.json({ requests: data });
}
