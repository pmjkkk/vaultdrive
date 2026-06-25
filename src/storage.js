// ============================================================
//  storage.js — 统一存储抽象层
//
//  根据 env.STORAGE 选择后端：
//    'telegram'（默认）→ Telegram Bot API
//    's3'             → S3 兼容存储（AWS / R2 / MinIO 等）
//
//  S3 所需环境变量：
//    S3_ENDPOINT       端点 URL，如 https://xxx.r2.cloudflarestorage.com
//    S3_BUCKET         Bucket 名称
//    S3_ACCESS_KEY     Access Key ID
//    S3_SECRET_KEY     Secret Access Key
//    S3_REGION         区域，默认 auto（R2 专用）
//    S3_PUBLIC_URL     可选，文件公开下载的 CDN 前缀（不设则走 Worker 代理）
// ============================================================

import { tgUpload, tgDownloadURL } from './telegram.js';

// ── 上传 ─────────────────────────────────────────────────────
export async function storageUpload(env, buffer, filename, mime) {
  if (env.STORAGE === 's3') return s3Upload(env, buffer, filename, mime);
  return tgUpload(env, buffer, filename, mime);
}

// ── 下载 URL ─────────────────────────────────────────────────
export async function storageDownloadURL(env, meta) {
  if (env.STORAGE === 's3') return s3DownloadURL(env, meta);
  return tgDownloadURL(env, meta.fileId);
}

// ── 删除文件实体（S3 需要，TG 不删消息）─────────────────────
export async function storageDelete(env, meta) {
  if (env.STORAGE === 's3' && meta.s3Key) {
    await s3Request(env, 'DELETE', meta.s3Key);
  }
  // Telegram 不支持 Bot 删除已发消息，仅删 KV 元数据即可
}

// ════════════════════════════════════════════════════════════
//  S3 实现（纯 fetch + AWS Sig V4，无 SDK 依赖）
// ════════════════════════════════════════════════════════════

async function s3Upload(env, buffer, filename, mime) {
  // S3 key = 用时间戳防重名
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
  // 优先用公开 CDN
  if (env.S3_PUBLIC_URL) {
    return `${env.S3_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  }
  // 否则生成预签名 URL（有效期 1 小时）
  return presign(env, key, 3600);
}

// ── S3 请求（Signature V4）────────────────────────────────────
async function s3Request(env, method, key, body, extraHeaders = {}) {
  const endpoint = env.S3_ENDPOINT.replace(/\/$/, '');
  const bucket   = env.S3_BUCKET;
  const region   = env.S3_REGION || 'auto';
  const url      = `${endpoint}/${bucket}/${key}`;

  const now     = new Date();
  const dateStr = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z'; // 20240101T120000Z
  const dateKey = dateStr.slice(0, 8); // 20240101

  const payloadHash = body
    ? await sha256hex(body)
    : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  const headers = {
    host:                new URL(endpoint).host,
    'x-amz-date':        dateStr,
    'x-amz-content-sha256': payloadHash,
    ...extraHeaders,
  };
  if (method === 'PUT' && !headers['Content-Type'])
    headers['Content-Type'] = 'application/octet-stream';

  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort()
    .map(k => `${k}:${headers[k]}\n`).join('');
  const canonicalRequest = [
    method,
    `/${bucket}/${key}`,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credScope = `${dateKey}/${region}/s3/aws4_request`;
  const strToSign = [
    'AWS4-HMAC-SHA256',
    dateStr,
    credScope,
    await sha256hex(canonicalRequest),
  ].join('\n');

  const signingKey = await hmacChain(
    `AWS4${env.S3_SECRET_KEY}`, dateKey, region, 's3', 'aws4_request'
  );
  const signature = await hmacHex(signingKey, strToSign);

  const authorization = `AWS4-HMAC-SHA256 Credential=${env.S3_ACCESS_KEY}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

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

// ── 预签名 URL（GET）────────────────────────────────────────
async function presign(env, key, expiry) {
  const endpoint = env.S3_ENDPOINT.replace(/\/$/, '');
  const bucket   = env.S3_BUCKET;
  const region   = env.S3_REGION || 'auto';

  const now     = new Date();
  const dateStr = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateKey = dateStr.slice(0, 8);
  const credScope = `${dateKey}/${region}/s3/aws4_request`;
  const credential = `${env.S3_ACCESS_KEY}/${credScope}`;

  const params = new URLSearchParams({
    'X-Amz-Algorithm':  'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date':       dateStr,
    'X-Amz-Expires':    String(expiry),
    'X-Amz-SignedHeaders': 'host',
  });

  const host = new URL(endpoint).host;
  const canonicalRequest = [
    'GET',
    `/${bucket}/${key}`,
    params.toString(),
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const strToSign = [
    'AWS4-HMAC-SHA256',
    dateStr,
    credScope,
    await sha256hex(canonicalRequest),
  ].join('\n');

  const signingKey = await hmacChain(
    `AWS4${env.S3_SECRET_KEY}`, dateKey, region, 's3', 'aws4_request'
  );
  const sig = await hmacHex(signingKey, strToSign);
  params.append('X-Amz-Signature', sig);

  return `${endpoint}/${bucket}/${key}?${params}`;
}

// ── Crypto helpers ────────────────────────────────────────────
async function sha256hex(data) {
  const buf = typeof data === 'string'
    ? new TextEncoder().encode(data)
    : data instanceof ArrayBuffer ? data : data.buffer ?? data;
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(key, data) {
  const keyBuf = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const k = await crypto.subtle.importKey('raw', keyBuf, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
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
