import crypto from 'node:crypto';
import { SESSION_TTL_DAYS, AUTH_DEV_USER } from '../config.js';

/**
 * 笔记站独立登录会话（授权码模式）：
 * WP 授权换得用户信息后由本服务建立自己的会话，与 WordPress 登录态互不影响。
 * 单实例 pm2 部署，会话存内存即可；进程重启需重新授权登录。
 */

export const SESSION_COOKIE = 'merin_sid';
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 3600 * 1000;

// sid -> { user, expires }
const sessions = new Map();

/** 极简 Cookie 头解析（未引入 cookie-parser） */
export function parseCookies(req) {
  const out = {};
  const header = req.headers.cookie;
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (key) out[key] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function sessionCookie(req, sid, maxAgeSec) {
  const parts = [
    `${SESSION_COOKIE}=${sid}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
  ];
  if (req.protocol === 'https') parts.push('Secure');
  return parts.join('; ');
}

/** 建立会话并写入会话 Cookie */
export function createSession(req, res, user) {
  const sid = crypto.randomBytes(32).toString('hex');
  sessions.set(sid, { user, expires: Date.now() + SESSION_TTL_MS });
  res.append('Set-Cookie', sessionCookie(req, sid, Math.floor(SESSION_TTL_MS / 1000)));
  return sid;
}

/** 读取当前会话用户；过期/不存在返回 null */
export function getSessionUser(req) {
  if (AUTH_DEV_USER) {
    return { id: 0, name: AUTH_DEV_USER, displayName: AUTH_DEV_USER, roles: ['administrator'] };
  }
  const sid = parseCookies(req)[SESSION_COOKIE];
  if (!sid) return null;
  const s = sessions.get(sid);
  if (!s) return null;
  if (s.expires <= Date.now()) {
    sessions.delete(sid);
    return null;
  }
  return s.user;
}

/** 销毁会话并清除 Cookie（仅退出笔记站，不触碰 WordPress） */
export function destroySession(req, res) {
  const sid = parseCookies(req)[SESSION_COOKIE];
  if (sid) sessions.delete(sid);
  res.append('Set-Cookie', sessionCookie(req, '', 0));
}

// 惰性清理过期会话，避免长期运行后残留
setInterval(() => {
  const now = Date.now();
  for (const [sid, s] of sessions) {
    if (s.expires <= now) sessions.delete(sid);
  }
}, 3600 * 1000).unref();
