import { ref } from 'vue';
import { getMe } from './api';

/**
 * WordPress 授权登录状态（全局单例，用法同 siteConfig）。
 * 登录走授权码流程：整页跳到 WP 授权页 → 回调建立本站会话；
 * 登出只清笔记站自己的会话，不影响 WordPress 登录态。
 */
export const user = ref(null);
export const loaded = ref(false);
// 服务端是否配置了 WordPress SSO；未配置时头部不显示登录入口
export const ssoEnabled = ref(false);
// WordPress 站点地址（弹层内「账号资料」跳转用）
export const wpUrl = ref('');

/** 页面启动时调用一次：拉取当前 WP 登录态 */
export async function fetchMe() {
  try {
    const data = await getMe();
    ssoEnabled.value = Boolean(data.ssoEnabled);
    wpUrl.value = data.wpUrl || '';
    user.value = data.loggedIn ? data.user : null;
  } catch {
    ssoEnabled.value = false;
    user.value = null;
  } finally {
    loaded.value = true;
  }
  return user.value;
}

/** 去 WordPress 登录；登录后回到当前页面 */
export function login(returnPath) {
  const redirect = returnPath || window.location.pathname + window.location.search;
  window.location.href = `/api/auth/login?redirect=${encodeURIComponent(redirect)}`;
}

/** 退出笔记站（仅本站会话，WordPress 仍保持登录），完成后回到首页/指定路径 */
export function logout(returnPath = '/') {
  window.location.href = `/api/auth/logout?redirect=${encodeURIComponent(returnPath)}`;
}
