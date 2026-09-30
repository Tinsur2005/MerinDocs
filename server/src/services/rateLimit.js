/**
 * 加密文档解锁的错误次数冷却：
 * 每连续输错 5 次升一档，冷却 1 → 10 → 100 → … 分钟（每档 ×10），封顶 24 小时。
 * 计数跨冷却期累计，解锁成功后清零。按 客户端 IP + 文档路径 分别计数。
 */

const FAILURES_PER_TIER = 5;
const BASE_LOCK_MS = 60 * 1000;
const MAX_LOCK_MS = 24 * 3600 * 1000;
const IDLE_TTL_MS = 24 * 3600 * 1000;

// key -> { count, lockUntil, lastAttempt }
const records = new Map();

/** 当前剩余冷却毫秒数；不在冷却期返回 0 */
export function getLockRemaining(key, now = Date.now()) {
  const r = records.get(key);
  if (!r || r.lockUntil <= now) return 0;
  return r.lockUntil - now;
}

/** 记录一次错误；落在档位边界（每 5 次）时启动新一轮冷却，返回错误次数与剩余冷却毫秒 */
export function recordFailure(key, now = Date.now()) {
  const r = records.get(key) || { count: 0, lockUntil: 0 };
  r.count += 1;
  r.lastAttempt = now;
  if (r.count % FAILURES_PER_TIER === 0) {
    const tier = r.count / FAILURES_PER_TIER;
    const lock = Math.min(MAX_LOCK_MS, BASE_LOCK_MS * 10 ** (tier - 1));
    r.lockUntil = now + lock;
  }
  records.set(key, r);
  return { count: r.count, retryAfter: getLockRemaining(key, now) };
}

/** 解锁成功：连续错误计数清零 */
export function resetFailures(key) {
  records.delete(key);
}

// 定时清理长期无活动的记录，避免放弃尝试的 IP/文档条目无限残留
setInterval(() => {
  const cutoff = Date.now() - IDLE_TTL_MS;
  for (const [key, r] of records) {
    if (r.lastAttempt < cutoff) records.delete(key);
  }
}, 3600 * 1000).unref();
