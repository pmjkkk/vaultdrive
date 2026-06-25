// storage.js — 统一存储抽象
// env.storage: 'telegram'（默认）| 's3' | 'webdav'

import { tgUpload, tgDownloadURL } from './telegram.js';

export async function storageUpload(env, buffer, filename, mime) {
  switch (env.storage) {
    case 's3':     return s3Upload(env, buffer, filename, mime);
    case 'webdav': return wdUpload(env, buffer, filename, mime);
    default:       return tgUpload(env, buffer, filename, mime);
  }
}

export async function storageDownloadURL(env, meta) {
  switch (env.storage) {
    case 's3':     return s3DownloadURL(env, meta);
    case 'webdav': return `${wdBase(env)}/${meta.fileId}`;
    default:       return tgDownloadURL(env, meta.fileId);
  }
}

export async function storageDelete(env, meta) {
  if (env.storage === 's3'     && meta.fileId) await s3Request(env, 'DELETE', meta.fileId);
  if (env.storage === 'webdav' && meta.fileId) await wdRequest(env, 'DELETE', meta.fileId);
}

// WebDAV 后端下载需携带认证头，通过 Worker 代理
export async function storageProxyDownload(env, meta) {
  return fetch(`${wdBase(env)}/${meta.fileId}`, { headers: { Authorization: wdAuth(env) } });
}

// ── WebDAV ───────────────────────────────────────────────────
const wdBase = env => env.webdav_storage_url.replace(/\/$/, '');
const wdAuth = env => 'Basic ' + btoa(`${env.webdav_storage_user}:${env.webdav_storage_pass}`);

async function wdMkcol(env, dir) {
  const r = await fetch(`${wdBase(env)}/${dir}`, { method: 'MKCOL', headers: { Authorization: wdAuth(env) } });
  if (!r.ok && r.status !== 405) {
    const parent = dir.split('/').slice(0, -1).join('/');
    if (parent) await wdMkcol(env, parent);
    await fetch(`${wdBase(env)}/${dir}`, { method: 'MKCOL', headers: { Authorization: wdAuth(env) } });
  }
}

async function wdUpload(env, buffer, filename, mime) {
  const d   = new Date();
  const dir = `files/${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}`;
  const key = `${dir}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fff]/g, '_')}`;

  await wdMkcol(env, dir);
  const resp = await fetch(`${wdBase(env)}/${key}`, {
    method: 'PUT',
    headers: { Authorization: wdAuth(env), 'Content-Type': mime },
    body: buffer,
  });
  if (!resp.ok) throw new Error(`WebDAV upload failed ${resp.status}`);
  return { fileId: key, size: buffer.byteLength };
}

async function wdRequest(env, method, key) {
  return fetch(`${wdBase(env)}/${key}`, { method, headers: { Authorization: wdAuth(env) } });
}

// ── S3 (AWS Signature V4) ─────────────────────────────────────
async function s3Upload(env, buffer, filename, mime) {
  const key = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._\-]/g, '_')}`;
  await s3Request(env, 'PUT', key, buffer, { 'Content-Type': mime, 'Content-Length': String(buffer.byteLength) });
  return { fileId: key, size: buffer.byteLength };
}

async function s3DownloadURL(env, meta) {
  if (env.s3_public_url) return `${env.s3_public_url.replace(/\/$/, '')}/${meta.fileId}`;
  return s3Presign(env, meta.fileId, 3600);
}

async function s3Request(env, method, key, body, extra = {}) {
  const endpoint = env.s3_endpoint.replace(/\/$/, '');
  const bucket   = env.s3_bucket;
  const region   = env.s3_region || 'auto';
  const url      = `${endpoint}/${bucket}/${key}`;
  const now      = new Date();
  const dateStr  = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateKey  = dateStr.slice(0, 8);
  const hash     = body ? await sha256hex(body) : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  const headers = { host: new URL(endpoint).host, 'x-amz-date': dateStr, 'x-amz-content-sha256': hash, ...extra };
  if (method === 'PUT' && !headers['Content-Type']) headers['Content-Type'] = 'application/octet-stream';

  const sh  = Object.keys(headers).sort().join(';');
  const ch  = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join('');
  const cr  = [method, `/${bucket}/${key}`, '', ch, sh, hash].join('\n');
  const cs  = `${dateKey}/${region}/s3/aws4_request`;
  const sts = ['AWS4-HMAC-SHA256', dateStr, cs, await sha256hex(cr)].join('\n');
  const sk  = await hmacChain(`AWS4${env.s3_secret_key}`, dateKey, region, 's3', 'aws4_request');
  const sig = await hmacHex(sk, sts);

  const resp = await fetch(url, {
    method,
    headers: { ...headers, Authorization: `AWS4-HMAC-SHA256 Credential=${env.s3_access_key}/${cs}, SignedHeaders=${sh}, Signature=${sig}` },
    body: body || undefined,
  });
  if (!resp.ok && method !== 'DELETE') throw new Error(`S3 ${method} failed ${resp.status}: ${(await resp.text()).slice(0,200)}`);
  return resp;
}

async function s3Presign(env, key, expiry) {
  const endpoint = env.s3_endpoint.replace(/\/$/, '');
  const bucket   = env.s3_bucket;
  const region   = env.s3_region || 'auto';
  const now      = new Date();
  const dateStr  = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateKey  = dateStr.slice(0, 8);
  const cs       = `${dateKey}/${region}/s3/aws4_request`;
  const host     = new URL(endpoint).host;

  const params = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': `${env.s3_access_key}/${cs}`,
    'X-Amz-Date': dateStr, 'X-Amz-Expires': String(expiry), 'X-Amz-SignedHeaders': 'host',
  });
  const cr  = ['GET', `/${bucket}/${key}`, params.toString(), `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const sts = ['AWS4-HMAC-SHA256', dateStr, cs, await sha256hex(cr)].join('\n');
  const sk  = await hmacChain(`AWS4${env.s3_secret_key}`, dateKey, region, 's3', 'aws4_request');
  params.append('X-Amz-Signature', await hmacHex(sk, sts));
  return `${endpoint}/${bucket}/${key}?${params}`;
}

// ── Crypto ────────────────────────────────────────────────────
async function sha256hex(data) {
  const buf  = typeof data === 'string' ? new TextEncoder().encode(data) : data instanceof ArrayBuffer ? data : data.buffer ?? data;
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,'0')).join('');
}
async function hmac(key, data) {
  const k   = await crypto.subtle.importKey('raw', typeof key === 'string' ? new TextEncoder().encode(key) : key, { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)));
}
const hmacHex   = async (k, d) => [...await hmac(k, d)].map(b => b.toString(16).padStart(2,'0')).join('');
async function hmacChain(key, ...parts) {
  let k = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  for (const p of parts) k = await hmac(k, p);
  return k;
}
