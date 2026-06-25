// ============================================================
//  KV 元数据存储层
//  key 规则：
//    meta:<path>        → 单条文件/目录元数据 (JSON)
//    dir:<parentPath>   → 子条目名称集合 (JSON string[])
// ============================================================

export async function getFileMeta(env, path) {
  const raw = await env.KV.get(`meta:${path}`);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function saveFileMeta(env, path, meta) {
  await env.KV.put(`meta:${path}`, JSON.stringify(meta));

  // 更新父目录的子条目索引
  const parent = parentPath(path);
  if (parent !== path) {
    const name = path.split('/').filter(Boolean).pop();
    await addToDir(env, parent, name);

    // 确保父目录节点存在
    const parentMeta = await getFileMeta(env, parent);
    if (!parentMeta) {
      const pname = parent.split('/').filter(Boolean).pop() || '';
      await env.KV.put(`meta:${parent}`, JSON.stringify({
        type: 'dir', path: parent, name: pname, mtime: Date.now(), etag: '0'
      }));
    }
  }
}

export async function deleteFileMeta(env, path) {
  const meta = await getFileMeta(env, path);
  if (!meta) return;

  // 若是目录，递归删子条目
  if (meta.type === 'dir') {
    const children = await listDir(env, path);
    for (const c of children) await deleteFileMeta(env, c.path);
    await env.KV.delete(`dir:${path}`);
  }

  await env.KV.delete(`meta:${path}`);

  // 从父目录索引移除
  const parent = parentPath(path);
  if (parent !== path) {
    const name = path.split('/').filter(Boolean).pop();
    await removeFromDir(env, parent, name);
  }
}

export async function moveFileMeta(env, oldPath, newPath) {
  const meta = await getFileMeta(env, oldPath);
  if (!meta) return;

  const newName = newPath.split('/').filter(Boolean).pop();
  const newMeta = { ...meta, path: newPath, name: newName };
  await saveFileMeta(env, newPath, newMeta);
  await deleteFileMeta(env, oldPath);
}

export async function listDir(env, path) {
  const normPath = path === '' ? '/' : path;
  const raw = await env.KV.get(`dir:${normPath}`);
  if (!raw) return [];
  let names;
  try { names = JSON.parse(raw); } catch { return []; }

  const items = [];
  for (const name of names) {
    const childPath = normPath === '/' ? `/${name}` : `${normPath}/${name}`;
    const m = await getFileMeta(env, childPath);
    if (m) items.push(m);
  }
  return items;
}

// ---------- private helpers ----------
function parentPath(p) {
  const parts = p.split('/').filter(Boolean);
  if (parts.length <= 1) return '/';
  return '/' + parts.slice(0, -1).join('/');
}

async function addToDir(env, dirPath, name) {
  const raw = await env.KV.get(`dir:${dirPath}`);
  let names = [];
  try { names = JSON.parse(raw || '[]'); } catch {}
  if (!names.includes(name)) {
    names.push(name);
    await env.KV.put(`dir:${dirPath}`, JSON.stringify(names));
  }
}

async function removeFromDir(env, dirPath, name) {
  const raw = await env.KV.get(`dir:${dirPath}`);
  let names = [];
  try { names = JSON.parse(raw || '[]'); } catch {}
  names = names.filter(n => n !== name);
  await env.KV.put(`dir:${dirPath}`, JSON.stringify(names));
}
