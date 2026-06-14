// pm2 进程配置：在服务器上守护 Next.js 生产进程
// 用法：pm2 start ecosystem.config.js  /  pm2 reload helpme
// 敏感配置（ADMIN_KEY）与数据库路径放在服务器的 .env.local（不进 git），Next.js 启动时自动读取
module.exports = {
  apps: [
    {
      name: 'helpme',
      // 直接拉起 Next 的生产服务器，避免依赖 pnpm 在 pm2 环境里的路径
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
