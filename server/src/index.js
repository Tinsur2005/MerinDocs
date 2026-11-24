import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NOTE_DIR, PORT } from './config.js';
import docRouter from './routes/doc.js';
import { getSiteConfig } from './services/siteConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// nginx 反代一跳：信任 X-Forwarded-*，req.ip 取真实客户端 IP（解锁冷却按 IP 计数）
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

// 静态图片资源：note/assets -> /assets/...
// 浏览器请求中文路径时会自动百分号编码，express.static 会自动解码匹配磁盘文件
app.use(
  '/assets',
  express.static(path.join(NOTE_DIR, 'assets'), {
    fallthrough: true,
  })
);

// API 路由
app.use('/api', docRouter);

// 生产模式：托管前端构建产物（web/dist），单端口运行
const WEB_DIST = path.resolve(__dirname, '..', '..', 'web', 'dist');
const INDEX_HTML = path.join(WEB_DIST, 'index.html');

// 首屏 title 服务端注入：index.html 里的标题是写死的默认值，若交给前端等
// /api/site-config 返回后再改，标签页会先闪一下默认标题。这里在返回 HTML
// 前就把 <title> 替换成 site.config.json 里的 siteTitle，浏览器首帧即正确。
let htmlTemplate = null;
let htmlTemplateMtime = 0;

function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(str).replace(/[&<>"']/g, (c) => map[c]);
}

async function renderIndexHtml() {
  // 模板按 mtime 缓存，前端重新构建后自动失效
  const stat = await fs.promises.stat(INDEX_HTML);
  if (!htmlTemplate || htmlTemplateMtime !== stat.mtimeMs) {
    htmlTemplate = await fs.promises.readFile(INDEX_HTML, 'utf-8');
    htmlTemplateMtime = stat.mtimeMs;
  }
  const cfg = await getSiteConfig();
  const title = typeof cfg.siteTitle === 'string' ? cfg.siteTitle.trim() : '';
  if (!title) return htmlTemplate;
  return htmlTemplate.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
}

if (fs.existsSync(INDEX_HTML)) {
  // 统一出口：返回注入 title 后的 HTML；配置改完刷新即生效，HTML 不能被缓存住
  const sendIndexHtml = async (req, res) => {
    try {
      res.set('Cache-Control', 'no-cache').type('html').send(await renderIndexHtml());
    } catch (e) {
      console.error('[MerinDocs] 渲染 index.html 失败：', e.message);
      res.sendFile(INDEX_HTML);
    }
  };

  // 首页与 index.html 必须排在静态中间件之前：express.static 会把 /index.html 原样吐出，
  // 绕过 title 注入（index: false 只对目录请求生效）
  app.get(['/', '/index.html'], sendIndexHtml);

  app.use(express.static(WEB_DIST, { index: false }));

  // SPA history 回退：非 /api、/assets 的 GET 一律回退到 index.html，
  // 否则刷新 /doc/xxx 这类前端路由会 404
  app.get(/^\/(?!api|assets)/, sendIndexHtml);

  console.log(`[MerinDocs] serving frontend from ${WEB_DIST}`);
} else {
  console.log('[MerinDocs] 未找到前端构建产物(web/dist)，仅提供 API（开发模式）');
}

app.listen(PORT, () => {
  console.log(`[MerinDocs] server running at http://localhost:${PORT}`);
  console.log(`[MerinDocs] note dir: ${NOTE_DIR}`);
});
