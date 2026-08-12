import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// server/src -> server -> 项目根
const ROOT_DIR = path.resolve(__dirname, '..', '..');

/** 笔记数据源目录（可用环境变量 NOTE_DIR 覆盖，便于服务器上放任意路径） */
export const NOTE_DIR = path.resolve(process.env.NOTE_DIR || path.join(ROOT_DIR, 'note'));

/** 服务端口 */
export const PORT = process.env.PORT || 3000;

/**
 * 分类自定义排序（按学习路径）。
 * 未列出的分类排在后面，按字母序兜底。
 */
export const CATEGORY_ORDER = [
  'JavaSE',
  'Web',
  'Database',
  'SpringBoot',
  'Vue',
  'Git',
  'Linux',
  'Productivity',
];
