import axios from 'axios';

const http = axios.create({ baseURL: '/' });

export const getTree = () => http.get('/api/tree').then((r) => r.data);

export const getDoc = (docPath) =>
  http.get('/api/doc', { params: { path: docPath } }).then((r) => r.data);

export const getHome = () => http.get('/api/home').then((r) => r.data);
