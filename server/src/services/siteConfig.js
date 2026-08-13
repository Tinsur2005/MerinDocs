import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// server/src/services -> server -> server/site.config.json
const CONFIG_FILE = path.resolve(__dirname, '..', '..', 'site.config.json');

let cached = null;
let cachedMtime = 0;

/**
 * 读取站点自定义配置（server/site.config.json）。
 * 按文件修改时间缓存：用户改了配置刷新页面即可生效，无需重启服务。
 * 配置缺失/损坏时返回空对象，前端会自动回退到内置默认值。
 */
export async function getSiteConfig() {
  try {
    const stat = await fs.stat(CONFIG_FILE);
    if (cached && cachedMtime === stat.mtimeMs) return cached;
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8');
    cached = JSON.parse(raw);
    cachedMtime = stat.mtimeMs;
    return cached;
  } catch (e) {
    console.error('[MerinDocs] 读取 site.config.json 失败：', e.message);
    return {};
  }
}
