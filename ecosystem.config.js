// pm2 生产守护配置：pm2 start ecosystem.config.js
// 只守护后端 Node 进程（后端已托管前端页面 + API + 图片 + SPA 回退）
module.exports = {
  apps: [
    {
      name: 'merin-docs',
      script: './server/src/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000, // 改端口在这里改，改完 pm2 restart merin-docs
      },
    },
  ],
};
