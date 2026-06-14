// 确保 better-sqlite3 原生模块已编译。
// 背景：新版 pnpm 默认阻止“依赖”的构建脚本，导致 better-sqlite3 不会自动编译。
// 项目自身的 postinstall 不受该限制，这里在安装后按需编译，本地与服务器一致、可重复。
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);

let pkgJson;
try {
  pkgJson = require.resolve('better-sqlite3/package.json');
} catch {
  // 依赖还没装上（例如某些 CI 阶段），跳过
  console.log('[ensure-better-sqlite3] 未找到依赖，跳过');
  process.exit(0);
}

const dir = dirname(pkgJson);
const binary = join(dir, 'build', 'Release', 'better_sqlite3.node');

if (existsSync(binary)) {
  console.log('[ensure-better-sqlite3] 已编译，跳过');
  process.exit(0);
}

console.log('[ensure-better-sqlite3] 正在编译原生模块…');
execSync('npm run build-release', { cwd: dir, stdio: 'inherit' });
console.log('[ensure-better-sqlite3] 编译完成');
