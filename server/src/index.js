import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NOTE_DIR, PORT } from './config.js';
import docRouter from './routes/doc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

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
if (fs.existsSync(INDEX_HTML)) {
  app.use(express.static(WEB_DIST));
  // SPA history 回退：非 /api、/assets 的 GET 一律回退到 index.html，
  // 否则刷新 /doc/xxx 这类前端路由会 404
  app.get(/^\/(?!api|assets)/, (req, res) => {
    res.sendFile(INDEX_HTML);
  });
  console.log(`[MerinDocs] serving frontend from ${WEB_DIST}`);
} else {
  console.log('[MerinDocs] 未找到前端构建产物(web/dist)，仅提供 API（开发模式）');
}

app.listen(PORT, () => {
  console.log(`[MerinDocs] server running at http://localhost:${PORT}`);
  console.log(`[MerinDocs] note dir: ${NOTE_DIR}`);
});
