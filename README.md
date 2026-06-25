# VaultDrive

> 基于 Cloudflare Workers 的个人云盘，支持 Telegram 和 S3 双存储后端，提供 Web UI 与标准 WebDAV 协议挂载。零服务器、零运维。

---

## 技术栈

| 层 | 说明 |
|---|---|
| 运行时 | Cloudflare Workers（V8 隔离，零依赖运行时） |
| 文件存储 | Telegram Bot API **或** S3 兼容存储（AWS / Cloudflare R2 / MinIO） |
| 元数据 | Cloudflare Workers KV |
| 前端 | 原生 HTML / CSS / JS，内嵌于 Worker |
| WebDAV | 自实现，兼容 macOS Finder / Windows / rclone / Cyberduck |

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
- **密码登录**：设置 `LOGIN_PASS`（独立于 WebDAV 密码）
- **Telegram 验证码登录**：设置 Bot Token + Chat ID
- 两种方式均可单独或同时开启；同时开启时登录页出现 Tab 切换
- Session Cookie，默认 24 小时有效
- `AUTH_DISABLED=true` 完全跳过认证

**WebDAV**
- 挂载点：`https://<worker>.workers.dev/dav`
- 认证：Basic Auth（`WEBDAV_USER` / `WEBDAV_PASS`，与 Web UI 密码完全独立）
- 支持：`GET / PUT / DELETE / MKCOL / PROPFIND / MOVE / COPY / LOCK`

---

## 项目结构

```
vaultdrive/
├── wrangler.toml        # Worker 配置与 Secrets 说明
├── package.json         # 仅含 wrangler CLI（Worker 本身零依赖）
├── preview.html         # 本地预览（含 mock 数据，无需部署直接打开）
└── src/
    ├── index.js         # 入口：路由 + 鉴权
    ├── auth.js          # 登录 / 登出 / Telegram OTP
    ├── storage.js       # 存储抽象（Telegram / S3 统一接口）
    ├── telegram.js      # Telegram Bot API 封装
    ├── webdav.js        # WebDAV 协议实现
    ├── api.js           # REST API（供 Web UI 调用）
    ├── store.js         # KV 元数据层
    └── ui.js            # Web UI 完整 SPA
```

> **Worker 本身不需要安装任何依赖**，`package.json` 里只有 `wrangler`（本地 CLI 工具，用于开发和部署）。

---

## 部署

### 前置：安装 Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

> 这只是安装本地 CLI 工具，不是 Worker 的运行时依赖。

### 2. 编辑 `wrangler.toml`

打开 `wrangler.toml`，按需修改 `[vars]` 区块：

```toml
[vars]
STORAGE       = "telegram"   # 或 "s3"
SESSION_TTL   = "86400"      # Session 有效期（秒）
AUTH_DISABLED = "false"      # 改为 "true" 可完全跳过认证

# S3 时额外填写（非敏感部分）
# S3_ENDPOINT  = "https://xxx.r2.cloudflarestorage.com"
# S3_BUCKET    = "my-bucket"
# S3_REGION    = "auto"
# S3_PUBLIC_URL = "https://cdn.example.com"
```

同时将 KV 的 `id` 填入：

```toml
[[kv_namespaces]]
binding = "KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### 3. 选择存储后端

#### 方案 A：Telegram（免费，无存储上限）

1. 在 [@BotFather](https://t.me/BotFather) 创建 Bot，保存 **Token**
2. 创建私有频道，将 Bot 加为管理员
3. 发一条消息后访问 `https://api.telegram.org/bot<TOKEN>/getUpdates` 获取 **Chat ID**

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
# STORAGE 默认即为 telegram，无需额外设置
```

#### 方案 B：S3 兼容存储（AWS S3 / Cloudflare R2 / MinIO）

```bash
wrangler secret put STORAGE          # 输入 s3
wrangler secret put S3_ENDPOINT      # 如 https://xxx.r2.cloudflarestorage.com
wrangler secret put S3_BUCKET
wrangler secret put S3_ACCESS_KEY
wrangler secret put S3_SECRET_KEY
wrangler secret put S3_REGION        # AWS 填 us-east-1；R2 填 auto
wrangler secret put S3_PUBLIC_URL    # 可选，公开 CDN 前缀
```

### 3. 配置 Web UI 认证（至少一种）

```bash
# 密码登录
wrangler secret put LOGIN_PASS

# Telegram 验证码登录（复用存储的 Bot Token，无需重复设置）

# 可选
wrangler secret put SESSION_TTL      # 默认 86400（秒）
wrangler secret put AUTH_DISABLED    # true = 完全跳过认证
```

### 4. 配置 WebDAV 认证

```bash
wrangler secret put WEBDAV_USER
wrangler secret put WEBDAV_PASS      # 与 LOGIN_PASS 完全独立
```

### 5. 部署

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

两种 Web UI 方式均未配置时，访问首页显示配置提示，不会暴露内容。

---

## WebDAV 挂载

**macOS Finder**
```
前往 → 连接服务器
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
- **KV 额度**：免费版 1 GB，仅存文本元数据，通常无需关心
- **Workers 请求额度**：免费版 10 万次/天，大量使用建议升级 Paid（$5/月）
- **Telegram Bot 复用**：存储和验证码登录共用同一个 Bot，无需创建两个
