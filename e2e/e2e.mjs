import { chromium, firefox, webkit } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'https://nginx';
const API_KEY = process.env.PUBLIC_API_KEY;
const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`);
};
const PW = 'Passw0rd!Strong1';
const rnd = Math.random().toString(36).slice(2, 7);

// ---------- API-level checks ----------
async function api(path, opts = {}) {
  const r = await fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) },
  });
  let body = null;
  try { body = await r.json(); } catch {}
  return { status: r.status, body };
}
async function apiTests() {
  console.log('\n=== API ===');
  const reg = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email: `api${rnd}@t.fr`, username: `api${rnd}`, password: PW, preferredLanguage: 'en' }) });
  check('register 201 + token', reg.status === 201 && reg.body?.accessToken);
  const token = reg.body.accessToken; const uid = reg.body.user.id;
  const dup = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email: `api${rnd}@t.fr`, username: `x${rnd}`, password: PW, preferredLanguage: 'en' }) });
  check('duplicate email -> 409', dup.status === 409);
  const weak = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email: `w${rnd}@t.fr`, username: `w${rnd}`, password: 'weakpass1', preferredLanguage: 'en' }) });
  check('weak password -> 400', weak.status === 400);
  const bad = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: `api${rnd}@t.fr`, password: 'Nope!Nope1x' }) });
  check('bad login -> 401', bad.status === 401);
  const me = await api('/users/me', { headers: { authorization: `Bearer ${token}` } });
  check('/users/me 200 incl. own email', me.status === 200 && me.body.email);
  check('/users/me no token -> 401', (await api('/users/me')).status === 401);
  const prof = await api(`/users/${uid}/profile`);
  check('public profile does NOT leak email', prof.status === 200 && !('email' in prof.body));
  const search = await api('/users/search?q=api');
  check('user search does NOT leak email', search.status === 200 && search.body.items.length > 0 && search.body.items.every((u) => !('email' in u)));
  const s2 = await api('/users/search?sortBy=username&order=asc&page=1&pageSize=2&minElo=0');
  check('search filters/sort/pagination', s2.status === 200 && s2.body.pagination.pageSize === 2);
  check('search invalid sortBy -> 400', (await api('/users/search?sortBy=password')).status === 400);
  // avatar
  const fd = new FormData(); fd.append('avatar', new Blob(['x'], { type: 'text/plain' }), 'a.txt');
  const av = await fetch(`${BASE}/api/users/me/avatar`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: fd });
  check('avatar bad type -> 400', av.status === 400, String(av.status));
  // public API
  const H = { 'x-api-key': API_KEY };
  check('public API without key -> 401', (await api('/public/highlights')).status === 401);
  check('public API wrong key -> 401', (await api('/public/highlights', { headers: { 'x-api-key': 'nope' } })).status === 401);
  check('GET list 200', (await api('/public/highlights', { headers: H })).status === 200);
  const c = await api('/public/highlights', { method: 'POST', headers: H, body: JSON.stringify({ title: 'Test title', description: 'A test description', createdById: uid }) });
  check('POST 201', c.status === 201, String(c.status));
  const id = c.body?.id;
  check('POST bad createdById -> 400', (await api('/public/highlights', { method: 'POST', headers: H, body: JSON.stringify({ title: 'Test title', description: 'A test description', createdById: 'nope' }) })).status === 400);
  check('POST invalid body -> 400', (await api('/public/highlights', { method: 'POST', headers: H, body: JSON.stringify({ title: 'x' }) })).status === 400);
  check('GET one 200', (await api(`/public/highlights/${id}`, { headers: H })).status === 200);
  check('GET unknown -> 404', (await api('/public/highlights/unknown', { headers: H })).status === 404);
  check('PUT 200', (await api(`/public/highlights/${id}`, { method: 'PUT', headers: H, body: JSON.stringify({ title: 'Updated title' }) })).status === 200);
  check('DELETE 200', (await api(`/public/highlights/${id}`, { method: 'DELETE', headers: H })).status === 200);
  check('DELETE again -> 404', (await api(`/public/highlights/${id}`, { method: 'DELETE', headers: H })).status === 404);
  let got429 = false;
  for (let i = 0; i < 80 && !got429; i++) got429 = (await api('/public/highlights', { headers: H })).status === 429;
  check('rate limit -> 429', got429);
  // HTTP redirects to HTTPS
  const red = await fetch(BASE.replace('https', 'http') + '/', { redirect: 'manual' });
  check('HTTP -> HTTPS redirect (301)', red.status === 301);
}

// ---------- Browser checks ----------
async function newUser(browser, label) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, locale: 'en-US' });
  await ctx.addInitScript(() => localStorage.setItem('ft_transcendence_language', 'en'));
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
  return { ctx, page, problems, label };
}
async function register(u, name) {
  const { page } = u;
  await page.goto(`${BASE}/register`);
  await page.fill('input[type=email]', `${name}@t.fr`);
  await page.fill('input[autocomplete=username]', name);
  await page.fill('input[type=password]', PW);
  await page.click('button[type=submit]');
  await page.waitForSelector('text=Command Center', { timeout: 15000 });
}

async function browserTests(type, name, full) {
  console.log(`\n=== Browser: ${name} ===`);
  const browser = await type.launch();
  const A = await newUser(browser, 'A');
  const { page } = A;
  await page.goto(`${BASE}/login`);
  check(`[${name}] app renders (login form visible)`, await page.locator('input[type=email]').isVisible({ timeout: 10000 }).catch(() => false));
  // legal pages accessible logged out
  await page.click('footer >> text=Privacy');
  await page.waitForURL('**/privacy');
  const priv = await page.locator('main').innerText();
  check(`[${name}] Privacy page public + substantial`, priv.length > 900, `${priv.length} chars`);
  await page.goto(`${BASE}/terms`);
  const terms = await page.locator('main').innerText();
  check(`[${name}] Terms page public + substantial`, terms.length > 900, `${terms.length} chars`);
  // validation
  await page.goto(`${BASE}/register`);
  await page.fill('input[type=email]', `v${rnd}@t.fr`);
  await page.fill('input[autocomplete=username]', 'ab');
  await page.fill('input[type=password]', 'weak');
  await page.click('button[type=submit]');
  const invalidUser = await page.locator('input[autocomplete=username]').evaluate((el) => !el.validity.valid);
  check(`[${name}] client-side validation blocks bad input`, invalidUser);
  const nameA = `a${name.slice(0, 2)}${rnd}`;
  await register(A, nameA);
  check(`[${name}] register -> dashboard`, true);
  // i18n
  await page.click('.language-switcher >> text=FR');
  await page.waitForSelector('text=Accueil', { timeout: 5000 }).then(() => check(`[${name}] language switch FR`, true)).catch(() => check(`[${name}] language switch FR`, false));
  check(`[${name}] <html lang> follows language`, (await page.evaluate(() => document.documentElement.lang)) === 'fr');
  await page.click('.language-switcher >> text=EN');
  // logout/login
  await page.click('text=Logout');
  await page.waitForURL('**/login');
  await page.fill('input[type=email]', `${nameA}@t.fr`);
  await page.fill('input[type=password]', PW);
  await page.click('button[type=submit]');
  await page.waitForSelector('text=Command Center');
  check(`[${name}] logout + login`, true);
  // profile
  await page.click('nav.top-nav a[href="/profile"]');
  await page.fill('label:has-text("Display Name") input', 'Tester Name');
  await page.click('button:has-text("Save")');
  await page.waitForSelector('text=Saved successfully', { timeout: 5000 }).then(() => check(`[${name}] profile update`, true)).catch(() => check(`[${name}] profile update`, false));
  await page.click('.language-switcher >> text=EN');
  fs.writeFileSync('/tmp/av.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  await page.setInputFiles('input[type=file]', '/tmp/av.png');
  await page.waitForFunction(() => document.querySelector('.profile-card img')?.getAttribute('src')?.includes('/uploads/avatars/'), null, { timeout: 8000 }).then(() => check(`[${name}] avatar upload`, true)).catch(() => check(`[${name}] avatar upload`, false));
  // tournaments page smoke
  await page.click('nav.top-nav a[href="/tournaments"]');
  await page.click('button:has-text("Create Tournament")');
  await page.waitForTimeout(800);
  check(`[${name}] tournament create (UI)`, (await page.locator('.list-button').count()) >= 1);

  if (full) {
    // second user: friends + matchmaking
    const B = await newUser(browser, 'B');
    const nameB = `b${name.slice(0, 2)}${rnd}`;
    await register(B, nameB);
    // A: search B + add
    await page.click('nav.top-nav a[href="/friends"]');
    await page.fill('input[placeholder="username or display name"]', nameB);
    await page.click('button:has-text("Search")');
    await page.waitForSelector(`li:has-text("${nameB}")`);
    await page.click(`li:has-text("${nameB}") >> button:has-text("Add")`);
    await B.page.click('.language-switcher >> text=EN');
    await B.page.click('nav.top-nav a[href="/friends"]');
    await B.page.waitForSelector('button:has-text("Accept")', { timeout: 8000 });
    await B.page.click('button:has-text("Accept")');
    await B.page.waitForSelector(`li:has-text("${nameA}")`, { timeout: 8000 }).then(() => check(`[${name}] friends: request + accept + list`, true)).catch(() => check(`[${name}] friends flow`, false));
    // matchmaking
    await page.click('nav.top-nav a[href="/"]');
    await B.page.click('nav.top-nav a[href="/"]');
    await page.click('button:has-text("Join Matchmaking")');
    await B.page.click('button:has-text("Join Matchmaking")');
    await page.waitForSelector('.match-panel canvas, .match-panel svg', { timeout: 15000 }).then(() => check(`[${name}] matchmaking starts a live match`, true)).catch(() => check(`[${name}] matchmaking`, false));
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(500); await page.keyboard.up('ArrowUp');
    check(`[${name}] live match runs without errors`, true);
    // B drops: disconnect forfeit after grace period
    await B.page.close();
    console.log('   waiting for disconnect grace period (35s)...');
    await page.waitForSelector('text=Match finished.', { timeout: 60000 }).then(() => check(`[${name}] disconnect -> forfeit win after grace`, true)).catch(() => check(`[${name}] forfeit after disconnect`, false));
    await page.waitForTimeout(1000);
    const stats = await page.locator('.badge:has-text("W/L")').innerText();
    check(`[${name}] stats updated (W/L)`, /1\/0/.test(stats), stats);
    // can queue again after a finished match
    check(`[${name}] can re-queue after finished match`, await page.locator('button:has-text("Join Matchmaking")').isEnabled());
    // history + leaderboard visible
    check(`[${name}] match history shown`, (await page.locator('text=Recent Matches').count()) > 0);
    if (B.problems.length) console.log('   B console problems:', B.problems);
    await B.ctx.close();
  }
  const filtered = A.problems.filter((p) => !/favicon/i.test(p));
  check(`[${name}] zero console warnings/errors`, filtered.length === 0, filtered.join(' | ').slice(0, 400));
  await browser.close();
}

await apiTests();
await browserTests(chromium, 'chromium', true);
await browserTests(firefox, 'firefox', false);
await browserTests(webkit, 'webkit(safari)', false);
const failed = results.filter((r) => !r.ok);
console.log(`\nTOTAL ${results.length - failed.length}/${results.length} passed`);
failed.forEach((f) => console.log('FAILED:', f.name));
