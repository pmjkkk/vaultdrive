# VaultDrive

基于 Cloudflare Workers 的个人私有云盘。文件存储在你自己的后端，通过 Web UI 或 WebDAV 协议访问。零服务器、零运维、零依赖。

---

## 存储后端

选择其中一种，通过 `storage` 变量切换：

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

## 部署

### 1. Fork 或导入仓库

将本仓库 Fork 到你的 GitHub 账号，或直接在 Cloudflare Workers 中导入。

### 2. 创建 KV Namespace

进入 **Cloudflare Dashboard → Workers & Pages → KV** → 点击 **Create namespace**，名称填 `vaultdrive_kv`，创建后复制 Namespace ID。

### 3. 在 Workers 中绑定 KV

进入 **Workers & Pages → vaultdrive → Settings → Bindings** → 点击 **Add** → 选择 **KV Namespace**：

- Variable name：`KV`
- KV Namespace：选择刚创建的 `vaultdrive_kv`

### 4. 配置环境变量

进入 **Workers & Pages → vaultdrive → Settings → Variables and Secrets**。

添加以下变量（根据所选存储后端和登录方式按需填写）：

#### 通用

| 变量 | 类型 | 说明 |
|------|------|------|
| `storage` | Text | 存储后端：`telegram` / `s3` / `webdav`，默认 `telegram` |
| `session_ttl` | Text | Session 有效期（秒），默认 `86400` |
| `auth_disabled` | Text | `true` 完全跳过登录，默认 `false` |

#### Telegram 存储 / 验证码登录

> 两个功能共用同一个 Bot，无需创建两个。

| 变量 | 类型 | 说明 |
|------|------|------|
| `telegram_bot_token` | Secret | Bot Token，从 @BotFather 获取 |
| `telegram_chat_id` | Secret | 私有频道 Chat ID，格式 `-100xxxxxxxxxx` |

获取 Chat ID：向频道发一条消息，访问：
```
https://api.telegram.org/bot<TOKEN>/getUpdates
```
在返回结果中找 `chat.id` 字段。

#### S3 兼容存储

| 变量 | 类型 | 说明 |
|------|------|------|
| `s3_endpoint` | Text | 端点 URL，如 `https://xxx.r2.cloudflarestorage.com` |
| `s3_bucket` | Text | Bucket 名称 |
| `s3_region` | Text | 区域，Cloudflare R2 填 `auto` |
| `s3_access_key` | Secret | Access Key ID |
| `s3_secret_key` | Secret | Secret Access Key |
| `s3_public_url` | Text | 可选，公开 CDN 前缀，有则跳过 Worker 代理 |

#### WebDAV 存储

常见服务的 WebDAV 地址：

| 服务 | 地址 |
|------|------|
| Nextcloud | `https://your.nc.com/remote.php/dav/files/<用户名>/` |
| 坚果云 | `https://dav.jianguoyun.com/dav/` |
| 群晖 | `https://your.nas.com/webdav/` |
| Box | `https://dav.box.com/dav/` |

| 变量 | 类型 | 说明 |
|------|------|------|
| `webdav_storage_url` | Text | 远端 WebDAV 根地址（见上表） |
| `webdav_storage_user` | Secret | 远端 WebDAV 用户名 |
| `webdav_storage_pass` | Secret | 远端 WebDAV 密码 |

#### Web UI 登录

| 变量 | 类型 | 说明 |
|------|------|------|
| `login_pass` | Secret | 密码登录，与 WebDAV 密码完全独立 |

#### WebDAV 对外接口

供 Finder / rclone / Cyberduck 等客户端挂载使用。

| 变量 | 类型 | 说明 |
|------|------|------|
| `webdav_user` | Secret | WebDAV 用户名 |
| `webdav_pass` | Secret | WebDAV 密码 |

### 5. 部署

配置完成后点击 **Save and deploy**，等待部署完成即可访问。

---

## 登录方式

| 方式 | 所需变量 | 说明 |
|------|---------|------|
| 密码登录 | `login_pass` | 与 WebDAV 密码完全独立 |
| 验证码登录 | `telegram_bot_token` + `telegram_chat_id` | 6 位 OTP，5 分钟有效 |
| 关闭登录 | `auth_disabled=true` | 完全开放访问，慎用 |

两种方式同时配置时，登录页自动出现 Tab 切换；只配一种则只显示对应方式。

---

## WebDAV 挂载

挂载地址：`https://vaultdrive.<your-subdomain>.workers.dev/dav`  
账号密码：`webdav_user` / `webdav_pass`

**macOS Finder** → 前往 → 连接服务器（`⌘K`）→ 粘贴地址

**iOS 文件 App** → 右上角 `···` → 连接服务器 → 粘贴地址

**rclone**

```ini
[vaultdrive]
type   = webdav
url    = https://vaultdrive.<your-subdomain>.workers.dev/dav
vendor = other
user   = webdav_user
pass   = webdav_pass  # 需用 rclone obscure 加密
```

**Cyberduck / Mountain Duck** — 协议选 WebDAV (HTTPS)，路径填 `/dav`

---

## 项目结构

```
vaultdrive/
├── wrangler.toml     # Worker 基础配置（name / kv_namespaces）
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

- KV 仅存文本元数据，免费版 1 GB 通常够用
- Workers 免费版 10 万请求/天，大量使用建议升级 Paid（$5/月）
- Telegram Bot 在存储和验证码登录中复用，无需创建两个
- WebDAV 存储文件按日期分目录（`files/YYYY/MM/`），下载时 Worker 自动代理，不暴露远端凭证
