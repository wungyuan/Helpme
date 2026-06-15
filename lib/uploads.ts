import path from 'node:path';

// 上传文件目录：默认放在数据库同级的 uploads/（持久、在仓库目录之外），可用 UPLOAD_DIR 覆盖
export function uploadDir(): string {
  if (process.env.UPLOAD_DIR) return process.env.UPLOAD_DIR;
  const dbPath = process.env.DB_PATH;
  const base = dbPath ? path.dirname(dbPath) : path.join(process.cwd(), 'data');
  return path.join(base, 'uploads');
}

export const IMAGE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};
