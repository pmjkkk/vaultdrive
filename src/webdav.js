// ============================================================
//  webdav.js — WebDAV 协议实现
//  文件存储接入统一 storage.js 抽象
// ============================================================

import { listDir, getFileMeta, saveFileMeta, deleteFileMeta, moveFileMeta }
  from './store.js';
import { storageUpload, storageDownloadURL, storageDelete, storageProxyDownload } from './storage.js';

const DAV_MOUNT = '/dav';

export async function handleWebDAV(request, env, url) {
  const method  = request.method.toUpperCase();
  const rawPath = decodeURIComponent(url.pathname);
  const path    = rawPath.slice(DAV_MOUNT.length) || '/';

  switch (method) {
    case 'OPTIONS':  return davOptions();
    case 'HEAD':     return davHead(path, env);
    case 'GET':      return davGet(path, env, url);
    case 'PUT':      return davPut(path, request, env);
    case 'DELETE':   return davDelete(path, env);
    case 'MKCOL':    return davMkcol(path, env);
    case 'PROPFIND': return davPropfind(path, request, env, url);
    case 'MOVE':     return davMove(path, request, env, url);
    case 'COPY':     return davCopy(path, request, env, url);
    case 'LOCK':     return davLock(path);
    case 'UNLOCK':   return new Response(null, { status: 204 });
    default:         return new Response('Method Not Allowed', { status: 405 });
  }
}

function davOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      Allow: 'OPTIONS, HEAD, GET, PUT, DELETE, MKCOL, PROPFIND, MOVE, COPY, LOCK, UNLOCK',
      DAV: '1, 2', 'MS-Author-Via': 'DAV',
    }
  });
}

async function davHead(path, env) {
  const meta = await getFileMeta(env, path);
  if (!meta) return new Response(null, { status: 404 });
  return new Response(null, {
    status: 200,
    headers: {
      'Content-Type':   meta.mime || 'application/octet-stream',
      'Content-Length': String(meta.size || 0),
      'Last-Modified':  new Date(meta.mtime).toUTCString(),
      ETag:             `"${meta.etag}"`,
    }
  });
}

async function davGet(path, env, url) {
  const meta = await getFileMeta(env, path);
  if (!meta) return new Response('Not Found', { status: 404 });

  if (meta.type === 'dir') {
    const items = await listDir(env, path);
    const rows  = items.map(i =>
      `<li><a href="${DAV_MOUNT}${i.path}">${i.name}${i.type === 'dir' ? '/' : ''}</a></li>`
    ).join('');
    return new Response(`<ul>${rows}</ul>`, { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
  }

  const upstream = env.storage === 'webdav'
    ? await storageProxyDownload(env, meta)
    : await fetch(await storageDownloadURL(env, meta));
  return new Response(upstream.body, {
    headers: {
      'Content-Type':        meta.mime || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(meta.name)}"`,
      'Content-Length':      String(meta.size || 0),
    }
  });
}

async function davPut(path, request, env) {
  const body = await request.arrayBuffer();
  const mime = request.headers.get('Content-Type') || 'application/octet-stream';
  const name = path.split('/').filter(Boolean).pop() || 'file';

  const { fileId, s3Key, size } = await storageUpload(env, body, name, mime);

  const meta = {
    type: 'file', path, name,
    size: size || body.byteLength, mime, fileId, s3Key,
    mtime: Date.now(), etag: fileId,
    storage: env.storage || 'telegram',
  };
  await saveFileMeta(env, path, meta);
  return new Response(null, { status: 201 });
}

async function davDelete(path, env) {
  const meta = await getFileMeta(env, path);
  if (!meta) return new Response('Not Found', { status: 404 });
  if (meta.type === 'dir') {
    const children = await listDir(env, path);
    for (const c of children) {
      const cm = await getFileMeta(env, c.path);
      if (cm) await storageDelete(env, cm);
    }
  } else {
    await storageDelete(env, meta);
  }
  await deleteFileMeta(env, path);
  return new Response(null, { status: 204 });
}

async function davMkcol(path, env) {
  if (await getFileMeta(env, path)) return new Response('Method Not Allowed', { status: 405 });
  const name = path.split('/').filter(Boolean).pop() || '/';
  await saveFileMeta(env, path, { type: 'dir', path, name, mtime: Date.now(), etag: String(Date.now()) });
  return new Response(null, { status: 201 });
}

async function davPropfind(path, request, env, baseUrl) {
  const depth    = request.headers.get('Depth') || '1';
  const selfMeta = await getFileMeta(env, path);
  const self     = selfMeta || { type: 'dir', path, name: '', mtime: Date.now(), etag: '0' };
  let items      = [self];
  if (depth !== '0' && self.type === 'dir') items = items.concat(await listDir(env, path));

  const origin  = baseUrl.origin;
  const xml     = `<?xml version="1.0" encoding="utf-8"?>\n<D:multistatus xmlns:D="DAV:">\n${items.map(m => propNode(m, origin)).join('')}\n</D:multistatus>`;
  return new Response(xml, { status: 207, headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}

function propNode(meta, origin) {
  const href  = `${origin}${DAV_MOUNT}${meta.path}`;
  const mtime = new Date(meta.mtime || Date.now()).toUTCString();
  const isDir = meta.type === 'dir';
  return `<D:response>
  <D:href>${escXml(href)}${isDir && !href.endsWith('/') ? '/' : ''}</D:href>
  <D:propstat><D:prop>
    <D:displayname>${escXml(meta.name || '')}</D:displayname>
    <D:getlastmodified>${mtime}</D:getlastmodified>
    <D:getetag>"${meta.etag || '0'}"</D:getetag>
    ${isDir
      ? '<D:resourcetype><D:collection/></D:resourcetype>'
      : `<D:resourcetype/><D:getcontenttype>${meta.mime || 'application/octet-stream'}</D:getcontenttype><D:getcontentlength>${meta.size || 0}</D:getcontentlength>`
    }
  </D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat>
</D:response>`;
}

async function davMove(path, request, env, baseUrl) {
  const dest = destPath(request, baseUrl);
  if (!dest) return new Response('Bad Request', { status: 400 });
  await moveFileMeta(env, path, dest);
  return new Response(null, { status: 201 });
}

async function davCopy(path, request, env, baseUrl) {
  const dest = destPath(request, baseUrl);
  if (!dest) return new Response('Bad Request', { status: 400 });
  const meta = await getFileMeta(env, path);
  if (!meta) return new Response('Not Found', { status: 404 });
  const newMeta = { ...meta, path: dest, name: dest.split('/').filter(Boolean).pop() };
  await saveFileMeta(env, dest, newMeta);
  return new Response(null, { status: 201 });
}

async function davLock(path) {
  const token = `urn:uuid:${crypto.randomUUID()}`;
  const xml   = `<?xml version="1.0" encoding="utf-8"?>
<D:prop xmlns:D="DAV:"><D:lockdiscovery><D:activelock>
  <D:locktype><D:write/></D:locktype><D:lockscope><D:exclusive/></D:lockscope>
  <D:depth>0</D:depth><D:timeout>Second-3600</D:timeout>
  <D:locktoken><D:href>${token}</D:href></D:locktoken>
  <D:lockroot><D:href>${path}</D:href></D:lockroot>
</D:activelock></D:lockdiscovery></D:prop>`;
  return new Response(xml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Lock-Token': `<${token}>` }
  });
}

function destPath(request, baseUrl) {
  const dest = request.headers.get('Destination');
  if (!dest) return null;
  try {
    const raw = decodeURIComponent(new URL(dest).pathname);
    return raw.startsWith(DAV_MOUNT) ? raw.slice(DAV_MOUNT.length) || '/' : raw;
  } catch { return null; }
}

function escXml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
