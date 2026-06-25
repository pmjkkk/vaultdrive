// ============================================================
//  VaultDrive: Cloudflare Worker 入口
//
//  存储后端：  env.STORAGE = 'telegram'（默认）| 's3'
//  认证方式：  Session Cookie
//    - 密码登录：配置 LOGIN_PASS
//    - 验证码：  配置 TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
//    - 两者可同时开启；AUTH_DISABLED=true 跳过所有认证
//  WebDAV：    Basic Auth，独立使用 WEBDAV_USER / WEBDAV_PASS
// ============================================================

import { handleWebDAV } from './webdav.js';
import { handleUI }     from './ui.js';
import { handleAPI }    from './api.js';
import { handleAuth }   from './auth.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ── 0. 完全关闭认证 ───────────────────────────────────
    if (env.AUTH_DISABLED === 'true') {
      return route(request, env, url);
    }

    // ── 1. WebDAV：Basic Auth（独立密码） ─────────────────
    if (url.pathname.startsWith('/dav')) {
      if (!checkBasicAuth(request, env)) return new Response('Unauthorized', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="VaultDrive"' }
      });
      return handleWebDAV(request, env, url);
    }

    // ── 2. 认证路由 ───────────────────────────────────────
    if (url.pathname.startsWith('/auth')) {
      return handleAuth(request, env, url);
    }

    // ── 3. 其他路由：校验 Session Cookie ─────────────────
    if (!await checkSession(request, env)) {
      return Response.redirect(new URL('/auth/login', url).toString(), 302);
    }

    return route(request, env, url);
  }
};

async function route(request, env, url) {
  if (url.pathname.startsWith('/api/')) return handleAPI(request, env, url);
  return handleUI(request, env, url);
}

// WebDAV 专用 Basic Auth（使用 WEBDAV_USER / WEBDAV_PASS）
function checkBasicAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const [scheme, encoded] = auth.split(' ');
  if (scheme !== 'Basic' || !encoded) return false;
  try {
    const [user, pass] = atob(encoded).split(':');
    return user === (env.WEBDAV_USER || 'admin') && pass === env.WEBDAV_PASS;
  } catch { return false; }
}

// Web UI Session Cookie 校验（与 WebDAV 密码完全独立）
export async function checkSession(request, env) {
  const token = parseCookies(request.headers.get('Cookie') || '')['tgd_session'];
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
    str.split(';').map(s => s.trim().split('=').map(decodeURIComponent)).filter(([k]) => k)
  );
}
