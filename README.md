
# 📚 MerinDocs

一个轻量、开箱即用的 **Markdown 文档站系统**：把本地 `note/` 文件夹里的 Markdown 笔记变成带分类导航、代码高亮、目录大纲的在线文档站。

前端 Vue 3 + Vite，后端 Node.js + Express，生产环境**单端口部署**，五分钟即可上线。

项目文档：https://merin.tinsur.cn

项目主页：https://www.tinsur.cn/merindocs

---

## 特性

- 📝 **纯 Markdown 驱动**：无需数据库，把 `.md` 文件丢进 `note/` 就是一篇文档
- 🗂️ **分类导航侧边栏**：按文件夹自动生成目录树，默认折叠、打开文档自动展开所属分类、当前文档高亮
- 🏠 **首页**：展示 `note/README.md` 的内容作为站点首页
- 🎨 **代码高亮**：后端用 highlight.js 预渲染，支持 java / js / vue / bash / sql 等常见语言
- 📑 **目录大纲（TOC）**：正文右侧按标题生成可点击跳转大纲，滚动自动高亮
- 🖼️ **图片灯箱**：点击正文图片放大，支持滚轮缩放
- 📋 **代码块增强**：显示语言标识 + 一键复制按钮
- ⬅️➡️ **上一篇 / 下一篇**：按分类内排序自动生成上下篇导航
- 🧭 **顶部菜单**：右侧预留两个菜单按钮位（按钮1 / 按钮2，可自定义）
- 🔗 **图片路径自动解析**：支持相对路径、中文文件名、URL 编码图片
- 🔄 **缓存刷新接口**：`POST /api/refresh` 更新笔记后无需重启
- 🌐 **SPA 单端口**：生产环境后端直接托管前端构建产物，一个端口搞定页面 / 接口 / 图片

---

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Vue 3 · Vite · Vue Router · Axios |
| 后端 | Node.js · Express |
| Markdown | markdown-it（图片路径重写、标题 TOC、加粗兼容处理） |
| 代码高亮 | highlight.js（后端预渲染） |

---

## 目录结构

```
merin-docs/
├── note/                     # ⚠️ 笔记数据源（Markdown + 图片）
│   ├── README.md             # 站点首页内容
│   ├── JavaSE/
│   ├── SpringBoot/
│   ├── ...
│   └── assets/               # 笔记用到的图片
├── server/                   # Node.js 后端（Express）
│   └── src/
│       ├── index.js          # 入口：API + 托管前端 + SPA 回退
│       ├── config.js         # ⚙️ 端口 / 笔记路径 / 分类排序
│       ├── routes/doc.js     # /api/tree · /api/doc · /api/home · /api/refresh
│       └── services/         # 目录扫描 + Markdown 解析
├── web/                      # Vue 3 前端
│   ├── src/
│   │   ├── components/       # 顶栏 / 侧边栏 / 内容区 / 页脚
│   │   ├── views/            # 首页 / 文档页
│   │   └── styles/           # 全局样式 + Markdown 排版
│   └── vite.config.js        # ⚙️ 开发端口与代理
├── ecosystem.config.js       # ⚙️ pm2 生产守护配置
├── package.json              # 根脚本入口
└── deploy.md                 # 宝塔 + 域名 + 笔记自动同步完整部署教程
```

---

## 快速开始（本地开发）

> 要求：Node.js **18+**（推荐 20 LTS）

```bash
# 1. 安装依赖（根 / server / web 三处，一键完成）
npm run install:all

# 2. 启动开发环境（后端 :3000 + 前端 :5173，Vite 已配好代理）
npm run dev
```

也可以分开启动：

```bash
npm run dev:server   # 仅后端，http://localhost:3000
npm run dev:web      # 仅前端，http://localhost:5173（代理到 3000）
```

打开 **http://localhost:5173** 即可看到首页和全部笔记。

**想在首页看到内容？** 在 `note/README.md` 里写首页文案即可；没有该文件时首页会提示"尚未创建 README.md"。

---

## 配置说明

### 1. 笔记内容 —— `note/`

**不用改代码**，直接往里放 Markdown 即可：

- 每个**文件夹** = 一个分类；每个 **`.md` 文件** = 一篇文档
- 文件名以数字前缀排序：`1-xxx.md`、`2-xxx.md` …
- 文件开头第一个 `#` 标题作为文档标题
- 图片统一放 `note/assets/<笔记名>/`，md 内用相对路径引用（中文/URL 编码均可）
- `note/README.md` 的内容渲染为站点首页

### 2. 服务端口 —— `server/src/config.js`

```js
export const PORT = process.env.PORT || 3000;
```

- 开发/简单部署：直接改默认值，或启动时设置环境变量 `PORT=8080`
- pm2 生产：改 `ecosystem.config.js` 里的 `PORT`

### 3. 笔记目录路径 —— `server/src/config.js`

```js
export const NOTE_DIR = path.resolve(process.env.NOTE_DIR || path.join(ROOT_DIR, 'note'));
```

默认是项目内的 `note/`；笔记放在别处（如 `/data/notes`）时用环境变量覆盖：

```bash
NOTE_DIR=/data/notes npm start
```

### 4. 分类排序 —— `server/src/config.js`

```js
export const CATEGORY_ORDER = ['JavaSE', 'Web', 'Database', 'SpringBoot', ...];
```

按学习路径自定义分类在侧边栏的显示顺序；未列出的分类排在后面、按字母序兜底。

### 5. 前端开发端口与代理 —— `web/vite.config.js`

```js
server: {
  port: 5173,
  proxy: {
    '/api':    { target: 'http://localhost:3000' },
    '/assets': { target: 'http://localhost:3000' },
  },
}
```

前端端口、后端地址都在这改（开发时前后端分离跑）。

### 6. 页面标题 / 导航标题 / 页脚 —— `web/src`

| 想改什么 | 位置 |
| --- | --- |
| 浏览器标签页标题 | `web/index.html` 里的 `<title>` |
| 顶部导航栏标题 | `web/src/components/DocHeader.vue` |
| 顶部菜单按钮（按钮1 / 按钮2） | `web/src/components/DocHeader.vue` |
| 页脚版权 / powered by | `web/src/components/AppFooter.vue` |

> 改完前端记得重新 `npm run build`。

### 7. 生产进程 —— `ecosystem.config.js`

```js
name: 'merin-docs',
script: './server/src/index.js',
env: { PORT: 3000 },
```

pm2 进程名、脚本入口、端口都在这里。

---

## 生产部署

### 方式一：一键构建 + 启动（最简单）

```bash
npm run install:all
npm run build      # 构建前端到 web/dist
npm start          # 启动后端，单端口托管：页面 + 接口 + 图片
# 访问 http://服务器IP:3000
```

### 方式二：pm2 守护（推荐，崩了自动拉起、开机自启）

```bash
npm run install:all
npm run build
pm2 start ecosystem.config.js && pm2 save && pm2 startup
# 进程名 merin-docs，端口 3000
```

### 方式三：宝塔面板 + 域名 + 反向代理

1. 上传项目到服务器（**不要**上传 `node_modules`、`web/dist`），`npm run install:all && npm run build`
2. pm2 启动：`pm2 start ecosystem.config.js`
3. 宝塔 **添加站点** → 绑定域名 → **反向代理**：目标 `http://127.0.0.1:3000`
4. 开启 **SSL / 强制 HTTPS**

> 📖 完整图文教程（含上传清单、常见问题排查）见 **[deploy.md](deploy.md)**

---

## 笔记自动同步（可选）

把 `note/` 变成一个独立的 Git 仓库（如 Gitee），配合**宝塔 Webhook 插件**：本地 `git push` → 服务器自动 `git pull` → `curl -X POST http://127.0.0.1:3000/api/refresh` 刷新缓存，全程无需登录服务器。

详细配置（免密拉取、Webhook 脚本、故障排查）见 **[deploy.md](deploy.md) 第 9 节**。

---

## 常见问题

| 现象 | 处理 |
| --- | --- |
| 页面空白 / 没有样式 | `web/dist` 未构建或构建失败，重新 `npm run build` |
| 502 Bad Gateway | 后端没起来：`pm2 status` 看状态、`pm2 logs` 看报错，确认反代端口与 `PORT` 一致 |
| 图片全部裂开 | `note/assets` 没上传，或路径不对 |
| 改了笔记不生效 | 后端有目录缓存：`curl -X POST http://127.0.0.1:3000/api/refresh` 或 `pm2 restart merin-docs` |
| 首页显示"尚未创建 README.md" | 在 `note/` 下创建 `README.md` |

更多排查见 **[deploy.md](deploy.md) 第 10 节**。

---

## License

本项目采用 [GPL-3.0](LICENSE) 协议开源：你可以自由使用、修改、分发，但基于本项目的衍生作品必须同样以 GPL-3.0 开源。
