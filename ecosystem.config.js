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
        // 笔记站对外地址：用于拼 OAuth 回调地址，必须与 WP 插件 redirect_uris 白名单完全一致
        SITE_URL: 'https://note.tinsur.cn',
        // WordPress 授权登录（授权码模式）；WP_CLIENT_SECRET 必须与 WP 插件内配置一致
        WORDPRESS_URL: 'https://www.tinsur.cn',
        WP_CLIENT_ID: 'merindocs',
        WP_CLIENT_SECRET: '92b2bb13f8f750ac9d794fee5f25c244f577286225b764d2',
        // 如服务器访问自身公网域名不通，可取消下一行注释走本机 nginx：
        // WORDPRESS_INTERNAL_URL: 'http://127.0.0.1',
      },
    },
  ],
};
