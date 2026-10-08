import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { NOTE_DIR } from '../config.js';
import { getFlatList } from './scanner.js';
import { extractPassword } from '../utils/protect.js';

/**
 * 全库全局搜索：在 note 目录所有 md 笔记中按关键词（空格分隔、需全部命中）
 * 匹配标题或正文，返回带摘要与所属分类的命中列表。
 */

/** 原始文本缓存：key = 绝对路径，value = { mtimeMs, text }，文件修改后自动失效 */
const textCache = new Map();

async function getText(absPath) {
  const stat = await fs.stat(absPath);
  const cached = textCache.get(absPath);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.text;
  const text = await fs.readFile(absPath, 'utf-8');
  textCache.set(absPath, { mtimeMs: stat.mtimeMs, text });
  return text;
}

/** 清空文本缓存（配合 /api/refresh） */
export function clearSearchCache() {
  textCache.clear();
  pdfTextCache.clear();
}

// ---- PDF 文本提取（pdfjs-dist，惰性加载）----
const require = createRequire(import.meta.url);

// 标准字体数据目录：未嵌入字体的 PDF 提取文本时用于推断字间距。
// Node 字体工厂直接 fs.readFile，这里给文件系统路径（不能用 file:// URL）
let standardFontDataUrl = '';
try {
  standardFontDataUrl =
    path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts') + path.sep;
} catch {
  standardFontDataUrl = '';
}

let pdfjsPromise;
function loadPdfjs() {
  if (!pdfjsPromise) {
    // Node 端走主线程"伪 worker"即可，解析失败由调用方降级为仅标题可搜
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs').catch(() => null);
  }
  return pdfjsPromise;
}

/** PDF 提取文本缓存：key = 绝对路径，value = { mtimeMs, text }（text 为 null 表示无法提取） */
const pdfTextCache = new Map();

async function getPdfText(absPath) {
  const stat = await fs.stat(absPath);
  const cached = pdfTextCache.get(absPath);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached;

  const entry = { mtimeMs: stat.mtimeMs, text: null };
  try {
    const pdfjs = await loadPdfjs();
    if (pdfjs) {
      const buf = await fs.readFile(absPath);
      const task = pdfjs.getDocument({
        data: new Uint8Array(buf),
        isEvalSupported: false,
        standardFontDataUrl,
      });
      const pdf = await task.promise;
      const parts = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        for (const item of content.items) {
          if (item.str) parts.push(item.str);
        }
        parts.push('\n');
        page.cleanup();
      }
      await pdf.destroy();
      entry.text = parts.join(' ').replace(/[ \t]+/g, ' ').trim();
    }
  } catch {
    // 加密 / 损坏 PDF：保持 null，仅标题可搜
  }
  pdfTextCache.set(absPath, entry);
  return entry;
}

function tokenize(query) {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/** 摘取第一个命中关键词附近的一段文字作为摘要 */
function makeSnippet(text, term, radius = 30, maxLen = 90) {
  const idx = text.toLowerCase().indexOf(term);
  if (idx < 0) return '';
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + term.length + radius);
  const raw = text.slice(start, end).replace(/\s+/g, ' ').replace(/[#*`>|]+/g, '').trim();
  return (start > 0 ? '…' : '') + raw + (end < text.length ? '…' : '');
}

/**
 * 定位 firstIdx 所在的小节：返回它之前出现的标题个数（即 toc 数组下标，锚点 id 为 `toc-${n}`）。
 * 跳过围栏代码块里的假标题；没有任何标题覆盖时返回 null（前端跳到文章顶部）。
 */
function findAnchorIndex(text, firstIdx) {
  const lines = text.split('\n');
  let offset = 0;
  let inFence = false;
  let current = null;
  let headingCount = 0;
  for (const line of lines) {
    const lineStart = offset;
    const lineEnd = offset + line.length + 1; // 含换行符
    if (/^\s{0,3}(```|~~~)/.test(line)) {
      inFence = !inFence; // 围栏开始/结束行本身不算标题，围栏内的 # 只是代码
      if (firstIdx < lineEnd) return current;
      offset = lineEnd;
      continue;
    }
    if (!inFence && /^\s{0,3}#{1,6}\s+/.test(line)) {
      if (lineStart <= firstIdx) current = headingCount;
      headingCount++;
    }
    if (firstIdx < lineEnd) return current;
    offset = lineEnd;
  }
  return current;
}

export async function searchNotes(query) {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const list = await getFlatList();
  const results = [];

  for (const file of list) {
    const name = file.name.toLowerCase();

    // 链接型笔记（内容只有一行 URL）：只按文件名匹配
    if (file.redirect) {
      if (!terms.every((t) => name.includes(t))) continue;
      results.push({
        path: file.path,
        title: file.name,
        category: file.category,
        snippet: file.redirect,
        redirect: file.redirect,
        titleHit: true,
        firstIdx: 0,
      });
      continue;
    }

    // PDF：提取正文后按普通文本匹配；提取失败（无依赖 / 加密 PDF）仅标题可搜
    if (file.kind === 'pdf') {
      const extracted = await getPdfText(path.join(NOTE_DIR, file.path));
      if (!extracted.text) {
        if (!terms.every((t) => name.includes(t))) continue;
        results.push({
          path: file.path,
          title: file.name,
          category: file.category,
          snippet: '',
          redirect: null,
          kind: 'pdf',
          titleHit: true,
          firstIdx: 0,
          anchor: null,
        });
        continue;
      }

      const text = extracted.text;
      const lower = text.toLowerCase();
      if (!terms.every((t) => lower.includes(t)) && !terms.every((t) => name.includes(t))) {
        continue;
      }
      const titleHit = terms.some((t) => name.includes(t));
      let firstIdx = Infinity;
      for (const t of terms) {
        const idx = lower.indexOf(t);
        if (idx !== -1 && idx < firstIdx) firstIdx = idx;
      }
      const term = terms.reduce((a, b) => (lower.indexOf(a) <= lower.indexOf(b) ? a : b), terms[0]);
      results.push({
        path: file.path,
        title: file.name,
        category: file.category,
        snippet: makeSnippet(text, term),
        redirect: null,
        kind: 'pdf',
        titleHit,
        firstIdx: firstIdx === Infinity ? 0 : firstIdx,
        // PDF 无标题小节锚点，前端直接打开文档
        anchor: null,
      });
      continue;
    }

    let raw;
    try {
      raw = await getText(path.join(NOTE_DIR, file.path));
    } catch {
      continue; // 读不到（已删除 / 无权限）则跳过
    }

    // 加密文档：仅按文件名匹配，不索引、不返回任何正文片段
    const { password, body } = extractPassword(raw);
    if (password) {
      if (!terms.every((t) => name.includes(t))) continue;
      results.push({
        path: file.path,
        title: file.name,
        category: file.category,
        snippet: '',
        redirect: null,
        locked: true,
        titleHit: true,
        firstIdx: 0,
        anchor: null,
      });
      continue;
    }

    const text = body;
    const lower = text.toLowerCase();
    if (!terms.every((t) => lower.includes(t)) && !terms.every((t) => name.includes(t))) {
      continue;
    }

    // 排序依据：标题命中优先；其次按正文首次命中的位置
    const titleHit = terms.some((t) => name.includes(t));
    let firstIdx = Infinity;
    for (const t of terms) {
      const idx = lower.indexOf(t);
      if (idx !== -1 && idx < firstIdx) firstIdx = idx;
    }

    // 正文里出现最早的那个关键词作为摘要中心
    const term = terms.reduce((a, b) => (lower.indexOf(a) <= lower.indexOf(b) ? a : b), terms[0]);
    results.push({
      path: file.path,
      title: file.name,
      category: file.category,
      snippet: makeSnippet(text, term),
      redirect: null,
      titleHit,
      firstIdx: firstIdx === Infinity ? 0 : firstIdx,
      // 命中所在小节（toc 下标），供前端跳转定位；仅标题命中时无正文锚点
      anchor: firstIdx === Infinity ? null : findAnchorIndex(text, firstIdx),
    });
  }

  results.sort(
    (a, b) =>
      Number(b.titleHit) - Number(a.titleHit) ||
      a.firstIdx - b.firstIdx ||
      a.title.localeCompare(b.title, 'zh')
  );

  return results.slice(0, 50);
}
