import { handleWebDAV } from './webdav.js';
import { handleUI }     from './ui.js';
import { handleAPI }    from './api.js';
import { handleAuth }   from './auth.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (env.auth_disabled === 'true')      return route(request, env, url);
    if (pathname.startsWith('/dav'))       return davRoute(request, env, url);
    if (pathname.startsWith('/auth'))      return handleAuth(request, env, url);
    if (!await checkSession(request, env)) return Response.redirect(new URL('/auth/login', url).href, 302);

    return route(request, env, url);
  }
};

function route(request, env, url) {
  return url.pathname.startsWith('/api/')
    ? handleAPI(request, env, url)
    : handleUI(request, env, url);
}

function davRoute(request, env, url) {
  const auth    = request.headers.get('Authorization') || '';
  const encoded = auth.startsWith('Basic ') ? auth.slice(6) : null;
  if (!encoded) return unauth();
  try {
    const [user, pass] = atob(encoded).split(':');
    if (user !== (env.webdav_user || 'admin') || pass !== env.webdav_pass) return unauth();
  } catch { return unauth(); }
  return handleWebDAV(request, env, url);
}

function unauth() {
  return new Response('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="VaultDrive"' }
  });
}

export async function checkSession(request, env) {
  const token = parseCookies(request.headers.get('Cookie') || '')['vd_session'];
  if (!token) return false;
  const raw = await env.KV.get(`session:${token}`);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (data.exp < Date.now()) { await env.KV.delete(`session:${token}`); return false; }
    return data;
  } catch { return false; }
}

export function parseCookies(str) {
  return Object.fromEntries(
    str.split(';')
       .map(s => s.trim().split('=').map(decodeURIComponent))
       .filter(([k]) => k)
  );
}
