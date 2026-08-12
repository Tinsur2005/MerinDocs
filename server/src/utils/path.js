import path from 'node:path';

/**
 * 解析文件名：提取数字前缀用于排序，name 保留完整文件名（含序号）。
 * "1-Java介绍" -> { order: 1, name: "1-Java介绍" }
 * "Java介绍"   -> { order: 999, name: "Java介绍" }
 */
export function parseFileName(fileName) {
  const base = fileName.replace(/\.md$/i, '');
  const m = base.match(/^(\d+)[-_\s.]?(.*)$/);
  if (m) {
    return { order: parseInt(m[1], 10), name: base };
  }
  return { order: 999, name: base };
}

/** 本地路径分隔符转 URL 斜杠 */
export function toUrlPath(p) {
  return p.split(path.sep).join('/');
}

/** 安全解码 URI 组件，失败时返回原值 */
export function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
