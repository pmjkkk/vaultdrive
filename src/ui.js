// ============================================================
//  Web UI 处理器 — 极简主义重设计
//  Linear / Vercel / Radix 风格：黑白极简、无圆角、字体驱动
// ============================================================

export async function handleUI(request, env, url) {
  const showLogout = env.auth_disabled !== 'true';
  return new Response(buildHTML(showLogout), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

function buildHTML(showLogout = true) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>VaultDrive</title>
<style>
/* ── Reset & Tokens ─────────────────────────────────────── */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border-radius: 0;
}

:root {
  --bg:          #ffffff;
  --surface:     #f5f5f5;
  --surface-2:   #ebebeb;
  --border:      #e5e5e5;
  --border-mid:  #d4d4d4;
  --border-hi:   #a3a3a3;

  --text:   #0a0a0a;
  --text-2: #525252;
  --text-3: #a3a3a3;

  --green:  #16a34a;
  --yellow: #b45309;
  --red:    #dc2626;

  /* 4px grid */
  --s:  8px;
  --m:  16px;
  --l:  24px;
  --xl: 32px;

  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --mono: 'SF Mono', 'Consolas', 'Fira Code', 'Menlo', monospace;
}

html, body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 13px;
  line-height: 1.5;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body { display: flex; flex-direction: column; }

/* ── Header ─────────────────────────────────────────────── */
header {
  position: sticky;
  top: 0;
  z-index: 100;
  height: 44px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  display: flex;
  align-items: center;
  gap: var(--m);
  padding: 0 var(--l);
  flex-shrink: 0;
}

.logo {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text);
  white-space: nowrap;
}
.logout-btn {
  flex-shrink: 0; color: var(--text-3); text-decoration: none;
  padding: 4px 6px; border: 1px solid transparent;
  transition: color .1s, border-color .1s; line-height: 1;
  display: flex; align-items: center; justify-content: center;
}
.logout-btn svg { width: 15px; height: 15px; display: block; }
.logout-btn:hover { color: var(--text-2); border-color: var(--border-mid); }
.h-sep {
  width: 1px;
  height: 14px;
  background: var(--border-mid);
  flex-shrink: 0;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
  overflow: hidden;
  font-size: 12px;
  min-width: 0;
}

.breadcrumb a {
  color: var(--text-2);
  text-decoration: none;
  cursor: pointer;
  padding: 2px 4px;
  white-space: nowrap;
  flex-shrink: 0;
}
.breadcrumb a:last-child { color: var(--text); }
.breadcrumb a:hover { color: var(--text); }

.bc-sep {
  color: var(--text-3);
  font-size: 10px;
  flex-shrink: 0;
  line-height: 1;
  padding: 0 1px;
  user-select: none;
}

/* ── Toolbar ─────────────────────────────────────────────── */
.toolbar {
  display: flex;
  align-items: center;
  gap: var(--s);
  padding: var(--s) var(--l);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  height: 48px;
}

/* ── Buttons ─────────────────────────────────────────────── */
button {
  cursor: pointer;
  border: none;
  font-family: var(--font);
  font-size: 12px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  line-height: 1;
  white-space: nowrap;
  height: 32px;
  transition: background 0.1s, border-color 0.1s, color 0.1s;
  letter-spacing: 0.01em;
  flex-shrink: 0;
}

.btn-primary {
  background: var(--text);
  color: var(--bg);
  border: 1px solid var(--text);
}
.btn-primary:hover { background: #262626; border-color: #262626; }
.btn-primary:active { background: #aaa; }

.btn-ghost {
  background: transparent;
  color: var(--text-2);
  border: 1px solid var(--border-mid);
}
.btn-ghost:hover {
  color: var(--text);
  border-color: var(--border-hi);
  box-shadow: 0 1px 4px rgba(0,0,0,.5);
}

.btn-icon {
  background: transparent;
  color: var(--text-3);
  border: 1px solid transparent;
  padding: 0 8px;
}
.btn-icon:hover { color: var(--text-2); border-color: var(--border-mid); }

.t-sep { width: 1px; height: 20px; background: var(--border-mid); margin: 0 2px; flex-shrink:0; }
.spacer { flex: 1; }

.search-box {
  background: transparent;
  border: 1px solid var(--border-mid);
  color: var(--text);
  font-family: var(--font);
  font-size: 12px;
  padding: 0 var(--s);
  height: 32px;
  width: 192px;
  outline: none;
  transition: border-color 0.1s;
}
.search-box:focus { border-color: var(--border-hi); }
.search-box::placeholder { color: var(--text-3); }

/* View toggle */
.view-toggle {
  display: flex;
  border: 1px solid var(--border-mid);
  flex-shrink: 0;
}
.view-toggle button {
  border: none;
  background: transparent;
  color: var(--text-3);
  padding: 0 10px;
  height: 30px;
  font-size: 12px;
  letter-spacing: 0;
}
.view-toggle button:not(:last-child) { border-right: 1px solid var(--border-mid); }
.view-toggle button.active { background: var(--surface-2); color: var(--text); }
.view-toggle button:hover:not(.active) { color: var(--text-2); }

/* ── Drop Zone ───────────────────────────────────────────── */
#drop-zone {
  display: none;
  margin: var(--m) var(--l) 0;
  border: 1px dashed var(--border-mid);
  padding: var(--xl) var(--l);
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
#drop-zone.active {
  border-color: var(--border-hi);
  background: var(--surface);
}
#drop-zone .dz-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
  letter-spacing: 0.02em;
}
#drop-zone .dz-hint {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-3);
  margin-top: 4px;
}

/* ── Main ────────────────────────────────────────────────── */
main { flex: 1; padding: var(--m) var(--l); }

/* ── List column header ──────────────────────────────────── */
#list-col-header {
  display: none;
  padding: 6px var(--m);
  border: 1px solid var(--border);
  border-bottom: 1px solid var(--border-mid);
  background: var(--surface);
  align-items: center;
  gap: var(--m);
}
#list-col-header.visible { display: flex; }

.col-label {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
}
.col-name  { flex: 1; }
.col-size  { width: 72px; text-align: right; }
.col-date  { width: 88px; text-align: right; }
.col-act   { width: 32px; }

/* ── File Grid ───────────────────────────────────────────── */
#file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 0;
  background: transparent;
  border: 1px solid var(--border);
}
#file-grid .file-card {
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}
#file-grid.list-view {
  display: flex;
  flex-direction: column;
  gap: 0;
  background: transparent;
  border: 1px solid var(--border);
  border-top: none;
}
#file-grid.list-view .file-card {
  border-right: none;
  border-bottom: 1px solid var(--border);
}
#file-grid.list-view .file-card:last-child { border-bottom: none; }

/* ── File Card (grid mode) ───────────────────────────────── */
.file-card {
  background: var(--bg);
  padding: var(--m);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: var(--s);
  position: relative;
  user-select: none;
  transition: background 0.08s;
  min-height: 128px;
  overflow: hidden;
}
.file-card:hover { background: var(--surface); }
.file-card.selected { background: var(--surface-2); }

.file-icon {
  width: 32px; height: 32px; flex-shrink: 0;
  color: var(--text-2); display: flex; align-items: center; justify-content: center;
}
.file-icon svg { width: 100%; height: 100%; display: block; }
/* 网格视图：隐藏缩略图，仅显示图标 */
.file-thumb { display: none; }
.file-icon-fallback { display: none; }
/* 列表视图：显示缩略图，隐藏 fallback 图标 */
.list-view .file-thumb { display: block; width: 16px; height: 16px; border: none; object-fit: cover; }
.list-view .file-icon-fallback { display: none !important; }
.file-thumb-ph {
  width: 100%; height: 80px; background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center; color: var(--text-3);
}
.file-thumb-ph .file-icon { width: 24px; height: 24px; }

.file-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}
.file-size {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-3);
}
.file-date {
  display: none;
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-3);
}

/* Checkbox */
.file-check {
  position: absolute;
  top: var(--s);
  left: var(--s);
  width: 14px;
  height: 14px;
  border: 1px solid var(--border-hi);
  background: var(--bg);
  display: none;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
  color: var(--bg);
}
.file-card.selected .file-check {
  display: flex;
  background: var(--text);
  border-color: var(--text);
  color: var(--bg);
}

/* Context button */
.file-ctx {
  position: absolute;
  top: 6px;
  right: 6px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-3);
  font-size: 12px;
  padding: 1px 6px;
  cursor: pointer;
  line-height: 1;
  height: auto;
  opacity: 0;
  transition: opacity 0.1s, border-color 0.1s, color 0.1s;
  letter-spacing: 2px;
}
.file-card:hover .file-ctx { opacity: 1; }
.file-ctx:hover {
  border-color: var(--border-mid);
  color: var(--text);
  background: var(--surface-2);
}

/* ── List view overrides ─────────────────────────────────── */
.list-view .file-card {
  flex-direction: row;
  align-items: center;
  min-height: 0;
  padding: 10px var(--m);
  gap: 10px;
  border-bottom: 1px solid var(--border);
}
.list-view .file-card:last-child { border-bottom: none; }

.list-view .file-icon  { width: 16px; height: 16px; color: var(--text-3); }
.list-view .file-thumb-ph { width: 16px; height: 16px; background: none; border: none; }
.list-view .file-thumb-ph .file-icon { width: 16px; height: 16px; }

.list-view .file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.list-view .file-size {
  width: 72px;
  text-align: right;
  flex-shrink: 0;
}
.list-view .file-date {
  display: block;
  width: 88px;
  text-align: right;
  flex-shrink: 0;
}
.list-view .file-ctx {
  position: static;
  opacity: 0;
  flex-shrink: 0;
  width: 32px;
  text-align: center;
  border-color: transparent;
}
.list-view .file-card:hover .file-ctx { opacity: 1; }

/* ── Upload Progress ─────────────────────────────────────── */
#upload-progress {
  display: none;
  position: fixed;
  bottom: var(--l);
  right: var(--l);
  background: var(--bg);
  border: 1px solid var(--border-mid);
  padding: var(--m);
  width: 272px;
  z-index: 200;
  box-shadow: 0 4px 24px rgba(0,0,0,.7);
}

.up-header {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-2);
  margin-bottom: var(--s);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.progress-item { margin-top: var(--s); }

.progress-label {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-2);
  margin-bottom: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.progress-bar-wrap {
  height: 2px;
  background: var(--surface-2);
}
.progress-bar {
  height: 2px;
  background: var(--text-3);
  transition: width 0.25s linear;
}
.progress-bar.done  { background: var(--green); }
.progress-bar.error { background: var(--red);   }

/* ── Modal ───────────────────────────────────────────────── */
.modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.75);
  z-index: 300;
  align-items: center;
  justify-content: center;
}
.modal-overlay.open { display: flex; }

.modal {
  background: var(--bg);
  border: 1px solid var(--border-mid);
  padding: var(--l);
  width: min(392px, 90vw);
  box-shadow: 0 8px 40px rgba(0,0,0,.6);
}

.modal-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: var(--m);
  color: var(--text);
  letter-spacing: -0.01em;
}

.modal input {
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--border-mid);
  color: var(--text);
  font-family: var(--font);
  font-size: 13px;
  padding: 0 var(--s);
  height: 36px;
  outline: none;
  margin-bottom: var(--m);
  transition: border-color 0.1s;
}
.modal input:focus { border-color: var(--border-hi); }
.modal input::placeholder { color: var(--text-3); }

.modal-actions {
  display: flex;
  gap: var(--s);
  justify-content: flex-end;
}

/* ── Preview ─────────────────────────────────────────────── */
#preview-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.94);
  z-index: 400;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
#preview-overlay.open { display: flex; }

.prev-bar {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 44px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 var(--l);
  gap: var(--m);
}

.prev-name {
  flex: 1;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prev-close {
  cursor: pointer;
  color: var(--text-2);
  font-size: 14px;
  line-height: 1;
  padding: 4px 8px;
  border: 1px solid transparent;
  transition: border-color 0.1s, color 0.1s;
}
.prev-close:hover { color: var(--text); border-color: var(--border-mid); }

#preview-content {
  margin-top: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 90vw;
  max-height: calc(100vh - 80px);
}
#preview-content img,
#preview-content video,
#preview-content audio {
  max-width: 90vw;
  max-height: calc(100vh - 80px);
  display: block;
}

/* ── Context Menu ────────────────────────────────────────── */
#ctx-menu {
  display: none;
  position: fixed;
  z-index: 600;
  background: var(--bg);
  border: 1px solid var(--border-mid);
  min-width: 160px;
  box-shadow: 0 4px 20px rgba(0,0,0,.6);
  padding: 4px 0;
}
#ctx-menu.open { display: block; }

.ctx-item {
  padding: 7px var(--m);
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-2);
  transition: background 0.08s, color 0.08s;
  letter-spacing: 0.01em;
}
.ctx-item:hover { background: var(--surface-2); color: var(--text); }
.ctx-item.danger { color: var(--red); }
.ctx-item.danger:hover { background: var(--surface-2); color: var(--red); }

.ctx-sep { border-top: 1px solid var(--border); margin: 4px 0; }

/* ── Toast ───────────────────────────────────────────────── */
#toast-container {
  position: fixed;
  bottom: var(--l);
  left: 50%;
  transform: translateX(-50%);
  z-index: 500;
  display: flex;
  flex-direction: column;
  gap: var(--s);
  align-items: center;
  pointer-events: none;
}

.toast {
  background: var(--bg);
  border: 1px solid var(--border-mid);
  padding: 7px var(--m);
  font-size: 12px;
  color: var(--text);
  pointer-events: auto;
  box-shadow: 0 4px 20px rgba(0,0,0,.5);
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  animation: toastIn 0.12s ease;
  letter-spacing: 0.01em;
}
.toast::before {
  content: '';
  display: inline-block;
  width: 4px;
  height: 4px;
  background: currentColor;
  flex-shrink: 0;
}
.toast.success { color: var(--green); }
.toast.error   { color: var(--red);   }

@keyframes toastIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Empty State ─────────────────────────────────────────── */
.empty {
  grid-column: 1 / -1;
  padding: 56px var(--l);
  text-align: center;
  border: none;
  background: var(--bg);
}
.empty-title {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 6px;
}
.empty-hint {
  font-size: 12px;
  color: var(--text-3);
}

/* ── Scrollbar ───────────────────────────────────────────── */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--border-mid); }
::-webkit-scrollbar-thumb:hover { background: var(--border-hi); }

/* ── Global icon rules ───────────────────────────────────── */
.icon { width: 13px; height: 13px; display: block; flex-shrink: 0; }
.icon-xs { width: 9px; height: 9px; display: block; }
button .icon { pointer-events: none; }
.ctx-item .icon, .bs-item .icon { width: 12px; height: 12px; opacity: .7; }
.prev-close .icon { width: 14px; height: 14px; }
.btn-icon .icon { width: 14px; height: 14px; }

</style>
</head>
<body>

<!-- Header -->
<header>
  <div class="logo">VaultDrive</div>
  <div class="h-sep"></div>
  <nav class="breadcrumb" id="breadcrumb"></nav>
  <a class="logout-btn" href="/auth/logout" title="Sign out" ${showLogout ? '' : 'style="display:none"'}>
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>
      <path d="M11 11l3-3-3-3"/>
      <line x1="14" y1="8" x2="6" y2="8"/>
    </svg>
  </a>
</header>

<!-- Toolbar -->
<div class="toolbar">
  <button class="btn-primary" onclick="UI.openUpload()"><svg class="icon" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 9V2M3.5 5.5 7 2l3.5 3.5"/><line x1="1" y1="12" x2="13" y2="12"/></svg> Upload</button>
  <button class="btn-ghost"   onclick="UI.showMkdir()"><svg class="icon" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4a1 1 0 0 1 1-1h3l1.5 1.5H12a1 1 0 0 1 1 1V11a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4Z"/><line x1="5.5" y1="8" x2="8.5" y2="8"/><line x1="7" y1="6.5" x2="7" y2="9.5"/></svg> Folder</button>
  <div class="t-sep"></div>
  <button class="btn-ghost" id="btn-drop" onclick="UI.toggleDrop()"><svg class="icon" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2v8M3.5 6.5 7 10l3.5-3.5"/><line x1="1" y1="13" x2="13" y2="13"/></svg> Drop zone</button>
  <div class="spacer"></div>
  <div class="search-wrap">
    <span class="search-icon"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="5.5" cy="5.5" r="3.5"/><line x1="8.5" y1="8.5" x2="12.5" y2="12.5"/></svg></span>
    <input class="search-box" type="text" placeholder="Search…"
           oninput="UI.search(this.value)" autocomplete="off" spellcheck="false">
  </div>
  <button class="btn-icon" id="btn-search-mobile"
          style="display:none" onclick="UI.toggleSearch()" aria-label="Search"><svg class="icon" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="5.5" cy="5.5" r="3.5"/><line x1="8.5" y1="8.5" x2="12.5" y2="12.5"/></svg></button>
  <div class="view-toggle">
    <button id="vt-grid" class="active" onclick="UI.setView('grid')" title="Grid"><svg class="icon" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1" y="1" width="5" height="5"/><rect x="8" y="1" width="5" height="5"/><rect x="1" y="8" width="5" height="5"/><rect x="8" y="8" width="5" height="5"/></svg></button>
    <button id="vt-list"                onclick="UI.setView('list')" title="List"><svg class="icon" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="4.5" y1="3" x2="13" y2="3"/><line x1="4.5" y1="7" x2="13" y2="7"/><line x1="4.5" y1="11" x2="13" y2="11"/><circle cx="1.5" cy="3" r=".8" fill="currentColor" stroke="none"/><circle cx="1.5" cy="7" r=".8" fill="currentColor" stroke="none"/><circle cx="1.5" cy="11" r=".8" fill="currentColor" stroke="none"/></svg></button>
  </div>
</div>

<!-- Mobile search row -->
<div class="search-row" id="search-row">
  <div class="search-row-wrap">
    <span class="search-icon"><svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="5.5" cy="5.5" r="3.5"/><line x1="8.5" y1="8.5" x2="12.5" y2="12.5"/></svg></span>
    <input class="search-box" type="text" id="mobile-search"
           placeholder="Search…" oninput="UI.search(this.value)"
           autocomplete="off" spellcheck="false">
  </div>
</div>

<!-- Drop Zone -->
<div id="drop-zone">
  <div class="dz-title">Drop files here to upload</div>
  <div class="dz-hint">max 50 MB · multiple files supported</div>
</div>

<!-- File area -->
<main>
  <div id="list-col-header">
    <span class="col-label" style="width:24px"></span>
    <span class="col-label col-name">Name</span>
    <span class="col-label col-size">Size</span>
    <span class="col-label col-date">Modified</span>
    <span class="col-label col-act"></span>
  </div>
  <div id="file-grid"></div>
</main>

<!-- Upload Progress -->
<div id="upload-progress">
  <div class="up-header">
    <span>Uploading</span>
    <span id="up-count"></span>
  </div>
  <div id="up-items"></div>
</div>

<!-- Modal: New Folder -->
<div class="modal-overlay" id="modal-mkdir">
  <div class="modal">
    <div class="modal-title">New Folder</div>
    <input type="text" id="mkdir-name" placeholder="Folder name"
           onkeydown="if(event.key==='Enter')UI.doMkdir()">
    <div class="modal-actions">
      <button class="btn-ghost"   onclick="UI.closeModal('modal-mkdir')">Cancel</button>
      <button class="btn-primary" onclick="UI.doMkdir()">Create</button>
    </div>
  </div>
</div>

<!-- Modal: Rename -->
<div class="modal-overlay" id="modal-rename">
  <div class="modal">
    <div class="modal-title">Rename</div>
    <input type="text" id="rename-val" placeholder="New name"
           onkeydown="if(event.key==='Enter')UI.doRename()">
    <div class="modal-actions">
      <button class="btn-ghost"   onclick="UI.closeModal('modal-rename')">Cancel</button>
      <button class="btn-primary" onclick="UI.doRename()">Rename</button>
    </div>
  </div>
</div>

<!-- Preview -->
<div id="preview-overlay">
  <div class="prev-bar">
    <span class="prev-name" id="preview-name"></span>
    <span class="prev-close" onclick="UI.closePreview()"><svg class="icon" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="2" y1="2" x2="12" y2="12"/><line x1="12" y1="2" x2="2" y2="12"/></svg></span>
  </div>
  <div id="preview-content"></div>
</div>

<!-- Context Menu -->
<div id="ctx-menu">
  <div class="ctx-item"        onclick="UI.ctxDownload()"><svg class="icon" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2v9M3.5 7.5 7 11l3.5-3.5"/><line x1="1" y1="13" x2="13" y2="13"/></svg> Download</div>
  <div class="ctx-item"        onclick="UI.ctxRename()"><svg class="icon" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2.5 11 1l2 2-1.5 1.5M9.5 2.5 3 9v2h2l6.5-6.5"/><line x1="1" y1="13" x2="8" y2="13"/></svg> Rename</div>
  <div class="ctx-sep"></div>
  <div class="ctx-item danger" onclick="UI.ctxDelete()"><svg class="icon" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h10M5 4V2h4v2M5.5 4v7M8.5 4v7M3 4l.7 8h6.6L11 4"/></svg> Delete</div>
</div>

<!-- Toast -->
<div id="toast-container"></div>

<!-- Hidden file input -->
<input type="file" id="file-input" multiple style="display:none"
       onchange="UI.uploadFiles(this.files)">

<script>
// ── State ────────────────────────────────────────────────────
const state = {
  path:     '/',
  items:    [],
  filtered: null,
  view:     localStorage.getItem('tgd-view') || 'grid',
  ctxTarget:    null,
  renameTarget: null,
};

// ── API ──────────────────────────────────────────────────────
const api = {
  async list(path) {
    const r = await fetch('/api/list?path=' + encodeURIComponent(path));
    const j = await r.json();
    return j.items || [];
  },
  async mkdir(path) {
    const r = await fetch('/api/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
    return r.json();
  },
  async rename(from, to) {
    const r = await fetch('/api/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to })
    });
    return r.json();
  },
  async del(path) {
    const r = await fetch('/api/delete?path=' + encodeURIComponent(path), { method: 'DELETE' });
    return r.json();
  },
  downloadURL(path) {
    return '/api/download?path=' + encodeURIComponent(path);
  }
};

// ── Uploader ─────────────────────────────────────────────────
const uploader = {
  queue:   [],
  running: false,

  add(files) {
    for (const f of files) this.queue.push({ file: f, id: Math.random().toString(36).slice(2) });
    this.processQueue();
  },

  async processQueue() {
    if (this.running) return;
    this.running = true;
    document.getElementById('upload-progress').style.display = 'block';

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      await this.uploadOne(item);
    }

    this.running = false;
    setTimeout(() => {
      document.getElementById('upload-progress').style.display = 'none';
      document.getElementById('up-items').innerHTML = '';
    }, 1800);
    UI.refresh();
  },

  async uploadOne({ file, id }) {
    const container = document.getElementById('up-items');
    const div = document.createElement('div');
    div.className = 'progress-item';
    div.innerHTML = \`<div class="progress-label">\${file.name}</div>
      <div class="progress-bar-wrap">
        <div class="progress-bar" id="bar-\${id}" style="width:2%"></div>
      </div>\`;
    container.appendChild(div);
    document.getElementById('up-count').textContent = this.queue.length
      ? '(' + (this.queue.length + 1) + ')' : '';

    const bar = document.getElementById('bar-' + id);
    try {
      const form = new FormData();
      form.append('file', file);
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload?path=' + encodeURIComponent(state.path));
        xhr.upload.onprogress = e => {
          if (e.lengthComputable)
            bar.style.width = Math.round(e.loaded / e.total * 100) + '%';
        };
        xhr.onload = () => {
          const resp = JSON.parse(xhr.responseText);
          if (resp.ok) { bar.style.width = '100%'; bar.classList.add('done'); resolve(); }
          else { bar.classList.add('error'); reject(new Error(resp.error)); }
        };
        xhr.onerror = () => { bar.classList.add('error'); reject(new Error('Network error')); };
        xhr.send(form);
      });
    } catch (e) {
      bar.classList.add('error');
      toast(e.message, 'error');
    }
  }
};

// ── UI ───────────────────────────────────────────────────────
const UI = {
  async navigate(path) {
    state.path     = path;
    state.filtered = null;
    this.renderBreadcrumb();
    await this.refresh();
  },

  async refresh() {
    state.items = await api.list(state.path);
    this.renderGrid(state.items);
  },

  renderBreadcrumb() {
    const parts = state.path.split('/').filter(Boolean);
    let html = \`<a onclick="UI.navigate('/')">~</a>\`;
    let built = '';
    for (const p of parts) {
      built += '/' + p;
      const cap = built;
      html += \`<span class="bc-sep">/</span><a onclick="UI.navigate('\${cap}')">\${escHtml(p)}</a>\`;
    }
    document.getElementById('breadcrumb').innerHTML = html;
  },

  renderGrid(items) {
    const grid = document.getElementById('file-grid');
    const isListView = state.view === 'list';
    grid.className = isListView ? 'list-view' : '';

    const header = document.getElementById('list-col-header');
    header.classList.toggle('visible', isListView);

    if (!items || items.length === 0) {
      grid.innerHTML = \`<div class="empty">
        <div class="empty-title">No files</div>
        <div class="empty-hint">Upload a file or create a folder to get started</div>
      </div>\`;
      return;
    }

    const sorted = [...items].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    grid.innerHTML = sorted.map(m => this.cardHTML(m)).join('');
  },

  cardHTML(meta) {
    const isDir   = meta.type === 'dir';
    const size    = isDir ? '' : formatSize(meta.size);
    const date    = meta.mtime ? formatDate(meta.mtime) : '';
    const iconSvg = fileIcon(meta.type, meta.mime, meta.name);
    const isImg   = !isDir && isImage(meta.mime, meta.name);
    // 列表视图时显示缩略图，网格视图统一用图标
    const thumb   = isImg
      ? \`<img class="file-thumb" src="\${api.downloadURL(meta.path)}"
          onerror="this.style.display='none'" loading="lazy" alt="">
         <div class="file-icon file-icon-fallback">\${iconSvg}</div>\`
      : \`<div class="file-icon">\${iconSvg}</div>\`;

    return \`<div class="file-card"
      data-path="\${escAttr(meta.path)}"
      data-type="\${meta.type}"
      ondblclick="UI.onDblClick(this)"
      onclick="UI.onCardClick(event,this)"
      oncontextmenu="UI.onCtxMenu(event,this)">
      <span class="file-check"><svg class="icon-xs" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 5.5 4 8 8.5 2.5"/></svg></span>
      \${thumb}
      <div class="file-name">\${escHtml(meta.name)}</div>
      \${size ? \`<div class="file-size">\${size}</div>\` : '<div class="file-size">—</div>'}
      <div class="file-date">\${date}</div>
      <span class="file-ctx"
        oncontextmenu="event.stopPropagation()"
        onclick="event.stopPropagation();UI.onCtxMenu(event,this.parentElement)"><svg class="icon" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="7" cy="3" r=".8" fill="currentColor" stroke="none"/><circle cx="7" cy="7" r=".8" fill="currentColor" stroke="none"/><circle cx="7" cy="11" r=".8" fill="currentColor" stroke="none"/></svg></span>
    </div>\`;
  },

  onCardClick(e, card) {
    if (e.ctrlKey || e.metaKey) {
      card.classList.toggle('selected');
    } else {
      document.querySelectorAll('.file-card.selected')
        .forEach(c => c !== card && c.classList.remove('selected'));
      card.classList.toggle('selected');
    }
  },

  onDblClick(card) {
    const path = card.dataset.path;
    if (card.dataset.type === 'dir') this.navigate(path);
    else this.preview(path);
  },

  onCtxMenu(e, card) {
    e.preventDefault();
    e.stopPropagation();
    state.ctxTarget = card;
    const menu = document.getElementById('ctx-menu');
    menu.classList.add('open');
    const x = Math.min(e.clientX, window.innerWidth  - 180);
    const y = Math.min(e.clientY, window.innerHeight - 130);
    menu.style.left = x + 'px';
    menu.style.top  = y + 'px';
  },

  ctxDownload() {
    const path = state.ctxTarget?.dataset.path;
    if (!path) return;
    if (state.ctxTarget.dataset.type === 'dir') { toast('Cannot download folders', 'error'); return; }
    const a = document.createElement('a');
    a.href = api.downloadURL(path);
    a.download = '';
    a.click();
    this.closeCtx();
  },

  ctxRename() {
    state.renameTarget = state.ctxTarget;
    const name = state.renameTarget.querySelector('.file-name').textContent.trim();
    document.getElementById('rename-val').value = name;
    this.openModal('modal-rename');
    this.closeCtx();
    setTimeout(() => document.getElementById('rename-val').select(), 80);
  },

  async ctxDelete() {
    const path = state.ctxTarget?.dataset.path;
    if (!path) return;
    if (!confirm('Delete this item? This cannot be undone.')) return;
    await api.del(path);
    toast('Deleted');
    this.closeCtx();
    this.refresh();
  },

  closeCtx() { document.getElementById('ctx-menu').classList.remove('open'); },

  async doRename() {
    const card    = state.renameTarget;
    if (!card) return;
    const oldPath = card.dataset.path;
    const newName = document.getElementById('rename-val').value.trim();
    if (!newName) return;
    const parent  = oldPath.substring(0, oldPath.lastIndexOf('/')) || '/';
    const newPath = parent === '/' ? '/' + newName : parent + '/' + newName;
    const res = await api.rename(oldPath, newPath);
    if (res.ok) { toast('Renamed'); this.refresh(); }
    else toast(res.error, 'error');
    this.closeModal('modal-rename');
  },

  showMkdir() {
    document.getElementById('mkdir-name').value = '';
    this.openModal('modal-mkdir');
    setTimeout(() => document.getElementById('mkdir-name').focus(), 80);
  },

  async doMkdir() {
    const name = document.getElementById('mkdir-name').value.trim();
    if (!name) return;
    const path = state.path === '/' ? '/' + name : state.path + '/' + name;
    const res  = await api.mkdir(path);
    if (res.ok) { toast('Folder created', 'success'); this.refresh(); }
    else toast(res.error, 'error');
    this.closeModal('modal-mkdir');
  },

  openModal(id)  { document.getElementById(id).classList.add('open'); },
  closeModal(id) { document.getElementById(id).classList.remove('open'); },

  openUpload()       { document.getElementById('file-input').click(); },
  uploadFiles(files) { uploader.add(files); },

  toggleDrop() {
    const dz = document.getElementById('drop-zone');
    dz.style.display = dz.style.display === 'block' ? 'none' : 'block';
  },

  setView(v) {
    state.view = v;
    localStorage.setItem('tgd-view', v);
    document.getElementById('vt-grid').classList.toggle('active', v === 'grid');
    document.getElementById('vt-list').classList.toggle('active', v === 'list');
    this.renderGrid(state.filtered || state.items);
  },

  search(q) {
    if (!q) { state.filtered = null; this.renderGrid(state.items); return; }
    const lower = q.toLowerCase();
    state.filtered = state.items.filter(m => m.name.toLowerCase().includes(lower));
    this.renderGrid(state.filtered);
  },

  toggleSearch() {
    const row = document.getElementById('search-row');
    const btn = document.getElementById('btn-search-mobile');
    const open = row.classList.toggle('open');
    if (btn) { btn.style.borderColor = open ? 'var(--border-hi)' : 'transparent'; btn.style.color = open ? 'var(--text)' : ''; }
    if (open) setTimeout(() => document.getElementById('mobile-search').focus(), 80);
    else { document.getElementById('mobile-search').value = ''; this.search(''); }
  },
  closeSearch() {
    if (document.getElementById('search-row').classList.contains('open')) this.toggleSearch();
  },


    const meta = (state.filtered || state.items).find(m => m.path === path);
    if (!meta) return;
    const url  = api.downloadURL(path);
    const mime = meta.mime || '';
    let inner  = '';

    if (isImage(mime, meta.name)) {
      inner = \`<img src="\${url}" alt="\${escAttr(meta.name)}">\`;
    } else if (mime.startsWith('video/')) {
      inner = \`<video controls autoplay src="\${url}"></video>\`;
    } else if (mime.startsWith('audio/')) {
      inner = \`<audio controls autoplay src="\${url}" style="width:320px"></audio>\`;
    } else {
      const a = document.createElement('a');
      a.href = url; a.download = meta.name; a.click();
      return;
    }

    document.getElementById('preview-content').innerHTML = inner;
    document.getElementById('preview-name').textContent  = meta.name;
    document.getElementById('preview-overlay').classList.add('open');
  },

  closePreview() {
    document.getElementById('preview-overlay').classList.remove('open');
    document.getElementById('preview-content').innerHTML = '';
  }
};

// ── Drag & Drop ──────────────────────────────────────────────
const dropZone = document.getElementById('drop-zone');

document.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.style.display = 'block';
  dropZone.classList.add('active');
});
document.addEventListener('dragleave', e => {
  if (!e.relatedTarget || !document.contains(e.relatedTarget))
    dropZone.classList.remove('active');
});
document.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('active');
  if (e.dataTransfer.files.length) uploader.add(e.dataTransfer.files);
});

// ── Close on outside click ───────────────────────────────────
document.addEventListener('click', e => {
  if (!e.target.closest('#ctx-menu') && !e.target.classList.contains('file-ctx'))
    UI.closeCtx();
  if (e.target.classList.contains('modal-overlay'))
    e.target.classList.remove('open');
  if (e.target.id === 'preview-overlay') UI.closePreview();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { UI.closePreview(); UI.closeCtx(); UI.closeSearch(); }
  if (e.key === 'Backspace' && !e.target.closest('input,textarea'))
    if (state.path !== '/') UI.navigate(state.path.substring(0, state.path.lastIndexOf('/')) || '/');
});

// ── Helpers ──────────────────────────────────────────────────
const SVG = {
  folder: \`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6a2 2 0 0 1 2-2h3.172a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 10.828 6H16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Z"/></svg>\`,
  image:  \`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="16" height="14"/><circle cx="7" cy="8" r="1.5" fill="currentColor" stroke="none"/><path d="m2 14 4-4 3 3 3-3 6 5"/></svg>\`,
  video:  \`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="12" height="12"/><path d="m14 8 4-2v8l-4-2V8Z"/></svg>\`,
  audio:  \`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v12M5 6v8M13 5v10M17 7v6M1 8v4"/></svg>\`,
  pdf:    \`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-5-5Z"/><path d="M11 2v5h5"/><path d="M7 12h2.5c.83 0 1.5-.67 1.5-1.5S10.33 9 9.5 9H7v6"/></svg>\`,
  word:   \`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-5-5Z"/><path d="M11 2v5h5"/><path d="M7 10h6M7 13h4"/></svg>\`,
  excel:  \`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-5-5Z"/><path d="M11 2v5h5"/><path d="m7 10 2.5 5M12 10l-2.5 5"/></svg>\`,
  zip:    \`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-5-5Z"/><path d="M11 2v5h5"/><path d="M9 9v1m0 1v1m0 1v1m0 1v1" stroke-width="1.8"/><rect x="8" y="15" width="4" height="2"/></svg>\`,
  code:   \`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-5-5Z"/><path d="M11 2v5h5"/><path d="m8 12-2 1.5L8 15M12 12l2 1.5L12 15"/></svg>\`,
  file:   \`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-5-5Z"/><path d="M11 2v5h5"/></svg>\`,
};

function fileIcon(type = 'file', mime = '', name = '') {
  if (type === 'dir') return SVG.folder;
  if (isImage(mime, name)) return SVG.image;
  if (mime.startsWith('video/')) return SVG.video;
  if (mime.startsWith('audio/')) return SVG.audio;
  const ext = name.split('.').pop().toLowerCase();
  if (ext === 'pdf')                                         return SVG.pdf;
  if (['doc','docx','txt','md','rtf'].includes(ext))         return SVG.word;
  if (['xls','xlsx','csv'].includes(ext))                    return SVG.excel;
  if (['zip','rar','7z','tar','gz','bz2'].includes(ext))     return SVG.zip;
  if (['js','ts','jsx','tsx','py','go','rs','java','c','cpp',
       'html','css','json','yaml','toml','sh'].includes(ext)) return SVG.code;
  return SVG.file;
}

function isImage(mime = '', name = '') {
  if (mime.startsWith('image/')) return true;
  return ['jpg','jpeg','png','gif','webp','bmp','avif','svg','ico']
    .includes(name.split('.').pop().toLowerCase());
}

function formatSize(b) {
  if (!b || b === 0) return '0 B';
  if (b < 1024)      return b + ' B';
  if (b < 1048576)   return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(2) + ' MB';
}

function formatDate(ts) {
  const d   = new Date(ts);
  const now = new Date();
  if (d.getFullYear() === now.getFullYear())
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { year: '2-digit', month: 'short', day: 'numeric' });
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(s) { return escHtml(s); }

function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

// ── Boot ─────────────────────────────────────────────────────
UI.navigate('/');
UI.setView(state.view);
</script>
</body>
</html>`;
}
