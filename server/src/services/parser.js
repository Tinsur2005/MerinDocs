import path from 'node:path';
import fs from 'node:fs/promises';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import { NOTE_DIR } from '../config.js';
import { toUrlPath, safeDecode } from '../utils/path.js';

// Vue 单文件组件：highlight.js 没有 vue 语法，注册为 xml（html）语法，
// 模板标签高亮，<script>/<style> 里的 JS/CSS 会被内嵌规则自动高亮
hljs.registerAliases(['vue'], { languageName: 'xml' });

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(code, lang) {
    let highlighted;
    let langName = '';
    if (lang && hljs.getLanguage(lang)) {
      try {
        highlighted = hljs.highlight(code, { language: lang }).value;
        langName = lang;
      } catch {
        /* fallthrough to auto */
      }
    }
    if (!highlighted) {
      highlighted = hljs.highlightAuto(code).value;
    }
    return `<pre class="hljs" data-lang="${langName}"><code>${highlighted}</code></pre>`;
  },
});

// 自定义图片渲染：解码中文路径，按 md 文件位置解析，重写为 /assets/...
md.renderer.rules.image = (tokens, idx, options, env) => {
  const token = tokens[idx];
  const srcIndex = token.attrIndex('src');
  const alt = token.content || '';

  if (srcIndex < 0) {
    return `<img alt="${md.utils.escapeHtml(alt)}">`;
  }

  const rawSrc = token.attrs[srcIndex][1];
  const decoded = safeDecode(rawSrc);
  const baseDir = env && env.filePath ? path.dirname(env.filePath) : NOTE_DIR;
  const absPath = path.resolve(baseDir, decoded);
  const relToNote = path.relative(NOTE_DIR, absPath);

  // 防止路径穿越到 note 目录之外
  if (relToNote.startsWith('..') || path.isAbsolute(relToNote)) {
    return `<img alt="${md.utils.escapeHtml(alt)}">`;
  }

  // relToNote 形如 "assets/1-Java介绍/xxx.png"，挂载点为 /assets -> note/assets
  const newSrc = '/' + toUrlPath(relToNote);
  return `<img src="${newSrc}" alt="${md.utils.escapeHtml(alt)}">`;
};

// 自定义标题渲染：为标题生成 id，并收集到 env.toc 用于右侧目录
md.renderer.rules.heading_open = (tokens, idx, options, env) => {
  const token = tokens[idx];
  const level = Number(token.tag.slice(1));
  const inline = tokens[idx + 1];
  const rawText = inline && inline.type === 'inline' ? inline.content : '';
  const text = rawText.replace(/\*\*|`/g, '').trim();
  const id = `toc-${env.toc ? env.toc.length : 0}`;
  if (env.toc) env.toc.push({ level, text, id });
  return `<h${level} id="${id}">`;
};

/** 渲染 Markdown，返回 HTML 与目录结构 */
export function renderMarkdown(content, filePath) {
  // ① 开头 ** 后带空格的 ** 文字**：markdown-it 视其为 non-flanking，变成字面量。
  //    去掉开头 ** 后的空格；排除 /**（Java 注释）与 ** 文字 **（gitignore 通配符等字面量）。
  //    约束：结束 ** 必须是本行最后一个 **（?=[^\n*]*$），否则会把下一个粗体的开头 ** 误当结束。
  content = content.replace(
    /(?<![\p{L}\p{N}\/])\*\*[ ]+([^\n*]*[^\n*\s])\*\*(?=[^\n*]*$)/gmu,
    '**$1**'
  );

  // ② 结束 ** 前是标点、后又紧跟字母/数字的 **text标点**后文：会被判定为 non-flanking。
  //    用 Unicode 标点 \p{P} 覆盖全部标点（含中文括号 ）】》 等），
  //    仅在后续紧跟字母/数字时于结束 ** 后补一个空格，让 strong 能正确闭合。
  //    约束：① [^\n*]+ 禁止跨行/跨越其他 **；② 结束 ** 必须是本行最后一个 **
  //    （?=[\p{L}\p{N}][^\n*]*$），避免把「下一段粗体的开头 **」误当结束而污染文本。
  content = content.replace(/(\*\*[^\n*]+[\p{P}])\*\*(?=[\p{L}\p{N}][^\n*]*$)/gmu, '$1** ');

  const env = { filePath, toc: [] };
  const html = md.render(content, env);
  return { html, toc: env.toc };
}

/** 渲染缓存：key = 文件绝对路径，value = { mtimeMs, title, html, toc } */
const renderCache = new Map();

/**
 * 渲染一个 md 文件并缓存结果。
 * 文件修改时间变化时自动重新渲染；重复请求直接返回缓存，
 * 大幅加快长文 / 多图 / 多代码块页面的打开速度。
 */
export async function renderFile(absPath) {
  const stat = await fs.stat(absPath);
  const cached = renderCache.get(absPath);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached;

  const content = await fs.readFile(absPath, 'utf-8');
  const { html, toc } = renderMarkdown(content, absPath);
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const entry = {
    mtimeMs: stat.mtimeMs,
    title: titleMatch ? titleMatch[1].trim() : '',
    html,
    toc,
  };
  renderCache.set(absPath, entry);
  return entry;
}

/** 清空渲染缓存（笔记更新后配合目录扫描缓存一起清） */
export function clearRenderCache() {
  renderCache.clear();
}
