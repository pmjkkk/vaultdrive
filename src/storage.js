// ============================================================
//  storage.js — 统一存储抽象层
//
//  env.storage 选择后端：
//    'telegram'（默认）→ Telegram Bot API
//    's3'             → S3 兼容存储（AWS / R2 / MinIO 等）
//    'webdav'         → 远程 WebDAV 服务器（Nextcloud / 群晖 / 坚果云等）
//
//  WebDAV 存储所需环境变量：
//    webdav_storage_url    远程 WebDAV 根地址，如 https://dav.example.com/remote.php/dav/files/user/
//    webdav_storage_user   远程 WebDAV 用户名
//    webdav_storage_pass   远程 WebDAV 密码
//
//  注意：webdav_user / webdav_pass 是本项目自身对外暴露的 WebDAV 接口凭证，
//        webdav_storage_* 是连接远端 WebDAV 服务器的凭证，两者完全独立。
//
//  S3 所需环境变量：
//    s3_endpoint    s3_bucket    s3_access_key    s3_secret_key
//    s3_region（默认 auto）    s3_public_url（可选，公开 CDN 前缀）
// ============================================================

import { tgUpload, tgDownloadURL } from './telegram.js';

// ── 上传 ─────────────────────────────────────────────────────
export async function storageUpload(env, buffer, filename, mime) {
  switch (env.storage) {
    case 's3':     return s3Upload(env, buffer, filename, mime);
    case 'webdav': return wdUpload(env, buffer, filename, mime);
    default:       return tgUpload(env, buffer, filename, mime);
  }
}

// ── 下载（返回 Response 或 URL 字符串）───────────────────────
export async function storageDownloadURL(env, meta) {
  switch (env.storage) {
    case 's3':     return s3DownloadURL(env, meta);
    case 'webdav': return wdDownloadURL(env, meta);
    default:       return tgDownloadURL(env, meta.fileId);
  }
}

// ── 删除文件实体 ──────────────────────────────────────────────
export async function storageDelete(env, meta) {
  switch (env.storage) {
    case 's3':
      if (meta.s3Key) await s3Request(env, 'DELETE', meta.s3Key);
      break;
    case 'webdav':
      if (meta.wdPath) await wdRequest(env, 'DELETE', meta.wdPath);
      break;
    // Telegram：Bot 无法删除已发消息，仅删 KV 元数据
  }
}

// ════════════════════════════════════════════════════════════
//  WebDAV 远程存储实现
// ════════════════════════════════════════════════════════════

function wdBase(env) {
  return env.webdav_storage_url.replace(/\/$/, '');
}

function wdAuth(env) {
  return 'Basic ' + btoa(`${env.webdav_storage_user}:${env.webdav_storage_pass}`);
}

// 确保远端目录存在（MKCOL，忽略 405 已存在）
async function wdMkcol(env, dirPath) {
  const url = `${wdBase(env)}/${dirPath}`;
  const r   = await fetch(url, {
    method: 'MKCOL',
    headers: { Authorization: wdAuth(env) }
  });
  if (!r.ok && r.status !== 405 && r.status !== 409) {
    // 409 = 父级不存在；递归创建父目录
    const parent = dirPath.split('/').slice(0, -1).join('/');
    if (parent) await wdMkcol(env, parent);
    await fetch(url, { method: 'MKCOL', headers: { Authorization: wdAuth(env) } });
  }
}

async function wdUpload(env, buffer, filename, mime) {
  // 用日期分目录：files/2024/01/timestamp-filename
  const now    = new Date();
  const dir    = `files/${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}`;
  const safeFilename = filename.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fff]/g, '_');
  const wdPath = `${dir}/${Date.now()}-${safeFilename}`;

  await wdMkcol(env, dir);

  const url  = `${wdBase(env)}/${wdPath}`;
  const resp = await fetch(url, {
    method:  'PUT',
    headers: {
      Authorization:  wdAuth(env),
      'Content-Type': mime,
    },
    body: buffer,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`WebDAV upload failed ${resp.status}: ${text.slice(0, 200)}`);
  }

  return { fileId: wdPath, wdPath, size: buffer.byteLength };
}

function wdDownloadURL(env, meta) {
  const path = meta.wdPath || meta.fileId;
  // 通过 Worker 代理下载（避免暴露存储凭证）
  return `${wdBase(env)}/${path}`;
}

async function wdRequest(env, method, wdPath) {
  const url = `${wdBase(env)}/${wdPath}`;
  return fetch(url, {
    method,
    headers: { Authorization: wdAuth(env) }
  });
}

// ── 代理下载（WebDAV 后端专用，带认证头）────────────────────
export async function storageProxyDownload(env, meta) {
  if (env.storage !== 'webdav') return null;
  const path = meta.wdPath || meta.fileId;
  const url  = `${wdBase(env)}/${path}`;
  return fetch(url, { headers: { Authorization: wdAuth(env) } });
}

// ════════════════════════════════════════════════════════════
//  S3 实现（纯 fetch + AWS Sig V4，无 SDK 依赖）
// ════════════════════════════════════════════════════════════

async function s3Upload(env, buffer, filename, mime) {
  const key  = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._\-]/g, '_')}`;
  const size = buffer.byteLength;
  await s3Request(env, 'PUT', key, buffer, {
    'Content-Type':   mime,
    'Content-Length': String(size),
  });
  return { fileId: key, s3Key: key, size };
}

async function s3DownloadURL(env, meta) {
  const key = meta.s3Key || meta.fileId;
  if (env.s3_public_url) return `${env.s3_public_url.replace(/\/$/, '')}/${key}`;
  return presign(env, key, 3600);
}

async function s3Request(env, method, key, body, extraHeaders = {}) {
  const endpoint = env.s3_endpoint.replace(/\/$/, '');
  const bucket   = env.s3_bucket;
  const region   = env.s3_region || 'auto';
  const url      = `${endpoint}/${bucket}/${key}`;

  const now     = new Date();
  const dateStr = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateKey = dateStr.slice(0, 8);

  const payloadHash = body
    ? await sha256hex(body)
    : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  const headers = {
    host:                    new URL(endpoint).host,
    'x-amz-date':            dateStr,
    'x-amz-content-sha256':  payloadHash,
    ...extraHeaders,
  };
  if (method === 'PUT' && !headers['Content-Type'])
    headers['Content-Type'] = 'application/octet-stream';

  const signedHeaders    = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join('');
  const canonicalRequest = [method, `/${bucket}/${key}`, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const credScope  = `${dateKey}/${region}/s3/aws4_request`;
  const strToSign  = ['AWS4-HMAC-SHA256', dateStr, credScope, await sha256hex(canonicalRequest)].join('\n');
  const signingKey = await hmacChain(`AWS4${env.s3_secret_key}`, dateKey, region, 's3', 'aws4_request');
  const signature  = await hmacHex(signingKey, strToSign);

  const authorization = `AWS4-HMAC-SHA256 Credential=${env.s3_access_key}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const resp = await fetch(url, {
    method,
    headers: { ...headers, Authorization: authorization },
    body: body || undefined,
  });

  if (!resp.ok && method !== 'DELETE') {
    const text = await resp.text();
    throw new Error(`S3 ${method} failed ${resp.status}: ${text.slice(0, 200)}`);
  }
  return resp;
}

async function presign(env, key, expiry) {
  const endpoint  = env.s3_endpoint.replace(/\/$/, '');
  const bucket    = env.s3_bucket;
  const region    = env.s3_region || 'auto';
  const now       = new Date();
  const dateStr   = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateKey   = dateStr.slice(0, 8);
  const credScope = `${dateKey}/${region}/s3/aws4_request`;

  const params = new URLSearchParams({
    'X-Amz-Algorithm':     'AWS4-HMAC-SHA256',
    'X-Amz-Credential':    `${env.s3_access_key}/${credScope}`,
    'X-Amz-Date':          dateStr,
    'X-Amz-Expires':       String(expiry),
    'X-Amz-SignedHeaders': 'host',
  });

  const host             = new URL(endpoint).host;
  const canonicalRequest = ['GET', `/${bucket}/${key}`, params.toString(), `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const strToSign        = ['AWS4-HMAC-SHA256', dateStr, credScope, await sha256hex(canonicalRequest)].join('\n');
  const signingKey       = await hmacChain(`AWS4${env.s3_secret_key}`, dateKey, region, 's3', 'aws4_request');
  const sig              = await hmacHex(signingKey, strToSign);

  params.append('X-Amz-Signature', sig);
  return `${endpoint}/${bucket}/${key}?${params}`;
}

// ── Crypto helpers ────────────────────────────────────────────
async function sha256hex(data) {
  const buf  = typeof data === 'string' ? new TextEncoder().encode(data)
             : data instanceof ArrayBuffer ? data : data.buffer ?? data;
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hmac(key, data) {
  const keyBuf = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const k   = await crypto.subtle.importKey('raw', keyBuf, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}
async function hmacHex(key, data) {
  return [...await hmac(key, data)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hmacChain(key, ...parts) {
  let k = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  for (const p of parts) k = await hmac(k, p);
  return k;
}
