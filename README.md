# VaultDrive

基于 Cloudflare Workers 的个人私有云盘。文件存储在你自己的后端，通过 Web UI 或 WebDAV 协议访问。零服务器、零运维、零依赖。

---

## 存储后端

选择其中一种，通过 `STORAGE` 变量切换：

| 后端 | 值 | 单文件限制 | 适合场景 |
|------|---|-----------|---------|
| Telegram | `telegram`（默认） | 50 MB | 免费无限空间 |
| S3 兼容 | `s3` | 5 GB | AWS / Cloudflare R2 / MinIO |
| WebDAV | `webdav` | 取决于服务商 | Nextcloud / 坚果云 / 群晖 / Box |

---

## 功能

- **Web UI** — 网格 / 列表视图，拖放上传，实时进度，搜索，图片 / 视频 / 音频预览
- **WebDAV** — 标准协议挂载，兼容 macOS Finder / iOS 文件 / Windows / rclone / Cyberduck
- **登录保护** — 密码登录、Telegram 验证码登录，可同时开启或完全关闭
- **响应式** — 桌面右键菜单，移动端底部 Sheet，禁止缩放

---

## 快速部署

### 1. 安装 Wrangler

```bash
npm install -g wrangler
wrangler login
```

### 2. 创建 KV Namespace

```bash
wrangler kv namespace create VAULTDRIVE_KV
```

将输出的 ID 填入 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "KV"
id = "你的 namespace id"
```

### 3. 编辑 `wrangler.toml`

```toml
[vars]
STORAGE       = "telegram"   # telegram | s3 | webdav
SESSION_TTL   = "86400"      # Session 有效期（秒）
AUTH_DISABLED = "false"      # true = 完全跳过登录
```

S3 额外配置（非敏感部分）：

```toml
S3_ENDPOINT   = "https://xxx.r2.cloudflarestorage.com"
S3_BUCKET     = "my-bucket"
S3_REGION     = "auto"
S3_PUBLIC_URL = "https://cdn.example.com"  # 可选，走 CDN 跳过 Worker 代理
```

WebDAV 额外配置（非敏感部分）：

```toml
WEBDAV_STORAGE_URL = "https://dav.example.com/remote.php/dav/files/user/"
```

### 4. 设置 Secrets

在 Cloudflare Dashboard（Workers & Pages → vaultdrive → Settings → Variables → Secrets）或命令行设置，**敏感信息不要写进 `wrangler.toml`**。

```bash
wrangler secret put <KEY>
```

根据使用的功能按需设置：

```
# Telegram 存储 + 验证码登录（共用同一 Bot）
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID

# S3 存储
S3_ACCESS_KEY
S3_SECRET_KEY

# WebDAV 存储
WEBDAV_STORAGE_USER
WEBDAV_STORAGE_PASS

# Web UI 登录密码
LOGIN_PASS

# WebDAV 对外接口（供 Finder / rclone 挂载）
WEBDAV_USER
WEBDAV_PASS
```

### 5. 部署

```bash
wrangler deploy
```

---

## 存储后端配置

### Telegram

1. 在 [@BotFather](https://t.me/BotFather) 创建 Bot，复制 Token
2. 创建私有频道，将 Bot 设为管理员（需要发送消息权限）
3. 向频道发一条消息，访问下方地址获取 Chat ID（格式 `-100xxxxxxxxxx`）：
   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```

### S3 兼容存储

填写 `wrangler.toml` 中的 `S3_ENDPOINT`、`S3_BUCKET`、`S3_REGION`，  
通过 Secrets 设置 `S3_ACCESS_KEY` 和 `S3_SECRET_KEY`。

Cloudflare R2 用户将 `S3_REGION` 设为 `auto`，端点格式为：
```
https://<account-id>.r2.cloudflarestorage.com
```

### WebDAV 存储

填写 `wrangler.toml` 中的 `WEBDAV_STORAGE_URL`，通过 Secrets 设置账号密码。

常见服务地址：

| 服务 | WebDAV 地址 |
|------|------------|
| Nextcloud | `https://your.nc.com/remote.php/dav/files/<用户名>/` |
| 坚果云 | `https://dav.jianguoyun.com/dav/` |
| 群晖 | `https://your.nas.com/webdav/` |
| Box | `https://dav.box.com/dav/` |

文件按日期分目录存放（`files/YYYY/MM/`），下载时 Worker 自动携带认证头代理，不暴露远端凭证。

---

## 登录方式

| 方式 | 所需变量 | 说明 |
|------|---------|------|
| 密码登录 | `LOGIN_PASS` | 与 WebDAV 密码完全独立 |
| 验证码登录 | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | 6 位 OTP，5 分钟有效，复用存储 Bot |
| 关闭登录 | `AUTH_DISABLED=true` | 完全开放访问，慎用 |

两种方式同时配置时，登录页自动出现 Tab 切换；只配一种则只显示对应方式。

---

## WebDAV 挂载

挂载地址：`https://vaultdrive.<your-subdomain>.workers.dev/dav`  
账号密码：`WEBDAV_USER` / `WEBDAV_PASS`

**macOS Finder** → 前往 → 连接服务器（`⌘K`）→ 粘贴地址

**iOS 文件 App** → 右上角 `···` → 连接服务器 → 粘贴地址

**rclone**

```ini
[vaultdrive]
type = webdav
url  = https://vaultdrive.<your-subdomain>.workers.dev/dav
vendor = other
user = WEBDAV_USER
pass = WEBDAV_PASS  # 需用 rclone obscure 加密
```

**Cyberduck / Mountain Duck** — 协议选 WebDAV (HTTPS)，路径填 `/dav`

---

## 项目结构

```
vaultdrive/
├── wrangler.toml     # 配置入口
├── package.json
├── preview.html      # 本地预览（mock 数据，直接浏览器打开）
└── src/
    ├── index.js      # 路由 + Session 鉴权
    ├── auth.js       # 登录 / 登出 / Telegram OTP
    ├── storage.js    # 存储抽象层（Telegram / S3 / WebDAV）
    ├── telegram.js   # Telegram Bot API
    ├── webdav.js     # WebDAV 协议（对外）
    ├── api.js        # REST API（Web UI 专用）
    ├── store.js      # KV 元数据
    └── ui.js         # Web UI SPA
```

---

## 注意事项

- Worker 本身**零依赖**，`package.json` 里只有 `wrangler`（本地 CLI 工具）
- KV 仅存文本元数据，免费版 1 GB 通常够用
- Workers 免费版 10 万请求/天，大量使用建议升级 Paid（$5/月）
- Telegram Bot 在存储和验证码登录两个功能中复用，无需创建两个 Bot
