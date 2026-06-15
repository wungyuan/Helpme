import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { CONTENT_TYPE_BY_EXT, uploadDir } from '@/lib/uploads';

// GET /api/uploads/:name  读取并返回上传的图片
export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  // 防目录穿越：只允许 [A-Za-z0-9_-].ext
  if (!/^[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(name)) {
    return new NextResponse('not found', { status: 404 });
  }
  const file = path.join(uploadDir(), name);
  if (!fs.existsSync(file)) {
    return new NextResponse('not found', { status: 404 });
  }
  const ext = name.split('.').pop()!;
  const data = fs.readFileSync(file);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
