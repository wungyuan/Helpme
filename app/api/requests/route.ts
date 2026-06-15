import { NextResponse } from 'next/server';
import { createRequest, normalizePhone } from '@/lib/store';

// POST /api/requests 创建求助卡片
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const {
    creatorToken,
    creatorPhone,
    nickname,
    title,
    description,
    imageUrl,
    visibility,
    rewardType,
    rewardNote,
    targetMatchCount,
    deadlineAt,
  } = body ?? {};
  if (!creatorToken || !nickname?.trim() || !title?.trim() || !description?.trim()) {
    return NextResponse.json({ error: 'invalid_input', message: '请填写昵称、标题和描述' }, { status: 400 });
  }
  // 发起人必须留手机号，用于跨设备找回自己的求助
  const phone = normalizePhone(creatorPhone);
  if (phone.length < 6) {
    return NextResponse.json({ error: 'invalid_input', message: '请填写手机号（用于换设备时找回你的求助）' }, { status: 400 });
  }
  if (visibility !== 'private' && visibility !== 'public') {
    return NextResponse.json({ error: 'invalid_input', message: '请选择可见性' }, { status: 400 });
  }
  if (rewardType !== 'paid' && rewardType !== 'friendship') {
    return NextResponse.json({ error: 'invalid_input', message: '请选择求助性质' }, { status: 400 });
  }
  // 终止条件均为可选；匹配数量需为正整数，截止时间需为未来时间戳
  const count = Number.isInteger(targetMatchCount) && targetMatchCount > 0 ? targetMatchCount : null;
  const deadline = typeof deadlineAt === 'number' && deadlineAt > Date.now() ? deadlineAt : null;
  const { request, rootNodeId } = createRequest({
    creatorToken,
    creatorPhone: phone,
    nickname: nickname.trim(),
    title: title.trim(),
    description: description.trim(),
    imageUrl: typeof imageUrl === 'string' && imageUrl.startsWith('/api/uploads/') ? imageUrl : null,
    visibility,
    rewardType,
    rewardNote: rewardNote?.trim() || null,
    targetMatchCount: count,
    deadlineAt: deadline,
  });
  return NextResponse.json({ requestId: request.id, rootNodeId });
}
