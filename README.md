# VaultDrive

> 基于 Cloudflare Workers 的个人云盘，支持 Telegram、S3、WebDAV 三种存储后端，提供 Web UI 与标准 WebDAV 协议挂载。零服务器、零运维。

---

## 技术栈

| 层 | 说明 |
|---|---|
| 运行时 | Cloudflare Workers（V8 隔离，零依赖运行时） |
| 文件存储 | Telegram Bot API / S3 兼容存储 / 远程 WebDAV 服务器 |
| 元数据 | Cloudflare Workers KV |
| 前端 | 原生 HTML / CSS / JS，内嵌于 Worker |
| WebDAV | 自实现协议层，兼容 macOS Finder / Windows / rclone / Cyberduck |

---

## 功能

**Web UI**
- 网格 / 列表两种视图，记忆偏好
- 上传：点击或拖放，多文件并发，实时进度条
- 新建文件夹、重命名、删除
- 右键菜单（桌面）/ 底部 Sheet（移动端）
- 实时搜索过滤
- 图片 / 视频 / 音频原地预览
- 全 SVG 线性图标，白底黑字极简风格
- 响应式，手机与桌面兼容

**认证**
- 密码登录（`LOGIN_PASS`，独立于 WebDAV 密码）
- Telegram 验证码登录（6 位 OTP，5 分钟有效）
- 两种方式可单独或同时开启，同时开启时登录页出现 Tab 切换
- Session Cookie，默认 24 小时有效
- `AUTH_DISABLED=true` 完全跳过认证

**WebDAV 对外接口**
- 挂载点：`https://<worker>.workers.dev/dav`
- 认证：Basic Auth（`WEBDAV_USER` / `WEBDAV_PASS`）
- 支持：`GET / PUT / DELETE / MKCOL / PROPFIND / MOVE / COPY / LOCK`

---

## 存储后端

三种后端通过 `STORAGE` 变量切换，**文件实际存放的位置不同，但 Web UI 和 WebDAV 接口完全一致**。

| 后端 | `STORAGE` 值 | 适合场景 |
|------|-------------|---------|
| Telegram | `telegram`（默认） | 免费无限空间，单文件 ≤ 50 MB |
| S3 兼容 | `s3` | AWS S3 / Cloudflare R2 / MinIO，单文件最大 5 GB |
| WebDAV | `webdav` | Nextcloud / 坚果云 / 群晖 NAS / Box 等 |

---

## 项目结构

```
vaultdrive/
├── wrangler.toml        # Worker 配置与变量说明
├── package.json         # 仅含 wrangler CLI（Worker 本身零依赖）
├── preview.html         # 本地预览（含 mock 数据，无需部署直接打开）
└── src/
    ├── index.js         # 入口：路由 + 鉴权
    ├── auth.js          # 登录 / 登出 / Telegram OTP
    ├── storage.js       # 存储抽象（Telegram / S3 / WebDAV 统一接口）
    ├── telegram.js      # Telegram Bot API 封装
    ├── webdav.js        # WebDAV 协议实现（对外暴露）
    ├── api.js           # REST API（供 Web UI 调用）
    ├── store.js         # KV 元数据层
    └── ui.js            # Web UI 完整 SPA
```

---

## 部署

### 前置：安装 Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

> 这只是安装本地 CLI 工具，不是 Worker 的运行时依赖。

### 1. 创建 KV Namespace

```bash
wrangler kv namespace create VAULTDRIVE_KV
```

将输出的 `id` 填入 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "KV"
id = "你的 namespace id"
```

### 2. 编辑 `wrangler.toml`

```toml
[vars]
STORAGE       = "telegram"  # telegram | s3 | webdav
SESSION_TTL   = "86400"
AUTH_DISABLED = "false"

# S3 时额外填写
# S3_ENDPOINT   = "https://xxx.r2.cloudflarestorage.com"
# S3_BUCKET     = "my-bucket"
# S3_REGION     = "auto"
# S3_PUBLIC_URL = "https://cdn.example.com"

# WebDAV 存储时额外填写
# WEBDAV_STORAGE_URL = "https://dav.example.com/remote.php/dav/files/user/"
```

### 3. 配置 Secrets

根据选择的存储后端和认证方式，设置对应的 Secrets。

**方式一（命令行）**
```bash
wrangler secret put <KEY>
```

**方式二（界面）**

Cloudflare Dashboard → Workers & Pages → vaultdrive → Settings → Variables → **Secrets**

---

#### Telegram 存储 / 验证码登录

> 两者共用同一个 Bot，无需创建两个。

1. 在 [@BotFather](https://t.me/BotFather) 创建 Bot，保存 **Token**
2. 创建私有频道，将 Bot 加为管理员（需要发送消息权限）
3. 向频道发一条消息，访问以下地址获取 **Chat ID**（格式 `-100xxxxxxxxxx`）：
   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
```

---

#### S3 兼容存储

```bash
wrangler secret put S3_ACCESS_KEY
wrangler secret put S3_SECRET_KEY
```

---

#### WebDAV 存储

将 `WEBDAV_STORAGE_URL` 填入 `wrangler.toml`（非敏感），用户名密码设为 Secrets：

```bash
wrangler secret put WEBDAV_STORAGE_USER
wrangler secret put WEBDAV_STORAGE_PASS
```

常见 WebDAV 地址格式：

| 服务 | 地址格式 |
|------|---------|
| Nextcloud | `https://your.nc.com/remote.php/dav/files/<用户名>/` |
| 坚果云 | `https://dav.jianguoyun.com/dav/` |
| 群晖 | `https://your.nas.com/webdav/` |
| Box | `https://dav.box.com/dav/` |

---

#### Web UI 认证

```bash
wrangler secret put LOGIN_PASS       # 密码登录（与 WebDAV 密码独立）
```

#### WebDAV 对外接口认证

```bash
wrangler secret put WEBDAV_USER
wrangler secret put WEBDAV_PASS      # 与 LOGIN_PASS 完全独立
```

### 4. 部署

```bash
wrangler deploy
```

访问 `https://vaultdrive.<your-subdomain>.workers.dev`

---

## 认证说明

| 方式 | 环境变量 | 说明 |
|------|---------|------|
| Web UI 密码登录 | `LOGIN_PASS` | 独立于 WebDAV |
| Web UI 验证码 | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | 6 位 OTP，5 分钟有效 |
| WebDAV Basic Auth | `WEBDAV_USER` + `WEBDAV_PASS` | 供 rclone / Finder / Cyberduck |
| 关闭认证 | `AUTH_DISABLED=true` | 完全开放，慎用 |

---

## WebDAV 挂载本项目

**macOS Finder**
```
前往 → 连接服务器（⌘K）
https://<worker>.workers.dev/dav
```

**iOS 文件 App**
```
右上角 ··· → 连接服务器
https://<worker>.workers.dev/dav
```

**rclone**
```ini
[vaultdrive]
type = webdav
url = https://<worker>.workers.dev/dav
vendor = other
user = your_webdav_user
pass = your_webdav_pass_obfuscated
```

**Cyberduck / Mountain Duck**：协议 WebDAV (HTTPS)，路径 `/dav`

---

## 注意事项

- **Telegram 上传限制**：Bot API 单文件上限 50 MB
- **S3 上传限制**：取决于提供商，R2 单文件最大 5 GB
- **WebDAV 存储**：文件按日期分目录存放（`files/YYYY/MM/`），下载时 Worker 自动代理，不暴露远端凭证
- **KV 额度**：免费版 1 GB，仅存文本元数据，通常无需关心
- **Workers 请求额度**：免费版 10 万次/天，大量使用建议升级 Workers Paid（$5/月）
- **Telegram Bot 复用**：存储和验证码登录共用同一 Bot，无需创建两个
