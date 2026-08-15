import axios from 'axios';

const http = axios.create({ baseURL: '/' });

export const getTree = () => http.get('/api/tree').then((r) => r.data);

// 文档内容会话缓存：同一页面内重复打开同一篇文档时秒开（刷新页面会清空）
const docCache = new Map();
export const getCachedDoc = (docPath) => docCache.get(docPath);
export const getDoc = (docPath) => {
  const hit = docCache.get(docPath);
  if (hit) return Promise.resolve(hit);
  return http.get('/api/doc', { params: { path: docPath } }).then((r) => {
    docCache.set(docPath, r.data);
    return r.data;
  });
};

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
