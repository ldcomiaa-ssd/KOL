/**
 * KOLoKOI — Backend Server
 * Run: node server.js
 * Install: npm install express cors @supabase/supabase-js bcryptjs jsonwebtoken
 */

const express   = require('express');
const cors      = require('cors');
const https     = require('https');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const app  = express();
const PORT = 3000;

// ── Credentials ─────────────────────────────────────────────
const SUPABASE_URL  = 'https://xtbirfwcukpkpxkhoegp.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_q4UV9z1vnIqQ0GJlzE0cHA_aOatVD6M';
const JWT_SECRET    = 'kolokoi_secret_2026_change_in_production';
const META_BASE     = 'https://graph.facebook.com/v19.0';

// ── TikTok Sandbox Credentials ───────────────────────────────
// Replace with your actual sandbox app credentials (or use .env)
const TIKTOK_CLIENT_KEY    = process.env.TIKTOK_CLIENT_KEY    || sbawtgf6xvqs628z8y;
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || v9YrMfVEaUoKfkUnzhxMEkPWaY3MMr9;
const TIKTOK_REDIRECT_URI  = process.env.TIKTOK_REDIRECT_URI  || 'http://localhost:3000/api/tiktok/callback';

// ── Supabase ─────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + '/..'));

// ── HTTPS helper ─────────────────────────────────────────────
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON')); }
      });
    }).on('error', reject);
  });
}

// ── HTTPS POST helper (form-encoded) ─────────────────────────
function httpsPost(hostname, path, headers = {}, body = {}) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams(body).toString();
    const options = {
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData), ...headers },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('Invalid JSON in POST')); } });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ── HTTPS POST helper (JSON body) ────────────────────────────
function httpsPostJSON(hostname, path, headers = {}, body = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const options = {
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Content-Length': Buffer.byteLength(postData), ...headers },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('Invalid JSON in POST JSON')); } });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ── Auth middleware ──────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Not authenticated' });
  const token = header.replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ════════════════════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════════════════════

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const {
    first_name, last_name, email, password, role,
    company_name, industry,
    ig_username, tiktok_handle, primary_platform, niche, rate_per_post, payment_method
  } = req.body;

  if (!email || !password || !role)
    return res.status(400).json({ error: 'Email, password and role are required' });
  if (!['company', 'influencer'].includes(role))
    return res.status(400).json({ error: 'Role must be company or influencer' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });

  // Check duplicate email
  const { data: existing } = await supabase
    .from('users').select('id').eq('email', email.toLowerCase()).maybeSingle();
  if (existing)
    return res.status(400).json({ error: 'An account with this email already exists' });

  const password_hash = await bcrypt.hash(password, 12);

  const { data: user, error } = await supabase
    .from('users')
    .insert([{
      first_name, last_name,
      email: email.toLowerCase(),
      password_hash, role,
      company_name:     role === 'company'    ? company_name     : null,
      industry:         role === 'company'    ? industry         : null,
      ig_username:      role === 'influencer' ? ig_username      : null,
      tiktok_handle:    role === 'influencer' ? tiktok_handle    : null,
      primary_platform: role === 'influencer' ? primary_platform : null,
      niche:            role === 'influencer' ? niche            : null,
      rate_per_post:    role === 'influencer' ? rate_per_post    : null,
      payment_method:   role === 'influencer' ? payment_method   : null,
    }])
    .select('id, first_name, last_name, email, role, company_name, industry, ig_username, tiktok_handle, primary_platform, niche')
    .single();

  if (error) { console.error('Register error:', error); return res.status(500).json({ error: error.message }); }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ user, token });
});


// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  const { data: user } = await supabase
    .from('users').select('*').eq('email', email.toLowerCase()).maybeSingle();

  if (!user)
    return res.status(401).json({ error: 'No account found with that email' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid)
    return res.status(401).json({ error: 'Incorrect password' });

  const { password_hash, ...safeUser } = user;
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ user: safeUser, token });
});


// GET /api/auth/me
app.get('/api/auth/me', requireAuth, async (req, res) => {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, first_name, last_name, email, role, company_name, industry, ig_username, tiktok_handle, primary_platform, niche')
    .eq('id', req.user.id).single();
  if (error || !user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});


// ════════════════════════════════════════════════════════════
// META API
// ════════════════════════════════════════════════════════════

app.get('/api/meta/profile', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Missing token' });
  try {
    const data = await httpsGet(`${META_BASE}/me?fields=id,name&access_token=${token}`);
    if (data.error) return res.status(400).json({ error: data.error.message });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/meta/pages', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Missing token' });
  try {
    const data = await httpsGet(`${META_BASE}/me/accounts?fields=id,name,category,fan_count&access_token=${token}`);
    if (data.error) return res.status(400).json({ error: data.error.message });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ════════════════════════════════════════════════════════════
// TIKTOK SANDBOX — LOGIN KIT
// ════════════════════════════════════════════════════════════

// STEP 1 — Start OAuth: redirect user to TikTok login page
app.get('/api/tiktok/login', (req, res) => {
  const state = Math.random().toString(36).substring(2, 15);
  const params = new URLSearchParams({
    client_key: TIKTOK_CLIENT_KEY,
    scope: 'user.info.basic',       // Only scope available in sandbox
    response_type: 'code',
    redirect_uri: TIKTOK_REDIRECT_URI,
    state,
  });
  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  console.log('→ TikTok OAuth redirect:', authUrl);
  res.redirect(authUrl);
});

// STEP 2 — TikTok sends user back with ?code=... → exchange for token → redirect to index.html
app.get('/api/tiktok/callback', async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    console.error('TikTok OAuth error:', error, error_description);
    return res.redirect(`/index.html?tt_error=${encodeURIComponent(error_description || error)}`);
  }
  if (!code) {
    return res.redirect('/index.html?tt_error=No+authorization+code+received');
  }

  try {
    // Exchange code for access token
    console.log('→ Exchanging TikTok code for token...');
    const tokenData = await httpsPost('open.tiktokapis.com', '/v2/oauth/token/', {}, {
      client_key: TIKTOK_CLIENT_KEY,
      client_secret: TIKTOK_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: TIKTOK_REDIRECT_URI,
    });

    console.log('TikTok token response:', JSON.stringify(tokenData, null, 2));

    if (tokenData.error) {
      return res.redirect(`/index.html?tt_error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`);
    }

    const { access_token, open_id, expires_in } = tokenData;

    // Fetch user profile
    console.log('→ Fetching TikTok user profile...');
    const profileData = await httpsPostJSON(
      'open.tiktokapis.com',
      '/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username',
      { 'Authorization': `Bearer ${access_token}` },
      {}
    );

    console.log('TikTok profile:', JSON.stringify(profileData, null, 2));

    const user = profileData?.data?.user || {};

    const params = new URLSearchParams({
      tt_connected:  'true',
      display_name:  user.display_name || 'Sandbox User',
      username:      user.username     || open_id || 'sandbox_user',
      avatar_url:    user.avatar_url   || '',
      open_id:       open_id           || '',
      expires_in:    expires_in        || '86400',
    });

    // Redirect back to main app with user info in URL params
    res.redirect(`/index.html?${params.toString()}`);

  } catch (e) {
    console.error('TikTok callback error:', e.message);
    res.redirect(`/index.html?tt_error=${encodeURIComponent(e.message)}`);
  }
});

// Health check — used by "Check Status" button in UI
app.get('/api/tiktok/status', (req, res) => {
  const configured = TIKTOK_CLIENT_KEY !== 'YOUR_TIKTOK_CLIENT_KEY';
  res.json({
    configured,
    client_key_preview: configured ? TIKTOK_CLIENT_KEY.substring(0, 8) + '...' : 'NOT SET',
    redirect_uri: TIKTOK_REDIRECT_URI,
    sandbox: true,
    available_scopes: ['user.info.basic'],
  });
});


// ════════════════════════════════════════════════════════════
// INFLUENCERS
// ════════════════════════════════════════════════════════════

app.get('/api/influencers', async (req, res) => {
  const { data, error } = await supabase
    .from('influencers').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/influencers', async (req, res) => {
  const { name, email, ig_username, facebook_id, tiktok_handle } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const { data, error } = await supabase
    .from('influencers').insert([{ name, email, ig_username, facebook_id, tiktok_handle }]).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/influencers/:id', async (req, res) => {
  const { error } = await supabase.from('influencers').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ deleted: true });
});


// ════════════════════════════════════════════════════════════
// START
// ════════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log('');
  console.log('✓ KOLoKOI backend running!');
  console.log('  App:          http://localhost:' + PORT);
  console.log('  Login:        http://localhost:' + PORT + '/auth.html');
  console.log('  TikTok OAuth: http://localhost:' + PORT + '/api/tiktok/login');
  console.log('  TikTok check: http://localhost:' + PORT + '/api/tiktok/status');
  console.log('');
});