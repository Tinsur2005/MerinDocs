import { Router } from 'express';
import crypto from 'node:crypto';
import {
  SITE_URL,
  WORDPRESS_URL,
  WORDPRESS_INTERNAL_URL,
  WP_CLIENT_ID,
  WP_CLIENT_SECRET,
  SSO_ENABLED,
} from '../config.js';
import { createSession, destroySession, parseCookies } from '../services/session.js';

const router = Router();

const STATE_COOKIE = 'merin_oauth_state';
const STATE_TTL_MS = 10 * 60 * 1000;
const EXCHANGE_TIMEOUT_MS = 6000;

// state -> { redirect, expires }：发起授权前的站内回跳地址
const pending = new Map();

/** 只接受站内路径：必须以单个 / 开头，排除 // 协议相对 URL 与绝对 URL */
function safeReturnPath(input) {
  if (typeof input !== 'string' || !input.startsWith('/') || input.startsWith('//')) return '/';
  return input;
}

function stateCookie(req, value, maxAgeSec) {
  const parts = [
    `${STATE_COOKIE}=${value}`,
    'Path=/api/auth',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
  ];
  if (req.protocol === 'https') parts.push('Secure');
  return parts.join('; ');
}

/** 笔记站回调地址（必须与 WP 插件白名单中的 redirect_uri 逐字符完全一致） */
function callbackUri(req) {
  // 优先用配置的对外地址：nginx 未透传 Host 头时 req 主机名会变成 127.0.0.1
  const origin = SITE_URL || `${req.protocol}://${req.get('host')}`;
  return `${origin}/api/auth/callback`;
}

/** 当前登录状态（供前端头部展示） */
router.get('/me', (req, res) => {
  res.json({
    ssoEnabled: SSO_ENABLED,
    wpUrl: WORDPRESS_URL,
    loggedIn: Boolean(req.user),
    user: req.user || null,
  });
});

/** 发起授权：生成 state 后跳转 WordPress 授权确认页 */
router.get('/login', (req, res) => {
  if (!SSO_ENABLED) return res.status(503).json({ error: 'SSO 未配置' });
  // 已登录则无需再次授权，直接回原页面
  if (req.user) return res.redirect(302, safeReturnPath(req.query.redirect));

  const state = crypto.randomBytes(16).toString('hex');
  pending.set(state, {
    redirect: safeReturnPath(req.query.redirect),
    expires: Date.now() + STATE_TTL_MS,
  });
  res.append('Set-Cookie', stateCookie(req, state, Math.floor(STATE_TTL_MS / 1000)));

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: WP_CLIENT_ID,
    redirect_uri: callbackUri(req),
    state,
  });
  res.redirect(302, `${WORDPRESS_URL}/merin-sso/authorize/?${params}`);
});

/** 授权回调：用一次性授权码向 WP 换取用户信息，建立本站会话 */
router.get('/callback', async (req, res) => {
  const fail = () => res.redirect(302, '/?sso=error');
  if (!SSO_ENABLED) return res.status(503).json({ error: 'SSO 未配置' });

  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const cookieState = parseCookies(req)[STATE_COOKIE];
  const item = state ? pending.get(state) : null;
  // state 必须与发起时一致（CSRF 防护），且只能使用一次
  if (!state || !cookieState || state.length !== 32 || !item || state !== cookieState) {
    return fail();
  }
  pending.delete(state);
  res.append('Set-Cookie', stateCookie(req, '', 0));
  if (item.expires <= Date.now()) return fail();

  // 用户在授权页点了拒绝
  if (req.query.error) {
    return res.redirect(302, `${item.redirect === '/' ? '/?sso=denied' : item.redirect}`);
  }

  const code = typeof req.query.code === 'string' ? req.query.code : '';
  if (!code) return fail();

  let user = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), EXCHANGE_TIMEOUT_MS);
    // 服务端到服务端：携带 client_secret，浏览器永远接触不到
    const wpHost = new URL(WORDPRESS_URL).host;
    const endpoint = `${WORDPRESS_INTERNAL_URL || WORDPRESS_URL}/merin-sso/exchange/`;
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(WORDPRESS_INTERNAL_URL ? { Host: wpHost } : {}),
      },
      body: new URLSearchParams({
        client_id: WP_CLIENT_ID,
        client_secret: WP_CLIENT_SECRET,
        code,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.id) {
        user = {
          id: data.id,
          name: data.name,
          displayName: data.display_name || data.name,
          roles: data.roles || [],
          avatar: typeof data.avatar === 'string' ? data.avatar.replace(/^\/\//, 'https://') : '',
        };
      }
    } else {
      console.warn(`[MerinDocs][SSO] 授权码换取失败 HTTP ${resp.status}`);
    }
  } catch (e) {
    console.warn(`[MerinDocs][SSO] 请求 WP 换取用户信息失败：${e.message}`);
  }

  if (!user) return fail();
  createSession(req, res, user);
  res.redirect(302, item.redirect);
});

/**
 * 退出笔记站：只销毁本站会话，WordPress 保持登录。
 * 仅接受本站发起的导航，防止第三方页面诱导强制登出。
 */
router.get('/logout', (req, res) => {
  const fetchSite = req.get('sec-fetch-site');
  const fromSameSite =
    fetchSite === 'same-origin' ||
    fetchSite === 'same-site' ||
    (!fetchSite && (req.get('referer') || '').startsWith(`${req.protocol}://${req.get('host')}`));
  if (!fromSameSite) return res.status(400).json({ error: 'bad source' });

  destroySession(req, res);
  res.redirect(302, safeReturnPath(req.query.redirect));
});

// 定时清理过期的待授权 state
setInterval(() => {
  const now = Date.now();
  for (const [s, v] of pending) {
    if (v.expires <= now) pending.delete(s);
  }
}, 5 * 60 * 1000).unref();

export default router;
