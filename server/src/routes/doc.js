import { Router } from 'express';
import path from 'node:path';
import { NOTE_DIR } from '../config.js';
import { scanTree, getFlatList, clearCache } from '../services/scanner.js';
import { renderFile, clearRenderCache } from '../services/parser.js';
import { searchNotes, clearSearchCache } from '../services/search.js';
import { getSiteConfig } from '../services/siteConfig.js';
import { getLockRemaining, recordFailure, resetFailures } from '../services/rateLimit.js';
import { hashPassword, verifyPassword } from '../utils/protect.js';

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

/** 加载文档并组装标题/分类/上下篇；路径不合法抛 403 */
async function loadDoc(relPath) {
  const absPath = path.resolve(NOTE_DIR, relPath);
  if (!absPath.startsWith(NOTE_DIR)) {
    const err = new Error('forbidden');
    err.status = 403;
    throw err;
  }

  const entry = await renderFile(absPath);
  const title = entry.title || path.basename(relPath, '.md');

  const flat = await getFlatList();
  const idx = flat.findIndex((f) => f.path === relPath);
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;

  return { entry, title, category: relPath.split('/')[0], prev, next };
}

/** 锁定状态：只返回侧栏已可见的信息，不含 html/toc */
function lockedPayload(d) {
  return { locked: true, title: d.title, category: d.category, prev: d.prev, next: d.next };
}

/** 解锁后的完整响应；加密文档附带密码令牌供前端持久化 */
function fullPayload(d) {
  return {
    locked: false,
    title: d.title,
    category: d.category,
    html: d.entry.html,
    toc: d.entry.toc,
    prev: d.prev,
    next: d.next,
    token: d.entry.password ? hashPassword(d.entry.password) : undefined,
  };
}

/** 文档内容：返回解析后的 HTML、目录、上下篇；加密文档需携带有效密码令牌 */
router.get('/doc', async (req, res) => {
  try {
    const relPath = req.query.path;
    if (!relPath) {
      return res.status(400).json({ error: 'missing path param' });
    }

    const data = await loadDoc(relPath);
    if (data.entry.password && hashPassword(data.entry.password) !== String(req.query.token || '')) {
      return res.json(lockedPayload(data));
    }
    res.json(fullPayload(data));
  } catch (e) {
    res.status(e.status || 404).json({ error: e.message });
  }
});

/** 解锁加密文档：校验密码，通过后返回完整内容与密码令牌 */
router.post('/unlock', async (req, res) => {
  try {
    const relPath = req.body && req.body.path;
    const password = String((req.body && req.body.password) || '');
    if (!relPath) {
      return res.status(400).json({ error: 'missing path param' });
    }

    // 冷却中（含刚刷新页面后再次提交）：以服务端剩余时间为准，直接拒绝
    const limitKey = `${req.ip}|${relPath}`;
    const remaining = getLockRemaining(limitKey);
    if (remaining > 0) {
      return res
        .status(429)
        .json({ error: '尝试过于频繁，请稍后再试', retryAfter: Math.ceil(remaining / 1000) });
    }

    const data = await loadDoc(relPath);
    if (!data.entry.password || !verifyPassword(password, data.entry.password)) {
      const { count, retryAfter } = recordFailure(limitKey);
      if (retryAfter > 0) {
        return res.status(429).json({
          error: `连续输错 ${count} 次，请冷却后再试`,
          retryAfter: Math.ceil(retryAfter / 1000),
        });
      }
      return res.status(401).json({ error: '密码错误', attempts: count });
    }
    resetFailures(limitKey);
    res.json(fullPayload(data));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
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
