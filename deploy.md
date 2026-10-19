# MerinDocs 部署教程（宝塔+域名+pm2守护）

> 目标：域名（不带端口）访问文档站，Node 进程由 pm2 守护、开机自启、崩了自动拉起。

## 0. 部署架构

```
浏览器
  │  https://你的域名
  ▼
宝塔 Nginx（80/443，公网只暴露这两个端口）
  │  反向代理，整站转发
  ▼
Node 后端 127.0.0.1:3000（pm2 守护，开机自启）
  ├── /api/*       文档接口
  ├── /assets/*    笔记图片
  └── /*           前端页面 + SPA 路由回退

Gitee note 仓库 ──WebHook 推送──> 宝塔 Webhook 插件（面板）
                                    │ 执行脚本（第 9 节）：
                                    │   ① git pull 拉取最新 note
                                    │   ② curl POST /api/refresh 刷新缓存
                                    ▼
                            Node 后端读取到最新笔记
```

本项目后端已经自己托管了前端构建产物（`web/dist`），所以宝塔端**只需一个反向代理把整站转给 3000**，不需要配置静态目录、不需要伪静态，很省事。

---

## 1. 前置准备

1. **一台云服务器**，已安装宝塔面板（Linux）。
2. **一个域名**，已添加 **A 记录**解析到服务器公网 IP（在域名服务商后台操作）。
   - 验证：在服务器上 `ping 你的域名`，能返回服务器 IP 即可。
3. **本地项目文件**（本电脑上的整个项目，Windows 下可直接压缩成 zip 上传）。

---

## 2. 服务器安装 Node.js 和 pm2

### 2.1 安装 Node.js

**方式一（推荐，宝塔图形化）：**
宝塔面板 → 软件商店 → 搜 **Node.js 版本管理器** → 安装 → 打开它 → 安装 **v20.x LTS** 版本 → 设为默认。

**方式二（命令行，宝塔终端）：**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v   # 应显示 v20.x
```

### 2.2 安装 pm2

```bash
npm install -g pm2
pm2 -v
```

---

## 3. 上传项目

### 3.1 本地压缩（照着勾选即可）

在项目文件夹里，**按住 Ctrl 多选**下面这些项，然后右键 → **压缩到 zip**（Windows 自带压缩/7-Zip/Bandizip 均可）：

**✅ 必须选中：**

| 勾选项 | 说明 |
| --- | --- |
| `package.json` | 根脚本入口 |
| `package-lock.json` | 根依赖锁文件（保证版本一致） |
| `ecosystem.config.js` | pm2 守护配置 |
| `server/` | Node 后端（整个文件夹） |
| `web/` | Vue 前端（整个文件夹） |
| `note/` | ⚠️ 笔记数据源，`.md` 和 `assets/` 图片都要 |

**❌ 不要选中：**

- 所有 `node_modules/`（根 / server / web 三处都有）→ 服务器上 `npm install` 重新生成
- `web/dist/` → 服务器上 `npm run build` 重新生成
- `.claude/`、`plan.md`、`deploy.md` → 本地开发文件，不用传

> `server/` 和 `web/` 要**整个文件夹**选中（文件夹内部各自的 `node_modules` 由上述排除项覆盖；如果压缩软件不支持"压缩时排除子目录"，就先进 `server/`、`web/` 里删掉各自的 `node_modules` 和 `web/dist` 再压缩，本地开发要用时再 `npm install` 回来）。

### 3.2 上传到服务器

1. 在宝塔 **文件** 里创建站点目录，例如 `/www/wwwroot/merin-docs`。
2. 把压缩好的 zip 上传到该目录，右键 **解压**。

   解压后的目录结构（应长这样）：

   ```
   /www/wwwroot/merin-docs/
   ├── package.json
   ├── package-lock.json
   ├── ecosystem.config.js
   ├── server/               # 不含 node_modules
   ├── web/                  # 不含 node_modules、dist
   └── note/                 # ⚠️ 必须完整（md + assets）
   ```

---

## 4. 安装依赖并构建前端

在宝塔 **终端** 中执行（先进入项目目录）：

```bash
cd /www/wwwroot/merin-docs

# 一键安装 根/server/web 三处依赖
# 网络慢/在国外时，改用国内镜像：npm run install:mirror
npm run install:all

# 构建前端到 web/dist
npm run build
```

构建成功会看到 `dist/index.html` 和 `dist/assets/...`。

> ⚠️ **不要**把本地 `node_modules` 一起压缩上传（虽然省了服务器安装，但不可行）：
> - **跨平台不兼容**：本地是 Windows、服务器是 Linux，`node_modules` 里的原生二进制（Vite 依赖的 esbuild、rollup 等）不通用，拷贝上去会直接报错无法运行，最终还得重装。
> - **文件量太大**：node_modules 是几万个零碎小文件，压缩上传 + 宝塔解压极慢，比服务器上装依赖慢得多。
> - **正确做法**：服务器上用国内镜像装，几十秒搞定。先执行 `npm config set registry https://registry.npmmirror.com`，再用 `npm run install:mirror`。

---

## 5. pm2 启动并设开机自启

```bash
cd /www/wwwroot/merin-docs

# 启动（使用项目里的 ecosystem.config.js）
pm2 start ecosystem.config.js

# 保存进程列表
pm2 save

# 开机自启（按提示执行它输出的那条带 startup 的命令）
pm2 startup
```

**验证后端是否正常**（3000 是本机端口）：

```bash
curl -s http://127.0.0.1:3000/ | head -5            # 应返回 HTML
curl -s http://127.0.0.1:3000/api/tree | head -c 200 # 应返回 JSON
pm2 status                                            # 应显示 online
```

> 注意：**不要**用 `npm start` 常驻运行——它会每次都重新构建前端。构建一次即可，之后 pm2 只跑后端。

---

## 6. 宝塔绑定网站 + 反向代理

### 6.1 添加站点

宝塔面板 → **网站** → **添加站点**：

- **域名**：填你的域名，如 `docs.example.com`
- **根目录**：选 `/www/wwwroot/merin-docs`
- **PHP 版本 / 数据库**：都不需要，纯静态即可
- 提交

### 6.2 配置反向代理

进入该站点的 **设置** → **反向代理** → **添加反向代理**：

- 代理名称：随便填，如 `docs`
- **目标 URL：`http://127.0.0.1:3000`**
- 发送域名 / 其它参数：保持默认
- 保存

保存后直接访问 `http://你的域名`，应该就能看到文档站了。

> 为什么不需要做别的：后端已自带「页面 + 图片 + 接口 + SPA 刷新回退」全套服务，反代整站即可，无需单独配静态目录或伪静态。

---

## 7. 开启 HTTPS（强烈推荐）

宝塔面板 → 该站点 **设置** → **SSL**：

1. 选择 **Let's Encrypt** → 勾选你的域名 → 申请并部署。
2. 打开右上角 **强制 HTTPS**。
3. 之后用 `https://你的域名` 访问。

---

## 8. 日常维护

### 更新代码 / 笔记

```bash
cd /www/wwwroot/merin-docs

# 前端代码有改动时：重新构建 + 重启
npm run build
pm2 restart merin-docs

# 只改了 note/ 里的 md 或图片时：
# 若已配置第 9 节 webhook，本地 push 即自动同步，无需登录服务器；
# 未配置时：后端有目录缓存，重启一下即可生效：
pm2 restart merin-docs
```

### 查看日志 / 状态

```bash
pm2 status            # 运行状态
pm2 logs merin-docs  # 实时日志（Ctrl+C 退出）
```

### 改端口

编辑项目根目录 `ecosystem.config.js` 里的 `PORT`，然后：

```bash
pm2 restart merin-docs
```

### 停止 / 卸载

```bash
pm2 stop merin-docs
pm2 delete merin-docs   # 从 pm2 移除
pm2 save
```

---

## 9. 笔记自动同步（远程仓库+宝塔Webhook插件）

> 目标：本地更新笔记 → push 到 远程仓库 → 服务器用**宝塔官方 Webhook 插件**自动拉取最新笔记并刷新缓存，站点始终是最新版，全程无需登录服务器。

### 9.1 工作原理

```
本地电脑                   远程仓库                    宝塔服务器
note/ (git仓库) --push--> note仓库 --WebHook通知--> 宝塔 Webhook 插件（面板）
                                                      ↓ 收到推送，执行脚本
                                                 脚本内容：
                                                 ① cd note && git pull origin master
                                                 ② curl -X POST http://127.0.0.1:3000/api/refresh
                                                      ↓
                                              访问站点 → 看到最新笔记
```

关键点：**note 是运行时数据（不是代码）**，拉取后刷新后端缓存即生效，**不需要重新构建前端**。刷新缓存用的是后端已有的 `POST /api/refresh` 接口（清内存目录缓存，不中断服务）。如果以后想连前端代码一起自动更新，见 9.7。

### 9.2 本地：把 note 变成独立仓库

1. 在Github或Gitee等上新建一个仓库，例如 `note`（可以设私有）。
2. 本地终端执行（`项目路径/note` 就是本项目的 note 文件夹）：

```bash
cd 项目文件夹路径\note

git init
git add .
git commit -m "初始化笔记仓库"
git branch -M master          # 或 main，记下这个分支名，后续脚本里要一致
git remote add origin https://你的Git远程仓库提交地址
git push -u origin master
# 首次 push 会要求输入用户名 + 密码（或私人令牌）
```

去远程仓库内确认仓库里能看到笔记文件，即成功。

> 注意：**只把 note 入仓**，项目其余代码不要加进来。`assets/` 图片会一起提交，Gitee 免费仓库有大小限制（单仓库约 1GB），日常够用；图片特别多时注意控制仓库体积。

### 9.3 服务器：note 目录转成 git 仓库并配置免密

在宝塔终端执行：

```bash
cd /www/wwwroot/merin-docs

# 备份服务器上现有的 note（首次部署时若第 3 节已上传过内容）
mv note note_bak

# 用 Gitee 上的最新内容克隆（分支名与 9.2 保持一致）
git clone -b master https://仓库提交地址
```

配置**免密拉取**（关键：webhook 是无人值守的，不能每次弹密码）：

```bash
cd /www/wwwroot/merin-docs/note
git config credential.helper store
git pull
# 这里手动触发一次，输入一次 Gitee 用户名 + 密码
# 凭据会保存到 /root/.git-credentials，之后自动 pull 不再询问
```

验证：再执行一次 `git pull`，应显示 `Already up to date` 且**不询问密码**，说明免密配置成功。

### 9.4 宝塔安装 Webhook 插件并配置脚本

**1. 安装插件**：宝塔面板 → **软件商店** → 搜索 **webhook** → 安装（宝塔官方 Webhook 插件，图标是"Webhook 管理"）。

**2. 添加 Webhook 任务**：软件商店 → 已安装 → **webhook** → 进入管理页 → **添加 webhook**：

- 名称：如 `notes_update`
- 提交后，插件会生成一个**回调 URL**（形如 `http://你的服务器IP:8888/xxx`，带密钥参数），**复制保存**，9.5 要用
- **脚本内容**：填下面的命令，其中分支 `master` 换成 9.2 实际用的分支名：

```bash
#!/bin/bash
# ① 拉取最新笔记（cd 到服务器上的 note 目录）
cd /www/wwwroot/merin-docs/note
if git pull origin master; then
  # ② 刷新文档站目录缓存（后端已有接口，无需重启进程）
  curl -s -X POST http://127.0.0.1:3000/api/refresh
  echo "[webhook] 笔记已同步并刷新缓存"
else
  echo "[webhook] git pull 失败，请检查 note 仓库"
  exit 1
fi
```

**3. 放行面板端口**：插件回调走的是宝塔面板端口（默认 **8888**），需在云服务器安全组放行 8888，并确保宝塔面板允许外网访问（宝塔 → 安全 里检查端口是否放行）。

> 说明：插件脚本以 root 执行，能读到 9.3 配置的 `/root/.git-credentials` 免密凭据，所以自动 pull 不会卡在密码上。

### 9.5 在远端仓库添加 WebHook

这里以Gitee仓库举例：

Gitee 仓库页面 → **管理** → **WebHooks** → **添加 webhook**：

- **URL**：填 9.4 里**宝塔插件生成的回调 URL**（不是你的域名！）
- 事件：勾选 **Push**（推送）
- 提交/保存

保存后，Gitee WebHooks 列表里可以对它点「**测试**」，每次触发都有请求/响应记录可看。

### 9.6 测试完整链路

1. 在**宝塔 webhook 插件**的任务列表里，对该任务点「**测试**」——应看到脚本执行成功输出「笔记已同步并刷新缓存」。
2. 本地随便改一个笔记（或在 note 里新增一个文件）→ 提交并 push：

```bash
cd 项目路径\note
git add .
git commit -m "测试自动同步"
git push
```

3. 等 3~5 秒（Gitee 通知 → 插件 → 脚本），刷新站点页面，应看到最新内容。

### 9.7 进阶：想连前端代码一起自动更新

只改笔记时无需构建。但如果以后把**整个项目**也放进一个 Git 仓库、想在 push 后连前端一起重新构建，把插件脚本扩展为：

```bash
#!/bin/bash
cd /www/wwwroot/merin-docs
git pull && npm run build && pm2 restart merin-docs
```

本项目当前只有 note 单独入仓，按需扩展即可。

### 9.8 日常使用流程

以后每次更新笔记只需两步，站点自动同步：

```bash
cd 项目路径\note
git add .
git commit -m "更新了xxx笔记"
git push
```

---

## 10. WordPress 授权登录（OAuth 授权码模式）

> 效果类似「QQ 互联」：笔记站有**独立的登录会话**，不与 WordPress 共享 Cookie。在笔记站点「登录」→ 跳到 WordPress 的授权确认页 → 登录 WP（如未登录）并点「同意授权」→ 跳回笔记站自动完成登录。笔记站点「退出登录」**只退出笔记站**，WordPress 仍保持登录。
>
> **前提**：WordPress 与笔记站都是 HTTPS；两个域名可以不同主域（但建议同主域名的子域，如 `www.tinsur.cn` / `note.tinsur.cn`）。

### 10.1 WordPress：移除旧的共享 Cookie 配置

本方案**不需要、也不能**设置共享 Cookie 域。如果以前按旧方案在 `wp-config.php` 加过下面这行，务必删除或注释掉，否则可能导致 WordPress 前台无法登录：

```php
// 删除这一行（旧共享 Cookie 方案遗留）：
define('COOKIE_DOMAIN', '.tinsur.cn');
```

改完后清一次浏览器 Cookie、重新登录 WordPress 确认登录恢复正常。

### 10.2 WordPress：安装/替换授权插件

把项目里 `wordpress/merin-sso.php` 上传到 WordPress 的 `wp-content/mu-plugins/` 目录（没有 `mu-plugins` 文件夹就新建），放进去即生效，无需后台启用。**若装过旧版插件，直接用新文件整个覆盖。**

插件提供两个地址：

- `/merin-sso/authorize/`：用户看的授权确认页（未登录会先跳 WP 登录页，登录后自动回到授权页）
- `/merin-sso/exchange/`：笔记站服务端用授权码换用户信息（需 client_secret，浏览器接触不到）

插件顶部的客户端注册表需要与笔记站保持一致：

```php
'merindocs' => array(
    'name'          => 'MerinDocs 笔记站',                    // 授权页上显示的应用名
    'secret'        => '92b2bb13f8f750ac9d794fee5f25c244...', // 双方一致的随机密钥
    'redirect_uris' => array(
        'https://note.tinsur.cn/api/auth/callback',           // 必须逐字符完全匹配
    ),
),
```

- 笔记站域名不同时，改 `redirect_uris` 为实际的 `https://你的笔记站域名/api/auth/callback`；
- 建议把 `secret` 换成你自己生成的随机串（如 `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`），笔记站环境变量用同一个值；
- 插件端点变化后会自动刷新一次固定链接规则；若授权页返回 404，到 WP 后台「设置 → 固定链接」点一次「保存」。

### 10.3 笔记站：配置环境变量并重启

编辑项目根目录 `ecosystem.config.js` 的 `env`：

```js
SITE_URL: 'https://note.tinsur.cn',           // 笔记站对外地址，用于拼 OAuth 回调地址
WORDPRESS_URL: 'https://www.tinsur.cn',       // WordPress 地址，不带尾斜杠
WP_CLIENT_ID: 'merindocs',                    // 与插件注册的 key 一致
WP_CLIENT_SECRET: '92b2bb13f8f750ac...',      // 与插件里的 secret 完全一致
// WORDPRESS_INTERNAL_URL: 'http://127.0.0.1', // 可选：服务器访问自身公网域名不通时启用
// SESSION_TTL_DAYS: 30,                        // 可选：笔记站登录保持天数，默认 30
```

> `SITE_URL` 必须与插件白名单中的回调地址同根（`${SITE_URL}/api/auth/callback`）。若 nginx 反向代理已配置 `proxy_set_header Host $host;` 也可省略此项，但建议显式配置，避免代理头缺失时回调地址变成 `https://127.0.0.1/...` 被 WP 拒绝。

重启并**让新环境变量生效**：

```bash
pm2 restart merin-docs --update-env
```

未配置 `WORDPRESS_URL` 或 `WP_CLIENT_SECRET` 时，登录入口自动隐藏，站点照常公开访问。

### 10.4 验证

1. 未登录时笔记站右上角显示「登录」；点击后跳到 WordPress，出现「MerinDocs 笔记站 请求获得你的账户基本信息」授权页；
2. 未登录 WP 时会先到 WP 登录页，登录成功后自动回到授权页（参数不丢）；
3. 点「同意授权」→ 跳回笔记站原页面，右上角显示 WP 昵称；
4. 点「拒绝」→ 回到笔记站首页并提示「已取消授权」，不登录；
5. 点「退出登录」→ 笔记站变为未登录；直接打开 WordPress 确认**仍是登录状态**；
6. 在笔记站再次点「登录」，因 WP 仍登录，会直接出授权页（无需再输密码）。

> 说明：授权码一次性、60 秒过期；state 参数防 CSRF；笔记站会话 Cookie 为 HttpOnly + SameSite=Lax（HTTPS 下自动加 Secure），默认保持 30 天。
> 本地开发可用环境变量 `AUTH_DEV_USER=dev` 模拟登录态；生产环境不要设置。

---

## 11. 常见问题排查

| 现象 | 可能原因 / 处理 |
| --- | --- |
| 域名打不开，但 IP 能开 | 域名解析没生效或没解析；等解析生效或检查 A 记录 |
| 502 Bad Gateway | 后端没起来。`pm2 status` 看是否 online；`pm2 logs` 看报错；确认反代目标端口和 `ecosystem.config.js` 的 PORT 一致 |
| 页面正常但图片全部裂开 | `note/assets` 没上传，或上传后路径不对 |
| 站点空白/只有文字没样式 | `web/dist` 没构建或构建失败，重新 `npm run build` |
| 改了笔记不生效 | 后端有目录缓存，`pm2 restart merin-docs` 或 `curl -X POST http://127.0.0.1:3000/api/refresh` 即可 |
| 想直接 IP:3000 访问 | 需在云安全组放行 3000 端口；正常用反代只需放行 80/443 |
| 测试 webhook 报连接失败 | 宝塔面板端口（默认 8888）未在安全组放行，或面板禁了外网访问；确认插件生成的回调 URL 完整无误 |
| Webhook收到 **200 但响应头是 `Server: nginx`**、body 是 `null`、插件日志为空 | 请求没打进插件，被宝塔 Nginx 兜底接住。**根因：Gitee 里填的 WebHook URL 和插件生成的完整回调地址不一致**。回到插件管理页**原样复制**回调地址（形如 `http://IP:8888/...` 含密钥）贴进 Gitee，别手改、别换域名；再在服务器 `curl -i -X POST "http://127.0.0.1:8888/插件路径"` 看插件日志是否有记录来区分是插件问题还是 URL 问题 |
| webhook 触发但站点没更新 | 在宝塔 webhook 插件里对该任务点「测试」看脚本输出。git pull 失败常见原因：① 免密没配好（`git config credential.helper store` + 手动 pull 一次）；② 脚本里的分支名（master/main）与本地 push 的分支不一致；③ 脚本里 `cd` 的路径不对 |
| 脚本输出 git pull 冲突/无法拉取 | 服务器上有人手动改过 note。备份后 `git reset --hard origin/master` 强制对齐仓库（分支名按实际） |
| 装了登录插件后 **WordPress 前台无法登录** | 旧方案在 `wp-config.php` 里加的 `COOKIE_DOMAIN` 导致，删掉该行并清理浏览器 Cookie 后重新登录；新授权码方案不需要任何 Cookie 域配置 |
| 笔记站右上角没有「登录」入口 | `WORDPRESS_URL` 或 `WP_CLIENT_SECRET` 未配置/未生效。检查 `ecosystem.config.js` 后执行 `pm2 restart merin-docs --update-env`；可用 `curl -s http://127.0.0.1:3000/api/auth/me` 确认 `ssoEnabled` 为 true |
| 点登录跳到 WP 后提示「授权请求无效」 | 请求里的 `redirect_uri` 与插件 `redirect_uris` 白名单不完全一致（协议/域名/端口/路径逐字符匹配），或 `client_id` 未登记。先在服务器执行 `curl -s -i "http://127.0.0.1:3000/api/auth/login?redirect=/" | grep -i location` 看实际跳转：若 `redirect_uri=https%3A%2F%2F127.0.0.1%2F...`，说明 nginx 未透传 Host 头，在 `ecosystem.config.js` 配置 `SITE_URL` 后 `pm2 start ecosystem.config.js --update-env`；域名不符则改插件注册表 |
| 授权页/换取接口返回 404 | 插件固定链接规则未生效，WP 后台「设置 → 固定链接」点一次保存；确认新版 `mu-plugins/merin-sso.php` 已覆盖旧文件 |
| 点「同意授权」后进了 **WordPress 后台**、没回笔记站，笔记站仍未登录 | 旧版插件（<2.0.1）用 `wp_safe_redirect` 跳回调地址，该函数只允许跳 WP 自身主机，跨子域（www → note）会被拦截并兜底到 wp-admin。用新版 `merin-sso.php`（v2.0.1+）覆盖 mu-plugins 文件即可，无需重启 |
| 授权后提示「登录失败或授权已过期」 | 授权码 60 秒过期且只能用一次，重新走一遍登录即可；反复出现则看 `pm2 logs merin-docs` 里 `[MerinDocs][SSO]` 日志（多为笔记站服务器连不上 WordPress，可在 `ecosystem.config.js` 配置 `WORDPRESS_INTERNAL_URL`），并核对双方 `secret` 是否一致 |
| 退出登录提示 400 bad source | 登出必须从笔记站页面点击触发（校验来源防第三方诱导登出）；直接在地址栏访问该接口会被拒绝，属正常。退出只影响笔记站，WordPress 保持登录是设计如此 |

---

## 12. 服务器上需要保留/排除的内容速查

> 压缩时具体勾哪些，见 **第 3.1 节「本地压缩」清单**，这里只做汇总：

| ✅ 要上传 | ❌ 不要上传 |
| --- | --- |
| 根 `package.json`、`package-lock.json`、`ecosystem.config.js` | `node_modules/`（根/server/web 三处，服务器上 `npm install` 生成） |
| `server/`（整个文件夹） | `web/dist/`（服务器上 `npm run build` 生成） |
| `web/`（整个文件夹） | `.claude/`、`plan.md`、`deploy.md` 等本地文件 |
| `note/`（**.md 和 assets/ 都要**） | |
