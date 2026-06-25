import { parseCookies } from './index.js';

const COOKIE = 'vd_session';

export async function handleAuth(request, env, url) {
  const m = request.method.toUpperCase();
  const p = url.pathname;

  if (p === '/auth/login' || p === '/auth') return getLogin(env);
  if (p === '/auth/password'    && m === 'POST') return postPassword(request, env);
  if (p === '/auth/request-otp' && m === 'POST') return requestOTP(env);
  if (p === '/auth/verify-otp'  && m === 'POST') return verifyOTP(request, env);
  if (p === '/auth/logout')                       return doLogout(request, env);

  return Response.redirect(new URL('/auth/login', url).href, 302);
}

function getLogin(env) {
  return html(loginHTML(!!env.login_pass, !!(env.telegram_bot_token && env.telegram_chat_id)));
}

async function postPassword(request, env) {
  if (!env.login_pass) return err('密码登录未启用');
  const { password } = await request.json().catch(() => ({}));
  if (password !== env.login_pass) return err('密码错误');
  return issueSession(env);
}

async function requestOTP(env) {
  if (!env.telegram_bot_token || !env.telegram_chat_id) return err('验证码登录未启用');
  const token = genToken(32);
  const code  = String(Math.floor(100000 + Math.random() * 900000));
  await env.KV.put(`otp:${token}`, code, { expirationTtl: 300 });
  await fetch(`https://api.telegram.org/bot${env.telegram_bot_token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.telegram_chat_id, text: `🔐 VaultDrive 验证码：${code}\n\n5 分钟内有效` })
  });
  return ok({ token });
}

async function verifyOTP(request, env) {
  const { token, code } = await request.json().catch(() => ({}));
  if (!token || !code) return err('参数缺失');
  const stored = await env.KV.get(`otp:${token}`);
  if (!stored)                return err('验证码已过期');
  if (stored !== code.trim()) return err('验证码错误');
  await env.KV.delete(`otp:${token}`);
  return issueSession(env);
}

async function doLogout(request, env) {
  const token = parseCookies(request.headers.get('Cookie') || '')[COOKIE];
  if (token) await env.KV.delete(`session:${token}`);
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/auth/login',
      'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
    }
  });
}

async function issueSession(env) {
  const token = genToken(48);
  const ttl   = Number(env.session_ttl) || 86400;
  await env.KV.put(`session:${token}`, JSON.stringify({ exp: Date.now() + ttl * 1000 }), { expirationTtl: ttl });
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `${COOKIE}=${token}; Path=/; Max-Age=${ttl}; HttpOnly; SameSite=Lax`
    }
  });
}

function genToken(len) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}
const html = body => new Response(body, { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
const ok   = (d = {}) => new Response(JSON.stringify({ ok: true, ...d }), { headers: { 'Content-Type': 'application/json' } });
const err  = (msg, s = 401) => new Response(JSON.stringify({ ok: false, error: msg }), { status: s, headers: { 'Content-Type': 'application/json' } });

// ── 登录页 HTML ───────────────────────────────────────────────
function loginHTML(hasPass, hasOTP) {
  if (!hasPass && !hasOTP) return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem">
    <b>VaultDrive</b><p style="margin-top:1rem;color:#666">请配置 <code>login_pass</code> 或 Telegram Bot 变量以启用登录。</p></body></html>`;

  const both = hasPass && hasOTP;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>VaultDrive</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;border-radius:0}
:root{--bg:#fff;--sf:#f5f5f5;--bdm:#d4d4d4;--bdh:#a3a3a3;--t:#0a0a0a;--t2:#525252;--t3:#a3a3a3;--red:#dc2626;
  --m:16px;--l:24px;--f:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;--mono:'SF Mono','Consolas','Menlo',monospace;}
html,body{background:var(--bg);color:var(--t);font-family:var(--f);font-size:13px;line-height:1.5;min-height:100vh;-webkit-font-smoothing:antialiased;}
.wrap{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:var(--l);}
.box{width:min(360px,100%);}
.logo{font-family:var(--mono);font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--t);margin-bottom:40px;}
.title{font-size:18px;font-weight:600;letter-spacing:-.02em;margin-bottom:4px;}
.sub{font-size:12px;color:var(--t2);margin-bottom:var(--l);}
.tabs{display:flex;border:1px solid var(--bdm);margin-bottom:var(--l);}
.tab{flex:1;padding:8px;font-size:12px;font-weight:500;cursor:pointer;background:transparent;border:none;color:var(--t2);font-family:var(--f);transition:background .1s,color .1s;-webkit-tap-highlight-color:transparent;}
.tab:first-child{border-right:1px solid var(--bdm);}
.tab.active{background:var(--sf);color:var(--t);}
label{display:block;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--t3);margin-bottom:6px;}
input{width:100%;background:transparent;border:1px solid var(--bdm);color:var(--t);font-family:var(--f);font-size:14px;padding:0 var(--m);height:44px;outline:none;transition:border-color .1s;-webkit-appearance:none;}
input:focus{border-color:var(--bdh);}
input::placeholder{color:var(--t3);}
input.otp{font-family:var(--mono);font-size:24px;letter-spacing:.35em;text-align:center;height:56px;}
.field{margin-bottom:var(--m);}
.btn{width:100%;background:var(--t);color:var(--bg);border:1px solid var(--t);font-size:13px;font-weight:600;height:44px;cursor:pointer;font-family:var(--f);transition:background .1s;-webkit-tap-highlight-color:transparent;margin-bottom:8px;}
.btn:hover{background:#262626;}
.btn:disabled{background:var(--bdm);border-color:var(--bdm);cursor:default;}
.btn-ghost{background:transparent;color:var(--t2);border:1px solid var(--bdm);}
.btn-ghost:hover{border-color:var(--bdh);color:var(--t);}
.btn-ghost:disabled{color:var(--t3);border-color:#e5e5e5;cursor:default;}
.err{font-size:12px;color:var(--red);padding:8px var(--m);border:1px solid rgba(220,38,38,.2);background:#fef2f2;margin-bottom:var(--m);display:none;}
.err.show{display:block;}
.otp-meta{display:flex;justify-content:flex-end;margin-top:4px;}
.resend{font-size:11px;color:var(--t3);background:none;border:none;cursor:pointer;font-family:var(--f);padding:0;}
.resend:not(:disabled):hover{color:var(--t2);}
.hint{font-size:11px;color:var(--t3);text-align:center;margin-top:8px;}
.sec{display:none;}.sec.on{display:block;}
</style>
</head>
<body>
<div class="wrap"><div class="box">
  <div class="logo">VaultDrive</div>
  <div class="title">登录</div>
  <div class="sub" id="sub">${both ? '选择登录方式' : hasPass ? '输入密码继续' : '通过 Telegram 验证码登录'}</div>
  ${both ? `<div class="tabs">
    <button class="tab active" onclick="sw('pass')">密码</button>
    <button class="tab" onclick="sw('otp')">验证码</button>
  </div>` : ''}
  <div class="err" id="err"></div>
  ${hasPass ? `<div class="sec on" id="sec-pass">
    <div class="field"><label>密码</label><input type="password" id="pw" placeholder="••••••••" autocomplete="current-password"></div>
    <button class="btn" onclick="doPass()">登录</button>
  </div>` : ''}
  ${hasOTP ? `<div class="sec ${!hasPass ? 'on' : ''}" id="sec-otp">
    <div id="otp-s1"><button class="btn btn-ghost" id="send-btn" onclick="sendOTP()">发送验证码到 Telegram</button></div>
    <div id="otp-s2" style="display:none">
      <div class="field"><label>验证码</label><input type="text" class="otp" id="otp" placeholder="000000" maxlength="6" inputmode="numeric" autocomplete="one-time-code"></div>
      <button class="btn" onclick="doOTP()">验证</button>
      <div class="otp-meta"><button class="resend" id="resend" disabled onclick="sendOTP()">重新发送 <span id="cd"></span></button></div>
    </div>
    <div class="hint">验证码发至您的 Telegram，5 分钟内有效</div>
  </div>` : ''}
</div></div>
<script>
let ot='',ct;
${both ? `function sw(t){document.querySelectorAll('.tab').forEach((b,i)=>b.classList.toggle('active',(i===0)===(t==='pass')));document.getElementById('sec-pass').classList.toggle('on',t==='pass');document.getElementById('sec-otp').classList.toggle('on',t==='otp');document.getElementById('sub').textContent=t==='pass'?'输入密码继续':'通过 Telegram 验证码登录';ce();}` : ''}
function se(m){const e=document.getElementById('err');e.textContent=m;e.classList.add('show');}
function ce(){document.getElementById('err').classList.remove('show');}
${hasPass ? `async function doPass(){ce();const pw=document.getElementById('pw').value;if(!pw)return;const r=await fetch('/auth/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});const d=await r.json();if(d.ok)location.href='/';else se(d.error||'登录失败');}
document.getElementById('pw')?.addEventListener('keydown',e=>{if(e.key==='Enter')doPass();});` : ''}
${hasOTP ? `async function sendOTP(){ce();const b=document.getElementById('send-btn');if(b){b.disabled=true;b.textContent='发送中…';}const r=await fetch('/auth/request-otp',{method:'POST'});const d=await r.json();if(!d.ok){if(b){b.disabled=false;b.textContent='发送验证码到 Telegram';}se(d.error||'发送失败');return;}ot=d.token;document.getElementById('otp-s1').style.display='none';document.getElementById('otp-s2').style.display='block';document.getElementById('otp').focus();scd();}
function scd(){clearInterval(ct);let t=60;const cd=document.getElementById('cd'),rb=document.getElementById('resend');rb.disabled=true;cd.textContent='(60)';ct=setInterval(()=>{t--;if(t<=0){clearInterval(ct);cd.textContent='';rb.disabled=false;}else cd.textContent='('+t+')';},1000);}
async function doOTP(){ce();const c=document.getElementById('otp').value.trim();if(c.length!==6)return;const r=await fetch('/auth/verify-otp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:ot,code:c})});const d=await r.json();if(d.ok)location.href='/';else se(d.error||'验证失败');}
document.getElementById('otp')?.addEventListener('keydown',e=>{if(e.key==='Enter')doOTP();});` : ''}
</script>
</body></html>`;
}
