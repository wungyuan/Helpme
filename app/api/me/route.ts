import { NextResponse } from 'next/server';
import { getMine } from '@/lib/store';

// GET /api/me?token=xxx 凭浏览器匿名 token 找回“我发起/接力的记录”
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'invalid_input', message: '缺少 token' }, { status: 400 });
  }
  return NextResponse.json(getMine(token));
}
