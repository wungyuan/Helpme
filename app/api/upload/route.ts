import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { IMAGE_EXT, uploadDir } from '@/lib/uploads';

// POST /api/upload  body: { dataUrl: "data:image/jpeg;base64,..." }
// 接收客户端已压缩的图片，落盘到 uploads 目录，返回可访问 URL
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const dataUrl: unknown = body?.dataUrl;
  if (typeof dataUrl !== 'string') {
    return NextResponse.json({ error: 'invalid_input', message: '缺少图片数据' }, { status: 400 });
  }
  const m = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) {
    return NextResponse.json({ error: 'invalid_input', message: '仅支持 jpg/png/webp 图片' }, { status: 400 });
  }
  const ext = IMAGE_EXT[m[1]];
  const buf = Buffer.from(m[2], 'base64');
  // 上限 4MB（客户端应已压缩）
  if (buf.byteLength > 4 * 1024 * 1024) {
    return NextResponse.json({ error: 'too_large', message: '图片过大，请换一张' }, { status: 400 });
  }
  const dir = uploadDir();
  fs.mkdirSync(dir, { recursive: true });
  const name = `${nanoid(16)}.${ext}`;
  fs.writeFileSync(path.join(dir, name), buf);
  return NextResponse.json({ url: `/api/uploads/${name}` });
}
