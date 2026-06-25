import { listDir, getFileMeta, saveFileMeta, deleteFileMeta, moveFileMeta } from './store.js';
import { storageUpload, storageDownloadURL, storageDelete, storageProxyDownload } from './storage.js';

export async function handleAPI(request, env, url) {
  const ep = url.pathname.slice('/api/'.length);
  try {
    switch (ep) {
      case 'upload':   return await apiUpload(request, env, url);
      case 'list':     return await apiList(env, url);
      case 'download': return await apiDownload(env, url);
      case 'delete':   return await apiDelete(env, url);
      case 'mkdir':    return await apiMkdir(request, env);
      case 'rename':   return await apiRename(request, env);
      default:         return json({ error: 'Not Found' }, 404);
    }
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function apiUpload(request, env, url) {
  const dir  = url.searchParams.get('path') || '/';
  const form = await request.formData();
  const file = form.get('file');
  if (!file) return json({ error: 'No file field' }, 400);

  const buffer   = await file.arrayBuffer();
  const filename = file.name || 'upload';
  const mime     = file.type || 'application/octet-stream';
  const filePath = dir === '/' ? `/${filename}` : `${dir}/${filename}`;
  const result   = await storageUpload(env, buffer, filename, mime);

  await saveFileMeta(env, filePath, {
    type: 'file', path: filePath, name: filename,
    size: result.size, mime, mtime: Date.now(),
    etag: result.fileId, ...result,
  });
  return json({ ok: true, path: filePath, size: result.size });
}

async function apiList(env, url) {
  const items = await listDir(env, url.searchParams.get('path') || '/');
  return json({ ok: true, items });
}

async function apiDownload(env, url) {
  const path = url.searchParams.get('path');
  if (!path) return json({ error: 'path required' }, 400);
  const meta = await getFileMeta(env, path);
  if (!meta)              return new Response('Not Found', { status: 404 });
  if (meta.type === 'dir') return json({ error: 'Is a directory' }, 400);

  const upstream = env.storage === 'webdav'
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

async function apiDelete(env, url) {
  const path = url.searchParams.get('path');
  if (!path) return json({ error: 'path required' }, 400);
  const meta = await getFileMeta(env, path);
  if (meta) await storageDelete(env, meta);
  await deleteFileMeta(env, path);
  return json({ ok: true });
}

async function apiMkdir(request, env) {
  const { path } = await request.json();
  if (!path) return json({ error: 'path required' }, 400);
  if (await getFileMeta(env, path)) return json({ error: 'Already exists' }, 409);
  const name = path.split('/').filter(Boolean).pop() || path;
  await saveFileMeta(env, path, { type: 'dir', path, name, mtime: Date.now(), etag: String(Date.now()) });
  return json({ ok: true, path });
}

async function apiRename(request, env) {
  const { from, to } = await request.json();
  if (!from || !to) return json({ error: 'from/to required' }, 400);
  await moveFileMeta(env, from, to);
  return json({ ok: true });
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
