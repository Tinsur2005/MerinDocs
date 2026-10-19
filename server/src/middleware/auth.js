import { getSessionUser } from '../services/session.js';

/** 把当前笔记站登录用户挂到 req.user（未登录为 null）；本期只附加不拦截 */
export function attachUser(req, res, next) {
  try {
    req.user = getSessionUser(req);
  } catch {
    req.user = null;
  }
  next();
}
