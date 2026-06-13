import { NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/admin';
import { getAdminStats, type Granularity } from '@/lib/store';

const VALID: Granularity[] = ['day', 'week', 'month', 'year'];

// GET /api/admin/stats?key=xxx&granularity=day|week|month|year
export async function GET(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: 'forbidden', message: '口令错误' }, { status: 403 });
  }
  const g = new URL(req.url).searchParams.get('granularity') as Granularity | null;
  const granularity: Granularity = g && VALID.includes(g) ? g : 'day';
  return NextResponse.json({ granularity, ...getAdminStats(granularity) });
}
