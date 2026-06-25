// ============================================================
//  api.js — REST API（供 Web UI 调用）
//  存储后端由 storage.js 统一抽象
// ============================================================

import { listDir, getFileMeta, saveFileMeta, deleteFileMeta, moveFileMeta }
  from './store.js';
import { storageUpload, storageDownloadURL, storageDelete, storageProxyDownload } from './storage.js';

export async function handleAPI(request, env, url) {
  const endpoint = url.pathname.slice('/api/'.length);
  try {
    switch (endpoint) {
      case 'upload':   return await apiUpload(request, env, url);
      case 'list':     return await apiList(env, url);
      case 'download': return await apiDownload(env, url);
      case 'delete':   return await apiDelete(env, url);
      case 'mkdir':    return await apiMkdir(request, env);
      case 'rename':   return await apiRename(request, env);
      case 'stat':     return await apiStat(env, url);
      default:         return json({ error: 'Not Found' }, 404);
    }
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// POST /api/upload?path=/folder
async function apiUpload(request, env, url) {
  const dir  = url.searchParams.get('path') || '/';
  const form = await request.formData();
  const file = form.get('file');
  if (!file) return json({ error: 'No file field' }, 400);

  const buffer   = await file.arrayBuffer();
  const filename = file.name || 'upload';
  const mime     = file.type || 'application/octet-stream';
  const filePath = dir === '/' ? `/${filename}` : `${dir}/${filename}`;

  const { fileId, s3Key, size } = await storageUpload(env, buffer, filename, mime);

  const meta = {
    type: 'file', path: filePath, name: filename,
    size, mime, fileId, s3Key, mtime: Date.now(), etag: fileId,
    storage: env.STORAGE || 'telegram',
  };
  await saveFileMeta(env, filePath, meta);
  return json({ ok: true, path: filePath, size });
}

// GET /api/list?path=/folder
async function apiList(env, url) {
  const dir   = url.searchParams.get('path') || '/';
  const items = await listDir(env, dir);
  return json({ ok: true, path: dir, items });
}

// GET /api/download?path=...
async function apiDownload(env, url) {
  const path = url.searchParams.get('path');
  if (!path) return json({ error: 'path required' }, 400);

  const meta = await getFileMeta(env, path);
  if (!meta)             return new Response('Not Found', { status: 404 });
  if (meta.type === 'dir') return json({ error: 'Is a directory' }, 400);

  // WebDAV 后端需带认证头代理，不能直接返回裸 URL
  const upstream = env.STORAGE === 'webdav'
    ? await storageProxyDownload(env, meta)
    : await fetch(await storageDownloadURL(env, meta));
  return new Response(upstream.body, {
    headers: {
      'Content-Type':        meta.mime || 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
      'Content-Length':      String(meta.size || 0),
    }
  });
}

// DELETE /api/delete?path=...
async function apiDelete(env, url) {
  const path = url.searchParams.get('path');
  if (!path) return json({ error: 'path required' }, 400);
  const meta = await getFileMeta(env, path);
  if (meta) await storageDelete(env, meta);
  await deleteFileMeta(env, path);
  return json({ ok: true });
}

// POST /api/mkdir  { path }
async function apiMkdir(request, env) {
  const { path } = await request.json();
  if (!path) return json({ error: 'path required' }, 400);
  if (await getFileMeta(env, path)) return json({ error: 'Already exists' }, 409);
  const name = path.split('/').filter(Boolean).pop() || path;
  await saveFileMeta(env, path, { type: 'dir', path, name, mtime: Date.now(), etag: String(Date.now()) });
  return json({ ok: true, path });
}

// POST /api/rename  { from, to }
async function apiRename(request, env) {
  const { from, to } = await request.json();
  if (!from || !to) return json({ error: 'from/to required' }, 400);
  await moveFileMeta(env, from, to);
  return json({ ok: true });
}

// GET /api/stat?path=
async function apiStat(env, url) {
  const path = url.searchParams.get('path');
  if (!path) return json({ error: 'path required' }, 400);
  const meta = await getFileMeta(env, path);
  if (!meta) return json({ error: 'Not Found' }, 404);
  return json({ ok: true, meta });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' }
  });
}
