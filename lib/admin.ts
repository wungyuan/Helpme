// 开发者后台鉴权：用环境变量 ADMIN_KEY；本地未配置时回退到 'admin' 方便体验
// 生产部署务必设置 ADMIN_KEY 环境变量
export function adminKey(): string {
  return process.env.ADMIN_KEY || 'admin';
}

export function checkAdmin(req: Request): boolean {
  const key = new URL(req.url).searchParams.get('key');
  return key === adminKey();
}
