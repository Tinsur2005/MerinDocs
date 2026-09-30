import crypto from 'node:crypto';

// 文档最开头的密码标记：password(密码)，半角/全角括号均可；密码非空、不含括号、不跨行
const PASSWORD_LINE_RE = /^(?:﻿)?password[（(]([^()（）\r\n]+)[)）][ \t]*(?:\r?\n|$)/i;

/** 若首行是密码标记，抽出密码并返回去掉该行后的正文；否则原样返回 */
export function extractPassword(content) {
  const m = PASSWORD_LINE_RE.exec(content);
  if (!m) return { password: null, body: content };
  return { password: m[1], body: content.slice(m[0].length) };
}

/** 密码令牌：验证通过后下发给前端持久化保存，改密码后旧令牌自然失效 */
export function hashPassword(password) {
  return crypto.createHash('sha256').update(password, 'utf8').digest('hex');
}

/** 恒定时间比较，避免密码校验耗时泄露信息 */
export function verifyPassword(input, expected) {
  const a = Buffer.from(input, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
