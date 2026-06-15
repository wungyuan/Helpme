import { NextResponse } from 'next/server';
import { getChainRelation } from '@/lib/store';

// GET /api/nodes/:id/relation?token=xxx 判断访客与这条接力链的关系（不泄露他人信息）
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get('token') ?? '';
  const rel = getChainRelation(id, token);
  if (!rel) {
    return NextResponse.json({ error: 'not_found', message: '节点不存在' }, { status: 404 });
  }
  return NextResponse.json(rel);
}
