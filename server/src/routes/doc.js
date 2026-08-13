import { Router } from 'express';
import path from 'node:path';
import { NOTE_DIR } from '../config.js';
import { scanTree, getFlatList, clearCache } from '../services/scanner.js';
import { renderFile, clearRenderCache } from '../services/parser.js';
import { searchNotes, clearSearchCache } from '../services/search.js';
import { getSiteConfig } from '../services/siteConfig.js';

const router = Router();

/** 目录树 */
router.get('/tree', async (req, res) => {
  try {
    const categories = await scanTree();
    res.json({ categories });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** 首页：渲染 note/README.md */
router.get('/home', async (req, res) => {
  try {
    const absPath = path.join(NOTE_DIR, 'README.md');
    let entry;
    try {
      entry = await renderFile(absPath);
    } catch {
      return res.json({ exists: false });
    }
    res.json({ exists: true, title: entry.title || '首页', html: entry.html, toc: entry.toc });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** 文档内容：返回解析后的 HTML、目录、上下篇 */
router.get('/doc', async (req, res) => {
  try {
    const relPath = req.query.path;
    if (!relPath) {
      return res.status(400).json({ error: 'missing path param' });
    }

    const absPath = path.resolve(NOTE_DIR, relPath);
    if (!absPath.startsWith(NOTE_DIR)) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const entry = await renderFile(absPath);
    const title = entry.title || path.basename(relPath, '.md');

    const flat = await getFlatList();
    const idx = flat.findIndex((f) => f.path === relPath);
    const prev = idx > 0 ? flat[idx - 1] : null;
    const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;

    const category = relPath.split('/')[0];
    res.json({ title, category, html: entry.html, toc: entry.toc, prev, next });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

/** 站点自定义配置：标题 / 导航按钮 / 页脚备案等（server/site.config.json） */
router.get('/site-config', async (req, res) => {
  try {
    res.json(await getSiteConfig());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** 全库全局搜索：按关键词匹配笔记标题/正文，返回带摘要的命中列表 */
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ query: q, results: [] });
    const results = await searchNotes(q);
    res.json({ query: q, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** 刷新目录扫描缓存 + 渲染缓存 + 搜索文本缓存（新增/修改笔记后调用，无需重启） */
router.post('/refresh', (req, res) => {
  clearCache();
  clearRenderCache();
  clearSearchCache();
  res.json({ ok: true });
});

export default router;
