import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// server/src -> server -> 项目根
const ROOT_DIR = path.resolve(__dirname, '..', '..');

/** 笔记数据源目录（可用环境变量 NOTE_DIR 覆盖，便于服务器上放任意路径） */
export const NOTE_DIR = path.resolve(process.env.NOTE_DIR || path.join(ROOT_DIR, 'note'));

/** 服务端口 */
export const PORT = process.env.PORT || 3000;

/** 笔记站对外地址（如 https://note.tinsur.cn），用于拼 OAuth 回调地址；不配则按请求头推断 */
export const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');

/** WordPress 站点地址（授权页所在），未配置时登录入口不显示 */
export const WORDPRESS_URL = (process.env.WORDPRESS_URL || '').replace(/\/+$/, '');

/**
 * 服务器内部访问 WP 的地址（可选）。部分云服务器访问自己的公网域名会被网络丢弃
 * （hairpin NAT），此时可配成 http://127.0.0.1，由 nginx 按 Host 头分流到 WP。
 * 仅用于服务端用授权码换取用户信息那一跳，浏览器跳转始终用 WORDPRESS_URL。
 */
export const WORDPRESS_INTERNAL_URL = (process.env.WORDPRESS_INTERNAL_URL || '').replace(/\/+$/, '');

/** OAuth 客户端配置：client_id/secret 必须与 WP 插件 MERIN_SSO_CLIENTS 完全一致 */
export const WP_CLIENT_ID = process.env.WP_CLIENT_ID || 'merindocs';
export const WP_CLIENT_SECRET = process.env.WP_CLIENT_SECRET || '';

/** 笔记站会话有效期（天） */
export const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS) || 30;

/** 本地开发模拟登录：值为显示名（如 "dev"），生产环境不要设置 */
export const AUTH_DEV_USER = process.env.AUTH_DEV_USER || '';

/** SSO 是否可用：WP 地址与客户端密钥都配置了才算启用 */
export const SSO_ENABLED = Boolean(WORDPRESS_URL && WP_CLIENT_SECRET);

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
