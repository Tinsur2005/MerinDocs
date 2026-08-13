import { ref } from 'vue';
import { getSiteConfig } from './api';

/**
 * 站点自定义配置（对应 server/site.config.json）。
 * 组件里直接 import siteConfig 用：siteConfig.navbar.title 等。
 * 配置接口加载失败时回退到下面这套内置默认值，保证站点始终可用。
 */
const defaultConfig = {
  siteTitle: 'MerinDocs - 记录学习过程的个人知识库',
  navbar: {
    title: 'MerinDocs',
    buttons: [
      { text: '返回博客', url: 'https://www.tinsur.cn', target: '_blank' },
      { text: '文档首页', url: '/', target: '_self' },
    ],
  },
  footer: {
    copyrightText: 'Tinsur',
    copyrightUrl: 'https://www.tinsur.cn/merindocs',
    poweredByText: 'MerinDocs文档系统',
    poweredByUrl: 'https://www.tinsur.cn/merindocs',
    beian: {
      icpText: '',
      icpUrl: 'https://beian.miit.gov.cn/',
      gonganText: '',
      gonganUrl: 'https://beian.mps.gov.cn/#/query/webSearch?code=37021402000083',
      gonganIcon: '',
    },
  },
};

export const siteConfig = ref({ ...defaultConfig });

let loaded = false;

/** 深合并：服务端配置优先，缺的字段用内置默认值补齐 */
function mergeConfig(src) {
  const out = { ...defaultConfig, ...src };
  if (src && src.navbar) out.navbar = { ...defaultConfig.navbar, ...src.navbar };
  if (src && src.footer) out.footer = { ...defaultConfig.footer, ...src.footer };
  if (src && src.footer && src.footer.beian) {
    out.footer.beian = { ...defaultConfig.footer.beian, ...src.footer.beian };
  }
  return out;
}

/** 页面启动时调用一次，拉取并应用站点配置 */
export async function loadSiteConfig() {
  if (loaded) return siteConfig.value;
  loaded = true;
  try {
    const data = await getSiteConfig();
    siteConfig.value = mergeConfig(data);
  } catch (e) {
    console.error('加载站点配置失败，使用内置默认值', e);
  }
  return siteConfig.value;
}
