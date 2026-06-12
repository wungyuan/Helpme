import { NextResponse } from 'next/server';
import { createRelayNode, StoreError } from '@/lib/store';

// POST /api/nodes 接力转发：在链上加入自己，返回新的分享节点
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { parentNodeId, visitorToken, nickname, relationStrength, forwardNote } = body ?? {};
  if (!parentNodeId || !visitorToken || !nickname?.trim() || ![1, 2, 3].includes(relationStrength)) {
    return NextResponse.json({ error: 'invalid_input', message: '请填写昵称并选择关系强度' }, { status: 400 });
  }
  try {
    const { node } = createRelayNode({
      parentNodeId,
      visitorToken,
      nickname: nickname.trim(),
      relationStrength,
      forwardNote: forwardNote?.trim() || null,
    });
    return NextResponse.json({ nodeId: node.id });
  } catch (err) {
    if (err instanceof StoreError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 400 });
    }
    throw err;
  }
}
