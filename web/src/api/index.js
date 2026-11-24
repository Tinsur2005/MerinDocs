import axios from 'axios';

const http = axios.create({ baseURL: '/' });

export const getTree = () => http.get('/api/tree').then((r) => r.data);

// 文档内容会话缓存：同一页面内重复打开同一篇文档时秒开（刷新页面会清空）
const docCache = new Map();
export const getCachedDoc = (docPath) => docCache.get(docPath);

// 加密文档的密码令牌：localStorage 持久化，按文档路径存储；
// 笔记密码修改后服务端校验不过，前端会重新要求输入
const TOKEN_STORE_KEY = 'merindocs_doc_tokens';

function readTokens() {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_STORE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveToken(docPath, token) {
  const tokens = readTokens();
  tokens[docPath] = token;
  localStorage.setItem(TOKEN_STORE_KEY, JSON.stringify(tokens));
}

export const getDoc = (docPath) => {
  const hit = docCache.get(docPath);
  if (hit) return Promise.resolve(hit);
  const token = readTokens()[docPath] || '';
  return http.get('/api/doc', { params: { path: docPath, token } }).then((r) => {
    // 锁定响应不入缓存：解锁后同路径需能拿到新内容
    if (!r.data.locked) docCache.set(docPath, r.data);
    return r.data;
  });
};

// 提交密码解锁：成功后持久化令牌并写入会话缓存
export const unlockDoc = (docPath, password) =>
  http.post('/api/unlock', { path: docPath, password }).then((r) => {
    saveToken(docPath, r.data.token);
    docCache.set(docPath, r.data);
    return r.data;
  });

// 首页内容会话缓存：与文档缓存同理，跨视图切回首页时命中即秒开（刷新页面会清空）
let homeCache = null;
export const getCachedHome = () => homeCache;
export const getHome = () => {
  if (homeCache) return Promise.resolve(homeCache);
  return http.get('/api/home').then((r) => {
    homeCache = r.data;
    return r.data;
  });
};

export const searchNotes = (q) =>
  http.get('/api/search', { params: { q } }).then((r) => r.data);

export const getSiteConfig = () => http.get('/api/site-config').then((r) => r.data);
