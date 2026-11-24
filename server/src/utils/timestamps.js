import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { NOTE_DIR } from '../config.js';

const pExecFile = promisify(execFile);

/**
 * 笔记发布/更新时间。
 * 笔记目录是 git 仓库时：发布时间取文件首次提交时间，更新时间取最近一次提交时间；
 * 非 git 环境（未装 git / 压缩包部署 / 文件未提交）回退到文件 birthtime/mtime。
 * 结果按文件 mtime 缓存，文件变更后自动重取。
 */
const cache = new Map();

function toIso(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function gitDate(args, pick) {
  const { stdout } = await pExecFile('git', ['-C', NOTE_DIR, ...args], {
    timeout: 4000,
    windowsHide: true,
  });
  const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
  const line = lines.length ? pick(lines) : '';
  return line ? toIso(line) : null;
}

/** 取笔记的发布时间/更新时间（ISO 字符串） */
export async function getTimestamps(relPath, absPath) {
  const stat = await fs.stat(absPath);
  const cached = cache.get(absPath);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.value;

  const relPosix = relPath.split(path.sep).join('/');
  let publishedAt = null;
  let updatedAt = null;
  try {
    const [added, latest] = await Promise.allSettled([
      // --follow 覆盖文件改名前的历史；取最早一条（文件加入仓库的提交）
      gitDate(
        ['log', '--diff-filter=A', '--follow', '-n', '1', '--format=%aI', '--', relPosix],
        (lines) => lines[lines.length - 1]
      ),
      gitDate(['log', '-1', '--format=%aI', '--', relPosix], (lines) => lines[0]),
    ]);
    if (added.status === 'fulfilled') publishedAt = added.value;
    if (latest.status === 'fulfilled') updatedAt = latest.value;
  } catch {
    // git 不可用时走文件时间回退
  }

  if (!publishedAt) {
    const birth = stat.birthtimeMs && stat.birthtimeMs > 0 ? stat.birthtime : stat.mtime;
    publishedAt = toIso(birth);
  }
  if (!updatedAt) updatedAt = toIso(stat.mtime);

  const value = { publishedAt, updatedAt };
  cache.set(absPath, { mtimeMs: stat.mtimeMs, value });
  return value;
}

/** 清空时间缓存（配合 /api/refresh） */
export function clearTimestampCache() {
  cache.clear();
}
