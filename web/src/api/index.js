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

export const getHome = () => http.get('/api/home').then((r) => r.data);
