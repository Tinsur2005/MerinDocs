import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { loadSiteConfig, siteConfig } from './siteConfig';
import './styles/main.css';
import './styles/markdown.css';

// 全局拦截链接的原生拖拽（dragstart）：页面 body 设了 overflow-x: hidden，
// Chromium 中按住链接拖动会进入原生 HTML5 拖拽态，结束后页面会卡死
// （滚轮 / 点击不再响应）。拦截后按住拖动变成普通文本选区，不进入拖拽态。
document.addEventListener('dragstart', (e) => {
  const t = e.target;
  if (t && t.closest && t.closest('a')) e.preventDefault();
});

// 先加载站点配置（site.config.json）再挂载应用：
// 首帧即用用户的配置渲染，避免先闪过内置默认配置再替换
loadSiteConfig().then((cfg) => {
  if (cfg?.siteTitle) document.title = cfg.siteTitle;
  createApp(App).use(router).mount('#app');
});
