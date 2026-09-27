// Verificación visual del Dashboard Ejecutivo (spec 0044-b).
// - Sirve la app real (ng serve :4200).
// - Intercepta Supabase: auth simulada como admin; las RPC exec_dashboard_* se resuelven
//   EJECUTANDO las funciones SQL reales contra el Postgres local (seed determinístico).
// Uso: node verify-dashboard.mjs <outDir> [width] [height] [mode] [tab] [branch]
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const [, , outDir = '.', width = '1440', height = '900', mode = 'light', tab = '', branch = 'null'] =
  process.argv;
const REF = 'skvekggejikzxhzsjmkz';
const BASE = `https://${REF}.supabase.co`;
const ADMIN_UID = '00000000-0000-0000-0000-000000000001';

function psqlJson(sql) {
  const out = execFileSync(
    'psql',
    ['-h', '/var/tmp/pgtest', '-p', '54329', '-U', 'postgres', '-d', 'app', '-At', '-c',
      `set request.jwt.claim.sub='${ADMIN_UID}'; ${sql}`],
    { encoding: 'utf8' },
  );
  return out.trim().split('\n').filter((l) => l && l !== 'SET').join('\n');
}

function runRpc(name, p) {
  const lit = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? v : `'${v}'`);
  switch (name) {
    case 'exec_dashboard_kpis':
      return JSON.parse(psqlJson(`select exec_dashboard_kpis(${lit(p.p_from)},${lit(p.p_to)},${lit(p.p_branch_id)})::text`));
    case 'exec_dashboard_today_ops':
      return JSON.parse(psqlJson(`select exec_dashboard_today_ops(${lit(p.p_branch_id)})::text`));
    case 'exec_dashboard_monthly_series':
      return JSON.parse(psqlJson(`select coalesce(json_agg(t),'[]')::text from exec_dashboard_monthly_series(${lit(p.p_year)},${lit(p.p_branch_id)}) t`));
    case 'exec_dashboard_instructor_hours':
      return JSON.parse(psqlJson(`select coalesce(json_agg(t),'[]')::text from exec_dashboard_instructor_hours(${lit(p.p_from)},${lit(p.p_to)},${lit(p.p_branch_id)}) t`));
    case 'exec_dashboard_receivables':
      return JSON.parse(psqlJson(`select coalesce(json_agg(t),'[]')::text from exec_dashboard_receivables(${lit(p.p_branch_id)}) t`));
    default:
      return [];
  }
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: ADMIN_UID, role: 'authenticated', exp: 4102444800, aud: 'authenticated', email: 'admin@test.cl' })}.sig`;
const user = { id: ADMIN_UID, email: 'admin@test.cl', aud: 'authenticated', role: 'authenticated', user_metadata: {}, app_metadata: {} };
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const context = await browser.newContext({ viewport: { width: +width, height: +height }, colorScheme: mode });
const consoleErrors = [];
const rpcLog = [];

await context.addInitScript(([k, v, m, br]) => {
  localStorage.setItem(k, v);
  localStorage.setItem('app-color-mode', m);
  if (br !== 'null') {
    const names = { 1: 'Autoescuela Chillán', 2: 'Conductores Chillán' };
    localStorage.setItem('autoescuela:selectedBranchId', JSON.stringify({ id: +br, name: names[br] }));
  } else {
    localStorage.removeItem('autoescuela:selectedBranchId');
  }
}, [`sb-${REF}-auth-token`, JSON.stringify(session), mode, branch]);

await context.route(`${BASE}/**`, async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  const path = url.pathname;
  const json = (body, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  if (path.startsWith('/auth/v1/user')) return json(user);
  if (path.startsWith('/auth/v1')) return json({});
  if (path.startsWith('/rest/v1/rpc/')) {
    const name = path.split('/').pop();
    const params = req.postDataJSON?.() ?? {};
    rpcLog.push({ name, params });
    try {
      return json(runRpc(name, params));
    } catch (e) {
      return json({ message: String(e.message).slice(0, 200), code: '42501' }, 400);
    }
  }
  const wantsObject = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
  if (path === '/rest/v1/users' && url.search.includes('supabase_uid')) {
    return json({ id: 9001, first_names: 'Jorge', paternal_last_name: 'Pérez', branch_id: 1,
      can_access_both_branches: true, first_login: false, active: true, role_id: 1, roles: { name: 'admin' } });
  }
  if (path === '/rest/v1/branches') {
    return json([
      { id: 1, name: 'Autoescuela Chillán', slug: 'autoescuela-chillan', has_professional: false },
      { id: 2, name: 'Conductores Chillán', slug: 'conductores-chillan', has_professional: true },
    ]);
  }
  return json(wantsObject ? null : []);
});
await context.routeWebSocket(/realtime/, (ws) => {
  ws.onMessage(() => {});
});

const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

await page.goto('http://localhost:4200/app/admin/dashboard', { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(2500);
console.log('URL:', page.url());

if (tab) {
  await page.getByRole('tab', { name: new RegExp(tab, 'i') }).first().click().catch(async () => {
    await page.getByText(new RegExp(tab, 'i')).first().click();
  });
  await page.waitForTimeout(800);
}

const tag = `${width}x${height}-${mode}${tab ? '-' + tab.replace(/\W+/g, '') : ''}${branch !== 'null' ? '-b' + branch : ''}`;
await page.screenshot({ path: `${outDir}/dash-${tag}.png`, fullPage: false });

// Métricas app-like: ¿el documento scrollea en desktop?
const geo = await page.evaluate(() => {
  const main = document.querySelector('main');
  const grid = document.querySelector('.exec-grid');
  const fill = document.querySelector('.exec-grid > .bento-fill');
  return {
    docScroll: document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight,
    mainScroll: main ? main.scrollHeight - main.clientHeight : null,
    gridH: grid?.getBoundingClientRect().height,
    fillH: fill?.getBoundingClientRect().height,
    kpiCards: document.querySelectorAll('app-kpi-card-variant').length,
    heroText: document.querySelector('app-section-hero')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 160),
  };
});
console.log('GEO:', JSON.stringify(geo));
console.log('RPC calls:', rpcLog.length, [...new Set(rpcLog.map((r) => r.name))].join(','));
console.log('RPC branch params:', [...new Set(rpcLog.map((r) => String(r.params.p_branch_id)))].join(','));
console.log('CONSOLE ERRORS:', consoleErrors.length);
consoleErrors.slice(0, 8).forEach((e) => console.log('  -', e.slice(0, 220)));
await browser.close();
