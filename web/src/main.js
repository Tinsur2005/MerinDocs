import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { loadSiteConfig, siteConfig } from './siteConfig';
import './styles/main.css';
import './styles/markdown.css';

// 先加载站点配置（site.config.json）再挂载应用：
// 首帧即用用户的配置渲染，避免先闪过内置默认配置再替换
loadSiteConfig().then((cfg) => {
  if (cfg?.siteTitle) document.title = cfg.siteTitle;
  createApp(App).use(router).mount('#app');
});
