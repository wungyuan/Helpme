import { NextResponse } from 'next/server';
import { createRequest } from '@/lib/store';

// POST /api/requests 创建求助卡片
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { creatorToken, nickname, title, description, type, targetDesc } = body ?? {};
  if (!creatorToken || !nickname?.trim() || !title?.trim() || !description?.trim()) {
    return NextResponse.json({ error: 'invalid_input', message: '请填写昵称、标题和描述' }, { status: 400 });
  }
  if (type !== 'direct' && type !== 'resource') {
    return NextResponse.json({ error: 'invalid_input', message: '求助类型无效' }, { status: 400 });
  }
  const { request, rootNodeId } = createRequest({
    creatorToken,
    nickname: nickname.trim(),
    title: title.trim(),
    description: description.trim(),
    type,
    targetDesc: targetDesc?.trim() || null,
  });
  return NextResponse.json({ requestId: request.id, rootNodeId });
}
