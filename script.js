// ══════════════════════════════════════════════════════════════
// BACKEND CONFIG
// ══════════════════════════════════════════════════════════════

const BACKEND_URL = 'http://localhost:3000';

async function backendGetInfluencers() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/influencers`);
    return await res.json();
  } catch (e) { return []; }
}

async function backendAddInfluencer(data) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/influencers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch (e) { return { error: e.message }; }
}

async function backendGetMetaProfile(token) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/meta/profile?token=${token}`);
    return await res.json();
  } catch (e) { return { error: e.message }; }
}

// ══════════════════════════════════════════════════════════════
// UI NAVIGATION
// ══════════════════════════════════════════════════════════════

const PAGE_TITLES = {
  dashboard:    'Dashboard',
  campaigns:    'Campaigns',
  deliverables: 'Deliverable Tracking',
  compliance:   'Compliance Tracker',
  marketplace:  'Campaign Marketplace',
  influencers:  'Influencer Database',
  trust:        'Trust & Reliability Scoring',
  network:      'Network Analysis',
  payments:     'Payment Management',
  contracts:    'Contracts & Negotiation',
  sentiment:    'Sentiment Monitor',
  reports:      'Performance Reports',
  integrations: 'API Integrations'
};

function showScreen(screenId, navEl) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const screen = document.getElementById('screen-' + screenId);
  if (screen) screen.classList.add('active');

  document.getElementById('pageTitle').textContent = PAGE_TITLES[screenId] || 'KOLoKOI';

  const clickedNav = navEl || (event && event.currentTarget);
  if (clickedNav) clickedNav.classList.add('active');

  if (screenId === 'network') setTimeout(renderNetworkGraph, 80);
}

// ══════════════════════════════════════════════════════════════
// MODALS
// ══════════════════════════════════════════════════════════════

function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('open');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('open');
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

// ══════════════════════════════════════════════════════════════
// TABS
// ══════════════════════════════════════════════════════════════

function switchTab(el) {
  const group = el.closest('.tabs');
  group.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', function() { switchTab(this); });
});

// ══════════════════════════════════════════════════════════════
// NETWORK GRAPH
// ══════════════════════════════════════════════════════════════

function renderNetworkGraph() {
  const canvas = document.getElementById('networkCanvas');
  if (!canvas) return;
  canvas.innerHTML = '';
  const w = canvas.offsetWidth, h = canvas.offsetHeight;

  const msg = document.createElement('div');
  msg.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;font-size:12px;color:var(--ink-4)';
  msg.textContent = 'Add influencers to see network connections';
  canvas.appendChild(msg);
}

// ══════════════════════════════════════════════════════════════
// META API
// ══════════════════════════════════════════════════════════════

const api = {
  log: [],
  _log(platform, message, type = 'info') {
    this.log.unshift({ platform, message, type, time: new Date() });
    if (this.log.length > 50) this.log = this.log.slice(0, 50);
    this._renderSyncLog();
  },
  _renderSyncLog() {
    const el = document.getElementById('syncLog');
    if (!el) return;
    if (!this.log.length) {
      el.innerHTML = '<div style="color:var(--ink-4);font-size:12px;text-align:center;padding:20px">No activity yet — connect Meta to see events here</div>';
    } else {
      el.innerHTML = this.log.slice(0, 12).map(e => `
        <div class="tl-item">
          <div class="tl-dot ${e.type === 'success' ? 'green' : e.type === 'error' ? 'accent' : 'amber'}"></div>
          <div>
            <div class="tl-title">${e.platform} — ${e.message}</div>
            <div class="tl-time">${_ago(e.time)}</div>
          </div>
        </div>`).join('');
    }
    _updateLogCount();
  }
};

// ── Meta state ──────────────────────────────────────────────
let _metaToken = null;
let _metaUser  = null;

async function connectMeta() {
  const token = document.getElementById('metaToken').value.trim();
  if (!token) { alert('Please enter your Access Token.'); return; }

  const badge = document.getElementById('metaBadge');
  badge.textContent = 'Connecting…';
  badge.className = 'badge badge-amber';

  const data = await backendGetMetaProfile(token);

  if (data.error || !data.id) {
    badge.textContent = '✕ Failed';
    badge.className = 'badge badge-red';
    api._log('Meta', 'Connection failed: ' + (data.error || 'Invalid token'), 'error');
    document.getElementById('metaProfileResult').innerHTML = `
      <div class="alert alert-red" style="margin-top:12px">
        <span class="alert-icon">✕</span>
        <div><div class="alert-title">Connection Failed</div>
        <div class="alert-desc">${data.error || 'Invalid token. Generate one at developers.facebook.com → Graph API Explorer.'}</div></div>
      </div>`;
    return;
  }

  _metaToken = token;
  _metaUser  = data;

  badge.textContent = '● Connected';
  badge.className = 'badge badge-green';
  document.getElementById('metaProfileResult').innerHTML = '';

  api._log('Meta', `Connected as ${data.name} (${data.id})`, 'success');
  _showMetaDataSection(data);
  fetchMetaPages();
}

async function testMeta() {
  const token = document.getElementById('metaToken').value.trim();
  if (!token) { alert('Please enter your Access Token first.'); return; }

  const profileDiv = document.getElementById('metaProfileResult');
  profileDiv.innerHTML = '<div style="color:var(--ink-4);font-size:12px;margin-top:8px">Testing…</div>';

  const data = await backendGetMetaProfile(token);

  if (data.error || !data.id) {
    profileDiv.innerHTML = `
      <div class="alert alert-red" style="margin-top:12px">
        <span class="alert-icon">✕</span>
        <div><div class="alert-title">Connection Failed</div>
        <div class="alert-desc">${data.error || 'Invalid token. Generate one at developers.facebook.com → Graph API Explorer.'}</div></div>
      </div>`;
    api._log('Meta', 'Test failed: ' + (data.error || 'Invalid token'), 'error');
    return;
  }

  profileDiv.innerHTML = `
    <div class="alert alert-green" style="margin-top:12px">
      <span class="alert-icon">✓</span>
      <div>
        <div class="alert-title">Token valid — ${data.name}</div>
        <div class="alert-desc">Facebook ID: ${data.id} · Click Connect to load your data.</div>
      </div>
    </div>`;
  api._log('Meta', `Token verified for ${data.name}`, 'success');
}

function _showMetaDataSection(user) {
  const section = document.getElementById('metaDataSection');
  if (!section) return;
  section.style.display = 'block';

  const initials = (user.name || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  const avatarEl = document.getElementById('metaUserAvatar');
  const nameEl   = document.getElementById('metaUserName');
  const idEl     = document.getElementById('metaUserId');
  const subEl    = document.getElementById('metaAccountSubtitle');

  if (avatarEl) avatarEl.textContent = initials;
  if (nameEl)   nameEl.textContent   = user.name;
  if (idEl)     idEl.textContent     = `Facebook ID: ${user.id}`;
  if (subEl)    subEl.textContent    = `Logged in as ${user.name} · Token active`;

  // Also update dashboard sync activity
  const dashSync = document.getElementById('dashSyncActivity');
  if (dashSync) {
    dashSync.innerHTML = `
      <div class="tl-item"><div class="tl-dot green"></div><div>
        <div class="tl-title">Meta Connected — ${user.name}</div>
        <div class="tl-detail">Facebook ID: ${user.id} · Token verified</div>
        <div class="tl-time">just now</div>
      </div></div>`;
  }
}

async function fetchMetaPages() {
  if (!_metaToken) { alert('Connect Meta first.'); return; }
  const grid = document.getElementById('metaPagesGrid');
  if (!grid) return;

  grid.innerHTML = '<div style="color:var(--ink-4);font-size:12px;text-align:center;padding:16px">Loading your pages…</div>';
  api._log('Meta', 'Fetching connected pages…', 'info');

  try {
    const res = await fetch(`${BACKEND_URL}/api/meta/pages?token=${_metaToken}`);
    const data = await res.json();

    if (data.error || !data.data) {
      grid.innerHTML = `<div class="alert alert-amber"><span class="alert-icon">⚠</span><div><div class="alert-title">Could not load pages</div><div class="alert-desc">${data.error || 'No pages returned. Make sure your token has pages_read_engagement permission.'}</div></div></div>`;
      api._log('Meta', 'Pages fetch failed: ' + (data.error || 'no data'), 'error');
      return;
    }

    if (!data.data.length) {
      grid.innerHTML = '<div style="color:var(--ink-4);font-size:12px;text-align:center;padding:16px">No Facebook Pages found on this account.</div>';
      return;
    }

    grid.innerHTML = data.data.map(page => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--surface-2);border-radius:var(--r);border:1px solid var(--rule)">
        <div class="inf-av" style="width:36px;height:36px;font-size:12px;flex-shrink:0">${(page.name||'?').slice(0,2).toUpperCase()}</div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px">${page.name}</div>
          <div style="font-size:11px;color:var(--ink-4)">Page ID: ${page.id}${page.category ? ' · ' + page.category : ''}</div>
        </div>
        <span class="badge badge-blue">FB Page</span>
      </div>`).join('');

    api._log('Meta', `Loaded ${data.data.length} page(s)`, 'success');
    _updateLogCount();
  } catch (e) {
    grid.innerHTML = `<div class="alert alert-red"><span class="alert-icon">✕</span><div><div class="alert-title">Fetch Error</div><div class="alert-desc">${e.message}</div></div></div>`;
    api._log('Meta', 'Pages fetch error: ' + e.message, 'error');
  }
}

function disconnectMeta() {
  _metaToken = null;
  _metaUser  = null;
  const badge = document.getElementById('metaBadge');
  if (badge) { badge.textContent = 'Not Connected'; badge.className = 'badge badge-ink'; }
  const section = document.getElementById('metaDataSection');
  if (section) section.style.display = 'none';
  const input = document.getElementById('metaToken');
  if (input) input.value = '';
  const profileDiv = document.getElementById('metaProfileResult');
  if (profileDiv) profileDiv.innerHTML = '';
  api._log('Meta', 'Disconnected', 'info');
  _updateLogCount();
}

function _updateLogCount() {
  const el = document.getElementById('logCount');
  if (el) el.textContent = api.log.length + ' event' + (api.log.length !== 1 ? 's' : '');
}

// ── TikTok state ─────────────────────────────────────────────
let _tiktokUser = null;

// Called when user clicks "Connect TikTok" — redirects to OAuth
function connectTikTok() {
  const badge = document.getElementById('tiktokBadge');
  if (badge) { badge.textContent = 'Redirecting…'; badge.className = 'badge badge-amber'; }
  api._log('TikTok', 'Redirecting to TikTok OAuth…', 'info');
  window.location.href = `${BACKEND_URL}/api/tiktok/login`;
}

// Check TikTok backend config status
async function testTikTokStatus() {
  const el = document.getElementById('tiktokStatusResult');
  if (el) el.innerHTML = '<div style="color:var(--ink-4);font-size:12px">Checking…</div>';
  try {
    const res = await fetch(`${BACKEND_URL}/api/tiktok/status`);
    const data = await res.json();
    if (el) {
      el.innerHTML = data.configured
        ? `<div class="alert alert-green" style="margin-top:0"><span class="alert-icon">✓</span><div><div class="alert-title">Backend Configured</div><div class="alert-desc">Client key: ${data.client_key_preview} · Redirect: ${data.redirect_uri}</div></div></div>`
        : `<div class="alert alert-red" style="margin-top:0"><span class="alert-icon">✕</span><div><div class="alert-title">Not Configured</div><div class="alert-desc">Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in your server.js or .env file</div></div></div>`;
    }
    api._log('TikTok', data.configured ? 'Backend configured ✓' : 'Backend credentials missing', data.configured ? 'success' : 'error');
  } catch (e) {
    if (el) el.innerHTML = `<div class="alert alert-red" style="margin-top:0"><span class="alert-icon">✕</span><div><div class="alert-title">Cannot reach server</div><div class="alert-desc">Make sure node server.js is running on port 3000</div></div></div>`;
  }
}

// Called after TikTok OAuth callback redirects back to index.html
function _initTikTokFromCallback() {
  const p = new URLSearchParams(window.location.search);
  if (p.get('tt_connected') !== 'true') return;

  const user = {
    display_name: p.get('display_name') || 'TikTok User',
    username:     p.get('username')     || '',
    avatar_url:   p.get('avatar_url')   || '',
    open_id:      p.get('open_id')      || '',
    expires_in:   p.get('expires_in')   || '',
  };

  _tiktokUser = user;
  _setTikTokConnected(user);
  api._log('TikTok', `Connected as ${user.display_name}`, 'success');

  // Clean URL params
  window.history.replaceState({}, '', 'index.html');
}

function _initTikTokErrorFromCallback() {
  const p = new URLSearchParams(window.location.search);
  const err = p.get('tt_error');
  if (!err) return;

  const badge = document.getElementById('tiktokBadge');
  if (badge) { badge.textContent = 'Error'; badge.className = 'badge badge-red'; }

  const el = document.getElementById('tiktokStatusResult');
  if (el) el.innerHTML = `<div class="alert alert-red" style="margin-top:0"><span class="alert-icon">✕</span><div><div class="alert-title">TikTok Auth Error</div><div class="alert-desc">${decodeURIComponent(err)}</div></div></div>`;

  api._log('TikTok', 'Auth error: ' + decodeURIComponent(err), 'error');
  window.history.replaceState({}, '', 'index.html');
}

function _setTikTokConnected(user) {
  const badge = document.getElementById('tiktokBadge');
  if (badge) { badge.textContent = '● Connected'; badge.className = 'badge badge-green'; }

  const profileDiv = document.getElementById('tiktokProfileResult');
  if (profileDiv) {
    document.getElementById('tiktokUserName').textContent   = user.display_name;
    document.getElementById('tiktokUserHandle').textContent = '@' + (user.username || user.open_id);
    if (user.avatar_url) {
      const av = document.getElementById('tiktokAvatar');
      if (av) av.innerHTML = `<img src="${user.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" onerror="this.parentElement.textContent='TT'"/>`;
    }
    profileDiv.style.display = 'flex';
  }

  const note = document.getElementById('tiktokSandboxNote');
  if (note) note.style.display = 'none';

  const connectBtn = document.getElementById('tiktokConnectBtn');
  if (connectBtn) connectBtn.style.display = 'none';
  const disconnectBtn = document.getElementById('tiktokDisconnectBtn');
  if (disconnectBtn) disconnectBtn.style.display = 'inline-flex';

  // Update dashboard API activity
  const dashSync = document.getElementById('dashSyncActivity');
  if (dashSync) {
    dashSync.innerHTML = `<div style="font-size:13px;color:var(--green);font-weight:500">✓ TikTok connected as @${user.username || user.open_id}</div>`;
  }
  const liveBadge = document.getElementById('apiLiveBadge');
  if (liveBadge) liveBadge.innerHTML = `<span class="dot live" style="margin-right:4px"></span>Live`;
}

function disconnectTikTok() {
  _tiktokUser = null;
  const badge = document.getElementById('tiktokBadge');
  if (badge) { badge.textContent = 'Not Connected'; badge.className = 'badge badge-ink'; }
  const profileDiv = document.getElementById('tiktokProfileResult');
  if (profileDiv) profileDiv.style.display = 'none';
  const note = document.getElementById('tiktokSandboxNote');
  if (note) note.style.display = 'flex';
  const connectBtn = document.getElementById('tiktokConnectBtn');
  if (connectBtn) connectBtn.style.display = 'inline-flex';
  const disconnectBtn = document.getElementById('tiktokDisconnectBtn');
  if (disconnectBtn) disconnectBtn.style.display = 'none';
  const statusEl = document.getElementById('tiktokStatusResult');
  if (statusEl) statusEl.innerHTML = '';
  api._log('TikTok', 'Disconnected', 'info');
}

function saveSync() {
  const freq = parseInt(document.getElementById('syncFreq').value);
  api._log('System', `Auto-sync set to every ${freq} minutes`, 'info');
  alert('Settings saved.');
}

async function runSync() {
  const btn = event.currentTarget;
  btn.disabled = true; btn.textContent = 'Syncing…';
  api._log('System', 'Manual sync started', 'info');
  await new Promise(r => setTimeout(r, 800));
  api._log('System', 'Sync complete', 'success');
  btn.disabled = false; btn.textContent = 'Run Manual Sync';
}

// ══════════════════════════════════════════════════════════════
// INFLUENCER DATABASE
// ══════════════════════════════════════════════════════════════

async function loadInfluencersFromBackend() {
  const tbody = document.querySelector('#screen-influencers .table-wrap tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="8" style="color:var(--ink-4);font-size:12px;text-align:center;padding:20px">Loading...</td></tr>';

  const influencers = await backendGetInfluencers();

  // Update active influencers stat
  const statEl = document.getElementById('statActiveInfluencers');
  if (statEl) statEl.textContent = Array.isArray(influencers) ? influencers.length : 0;

  if (!Array.isArray(influencers) || !influencers.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="color:var(--ink-4);font-size:12px;text-align:center;padding:20px">No influencers yet — click "+ Add Influencer" to get started</td></tr>';
    const dashTbody = document.getElementById('dashTopInfluencers');
    if (dashTbody) dashTbody.innerHTML = '<tr><td colspan="4" style="color:var(--ink-4);font-size:12px;text-align:center;padding:16px">No influencers added yet</td></tr>';
    return;
  }

  tbody.innerHTML = influencers.map(inf => `
    <tr>
      <td><div class="inf-cell">
        <div class="inf-av">${(inf.name||'?').slice(0,2).toUpperCase()}</div>
        <div>
          <div class="inf-name">${inf.name||'—'}</div>
          <div class="inf-handle">${inf.email||'—'}</div>
        </div>
      </div></td>
      <td style="font-size:11px">${inf.ig_username ? `<span class="badge badge-blue">IG</span> @${inf.ig_username}` : (inf.facebook_id ? `<span class="badge badge-blue">FB</span> ${inf.facebook_id}` : '—')}</td>
      <td>${inf.followers_count ? Number(inf.followers_count).toLocaleString() : '—'}</td>
      <td>—</td><td>—</td>
      <td><div class="score-ring">—</div></td>
      <td><span class="badge badge-green"><span class="dot live" style="margin-right:4px"></span>Active</span></td>
      <td><button class="btn btn-ghost btn-sm">View →</button></td>
    </tr>
  `).join('');

  const dashTbody = document.getElementById('dashTopInfluencers');
  if (dashTbody) {
    dashTbody.innerHTML = influencers.slice(0,4).map(inf => `
      <tr>
        <td><div class="inf-cell">
          <div class="inf-av">${(inf.name||'?').slice(0,2).toUpperCase()}</div>
          <div>
            <div class="inf-name">${inf.name||'—'}</div>
            <div class="inf-handle">${inf.ig_username ? '@'+inf.ig_username : (inf.email||'—')}</div>
          </div>
        </div></td>
        <td><span class="badge badge-blue">Meta</span></td>
        <td>—</td>
        <td><div class="score-ring">—</div></td>
      </tr>`).join('');
  }
}

function wireAddInfluencerModal() {
  const modal = document.getElementById('addInfluencerModal');
  if (!modal) return;
  const addBtn = modal.querySelector('.modal-footer .btn-primary');
  if (!addBtn) return;

  addBtn.addEventListener('click', async () => {
    const inputs = modal.querySelectorAll('input, select');
    const name      = inputs[0]?.value.trim();
    const email     = inputs[1]?.value.trim();
    const instagram = inputs[3]?.value.trim();
    const facebook  = inputs[4]?.value.trim();

    if (!name) { alert('Please enter a name.'); return; }

    addBtn.textContent = 'Adding…';
    addBtn.disabled = true;

    const result = await backendAddInfluencer({
      name,
      email: email || null,
      ig_username: instagram ? instagram.replace('@','') : null,
      facebook_id: facebook || null,
    });

    addBtn.textContent = 'Add Influencer';
    addBtn.disabled = false;

    if (result.error) {
      alert('Error saving: ' + result.error + '\n\nMake sure your backend (node server.js) is running!');
    } else {
      closeModal('addInfluencerModal');
      alert('✓ ' + name + ' added successfully!');
      loadInfluencersFromBackend();
    }
  });
}

// ══════════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════════

function _ago(date) {
  const s = Math.floor((Date.now() - date) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}

// ══════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════

window.addEventListener('load', () => {
  setTimeout(renderNetworkGraph, 100);
  loadInfluencersFromBackend();
  wireAddInfluencerModal();
  // Handle TikTok OAuth callback — URL params injected by server redirect
  _initTikTokFromCallback();
  _initTikTokErrorFromCallback();
});