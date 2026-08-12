import fs from 'node:fs/promises';
import path from 'node:path';
import { NOTE_DIR, CATEGORY_ORDER } from '../config.js';
import { parseFileName } from '../utils/path.js';

let cache = null;

/** 扫描 note 目录，构建分类导航树（结果内存缓存） */
export async function scanTree() {
  if (cache) return cache;

  const entries = await fs.readdir(NOTE_DIR, { withFileTypes: true });
  const categories = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'assets') continue; // 资源目录，不作为分类

    const dirPath = path.join(NOTE_DIR, entry.name);
    const files = await scanCategory(dirPath, entry.name);
    if (files.length === 0) continue;

    categories.push({
      name: entry.name,
      order: getCategoryOrder(entry.name),
      files,
    });
  }

  categories.sort((a, b) => a.order - b.order);
  cache = categories;
  return categories;
}

async function scanCategory(dirPath, categoryName) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) continue;
    const { order, name } = parseFileName(entry.name);

    // 读取内容，检测"整份文件只有一行 URL"的链接型笔记
    let redirect = null;
    try {
      const content = await fs.readFile(path.join(dirPath, entry.name), 'utf-8');
      redirect = extractRedirect(content);
    } catch {
      // 读不到内容就当普通文档
    }

    files.push({
      name,
      order,
      path: `${categoryName}/${entry.name}`,
      redirect,
    });
  }
  files.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return files;
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

/** 扁平化文件列表（按分类顺序），用于上一篇/下一篇导航 */
export async function getFlatList() {
  const tree = await scanTree();
  const list = [];
  for (const cat of tree) {
    for (const file of cat.files) {
      list.push({ ...file, category: cat.name });
    }
  }
  return list;
}
