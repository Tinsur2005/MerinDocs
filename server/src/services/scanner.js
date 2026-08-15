import fs from 'node:fs/promises';
import path from 'node:path';
import { NOTE_DIR, CATEGORY_ORDER } from '../config.js';
import { parseFileName } from '../utils/path.js';

let cache = null;

/**
 * 扫描 note 目录，构建分类导航树（结果内存缓存）。
 * 支持文件夹嵌套：note/A -> A/B -> A/B/C，递归实现，天然支持三层及更多层。
 * 节点统一为 { type, name, order, path, ... }：
 *   - 文件夹：{ type: 'dir', name, order, path, children }
 *   - 文档：  { type: 'file', name, order, path, redirect }
 * 顶层只收集文件夹（README.md 是首页，不进导航树）；嵌套层同时收集子文件夹与 md 文档。
 */
export async function scanTree() {
  if (cache) return cache;
  const categories = await scanDir(NOTE_DIR, '', 0);
  cache = categories;
  return categories;
}

/** 递归扫描一层目录：返回该目录下排序后的 子文件夹 + md 文档 节点 */
async function scanDir(dirPath, relPath, depth) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const nodes = [];
  for (const entry of entries) {
    if (entry.name === 'assets') continue; // 资源目录，不作为分类
    const childRel = relPath ? `${relPath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const children = await scanDir(path.join(dirPath, entry.name), childRel, depth + 1);
      if (children.length === 0) continue; // 空目录不展示
      const { order, name } = parseFileName(entry.name);
      nodes.push({ type: 'dir', name, order, path: childRel, children });
    } else if (depth > 0 && entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      const { order, name } = parseFileName(entry.name);

      // 读取内容，检测"整份文件只有一行 URL"的链接型笔记
      let redirect = null;
      try {
        const content = await fs.readFile(path.join(dirPath, entry.name), 'utf-8');
        redirect = extractRedirect(content);
      } catch {
        // 读不到内容就当普通文档
      }

      nodes.push({ type: 'file', name, order, path: childRel, redirect });
    }
  }
  nodes.sort(sortNodes(depth));
  return nodes;
}

/** 顶层按 CATEGORY_ORDER 自定义排序，嵌套层按文件名数字前缀排序（文件夹优先） */
function sortNodes(depth) {
  return (a, b) => {
    if (depth === 0) {
      return getCategoryOrder(a.name) - getCategoryOrder(b.name) || a.name.localeCompare(b.name);
    }
    return (
      a.order - b.order ||
      (a.type === b.type ? 0 : a.type === 'dir' ? -1 : 1) ||
      a.name.localeCompare(b.name)
    );
  };
}

/**
 * 若整份内容只有一行 URL（去掉空行后），返回该 URL；否则返回 null。
 * 支持裸链接 http(s)://... 和 markdown 链接 [文字](http(s)://...)。
 */
function extractRedirect(content) {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length !== 1) return null;

  const line = lines[0];
  if (/^https?:\/\/\S+$/i.test(line)) return line;
  const m = line.match(/^\[([^\]]*)\]\((https?:\/\/\S+)\)$/);
  if (m) return m[2];
  return null;
}

function getCategoryOrder(name) {
  const idx = CATEGORY_ORDER.indexOf(name);
  return idx === -1 ? 1000 : idx;
}

/** 清空扫描缓存（新增笔记后调用） */
export function clearCache() {
  cache = null;
}

/**
 * 扁平化文档列表（按目录树深度优先 + 分类顺序），用于上一篇/下一篇导航。
 * category 取文件所属的最顶层文件夹。
 */
export async function getFlatList() {
  const tree = await scanTree();
  const list = [];
  const walk = (nodes) => {
    for (const n of nodes) {
      if (n.type === 'file') {
        list.push({ ...n, category: n.path.split('/')[0] });
      } else if (n.children) {
        walk(n.children);
      }
    }
  };
  walk(tree);
  return list;
}
