import { NextResponse } from 'next/server';
import { getMine } from '@/lib/store';

// GET /api/me?token=xxx&phone=xxx 找回“我发起/接力的记录”
// 我发起的：token 或 手机号命中（跨设备）；我接力的：仅 token
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const phone = url.searchParams.get('phone');
  if (!token) {
    return NextResponse.json({ error: 'invalid_input', message: '缺少 token' }, { status: 400 });
  }
  return NextResponse.json(getMine(token, phone));
}
