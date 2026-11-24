import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.resolve(__dirname, '..', 'server', 'site.config.json');

function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(str).replace(/[&<>"']/g, (c) => map[c]);
}

/**
 * 开发模式下 vite 直接托管 index.html，服务端的 title 注入不生效。
 * 这里在 HTML 交给浏览器前读一次 site.config.json，把写死的默认标题换掉，
 * 避免开发时标签页先闪默认标题再被前端改过来。
 */
function siteTitlePlugin() {
  return {
    name: 'merindocs-site-title',
    transformIndexHtml(html) {
      let title = '';
      try {
        title = (JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')).siteTitle || '').trim();
      } catch {
        return html;
      }
      if (!title) return html;
      return html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
    },
  };
}

export default defineConfig({
  plugins: [vue(), siteTitlePlugin()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/assets': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
