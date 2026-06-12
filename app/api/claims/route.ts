import { NextResponse } from 'next/server';
import { createClaim, StoreError } from '@/lib/store';

// POST /api/claims 认领：我是目标 / 我能帮上忙
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { parentNodeId, visitorToken, nickname, relationStrength, claimType, contact, message } = body ?? {};
  if (
    !parentNodeId ||
    !visitorToken ||
    !nickname?.trim() ||
    !contact?.trim() ||
    ![1, 2, 3].includes(relationStrength) ||
    !['is_target', 'can_help'].includes(claimType)
  ) {
    return NextResponse.json(
      { error: 'invalid_input', message: '请填写昵称、联系方式并选择关系强度' },
      { status: 400 }
    );
  }
  try {
    const { claim } = createClaim({
      parentNodeId,
      visitorToken,
      nickname: nickname.trim(),
      relationStrength,
      claimType,
      contact: contact.trim(),
      message: message?.trim() || null,
    });
    return NextResponse.json({ claimId: claim.id });
  } catch (err) {
    if (err instanceof StoreError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 400 });
    }
    throw err;
  }
}
