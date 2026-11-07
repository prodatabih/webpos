const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const { getDb } = require('../database/db');
const {
  handleLogin,
  getAuthenticatedSession,
  handleSwitchContext,
  handleForgotPassword,
  handleResetPassword
} = require('./routes/auth');
const {
  getSuperAdminOverview,
  createTenantAndSendAdminAccount,
  openNewFiscalYearForTenant
} = require('./routes/superAdmin');
const {
  getTenantBootstrap,
  upsertRegistryItem,
  createPartner,
  createCalculation,
  createTransfer,
  createPosReceipt
} = require('./routes/registries');

const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 4100);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
  });
}

function createServer() {
  // Ensure database & seed are initialized on startup
  getDb();

  return http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method.toUpperCase();
    const query = Object.fromEntries(parsedUrl.searchParams.entries());

    try {
      // 1. HEALTH & DB STATS
      if (pathname === '/api/health' && method === 'GET') {
        const db = getDb();
        const stats = {
          tenantsCount: db.prepare('SELECT COUNT(*) AS c FROM tenants').get().c,
          fiscalYearsCount: db.prepare('SELECT COUNT(*) AS c FROM fiscal_years').get().c,
          usersCount: db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
          itemsCount: db.prepare('SELECT COUNT(*) AS c FROM items').get().c
        };
        return sendJson(res, 200, { status: 'ok', database: 'SQLite WAL (Multi-Tenant + Multi-Year)', stats });
      }

      // 2. AUTH ROUTES (Login, Forgot Password, Reset Password, Session Context)
      if (pathname === '/api/auth/login' && method === 'POST') {
        const body = await parseJsonBody(req);
        const result = handleLogin(body);
        return sendJson(res, result.status, result.data);
      }

      if (pathname === '/api/auth/forgot-password' && method === 'POST') {
        const body = await parseJsonBody(req);
        const result = handleForgotPassword(body);
        return sendJson(res, result.status, result.data);
      }

      if (pathname === '/api/auth/reset-password' && method === 'POST') {
        const body = await parseJsonBody(req);
        const result = handleResetPassword(body);
        return sendJson(res, result.status, result.data);
      }

      if (pathname === '/api/auth/me' && method === 'GET') {
        const auth = getAuthenticatedSession(req);
        if (!auth) return sendJson(res, 401, { error: 'Sesija nije aktivna.' });
        return sendJson(res, 200, auth.context);
      }

      if (pathname === '/api/auth/switch-context' && method === 'POST') {
        const auth = getAuthenticatedSession(req);
        if (!auth) return sendJson(res, 401, { error: 'Sesija nije aktivna.' });
        const body = await parseJsonBody(req);
        const result = handleSwitchContext(auth, body);
        return sendJson(res, result.status, result.data);
      }

      // 3. SUPER-ADMIN ROUTES (Upravljanje tenantima, slanje administratorskog računa tenantu, poslovne godine)
      if (pathname === '/api/super-admin/overview' && method === 'GET') {
        const auth = getAuthenticatedSession(req);
        const result = getSuperAdminOverview(auth);
        return sendJson(res, result.status, result.data);
      }

      if (pathname === '/api/super-admin/tenants' && method === 'POST') {
        const auth = getAuthenticatedSession(req);
        const body = await parseJsonBody(req);
        const result = createTenantAndSendAdminAccount(auth, body);
        return sendJson(res, result.status, result.data);
      }

      const fyMatch = pathname.match(/^\/api\/super-admin\/tenants\/([^/]+)\/fiscal-years$/);
      if (fyMatch && method === 'POST') {
        const auth = getAuthenticatedSession(req);
        const body = await parseJsonBody(req);
        const result = openNewFiscalYearForTenant(auth, fyMatch[1], body);
        return sendJson(res, result.status, result.data);
      }

      // 4. TENANT REGISTRIES, DOCUMENTS & POS ROUTES
      if (pathname === '/api/tenant/bootstrap' && method === 'GET') {
        const auth = getAuthenticatedSession(req);
        const result = getTenantBootstrap(auth, query);
        return sendJson(res, result.status, result.data);
      }

      if (pathname === '/api/tenant/items' && method === 'POST') {
        const auth = getAuthenticatedSession(req);
        const body = await parseJsonBody(req);
        const result = upsertRegistryItem(auth, body);
        return sendJson(res, result.status, result.data);
      }

      if (pathname === '/api/tenant/partners' && method === 'POST') {
        const auth = getAuthenticatedSession(req);
        const body = await parseJsonBody(req);
        const result = createPartner(auth, body);
        return sendJson(res, result.status, result.data);
      }

      if (pathname === '/api/tenant/documents/calculation' && method === 'POST') {
        const auth = getAuthenticatedSession(req);
        const body = await parseJsonBody(req);
        const result = createCalculation(auth, body);
        return sendJson(res, result.status, result.data);
      }

      if (pathname === '/api/tenant/documents/transfer' && method === 'POST') {
        const auth = getAuthenticatedSession(req);
        const body = await parseJsonBody(req);
        const result = createTransfer(auth, body);
        return sendJson(res, result.status, result.data);
      }

      if (pathname === '/api/tenant/pos/receipt' && method === 'POST') {
        const auth = getAuthenticatedSession(req);
        const body = await parseJsonBody(req);
        const result = createPosReceipt(auth, body);
        return sendJson(res, result.status, result.data);
      }

      // 5. STATIC FILES (Frontend WebPOS App)
      let filePath = pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, pathname);
      if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        return res.end('Forbidden');
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(PUBLIC_DIR, 'index.html');
      }

      const ext = path.extname(filePath);
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      console.error('Server error:', err);
      sendJson(res, 500, { error: 'Interna greška na serveru: ' + err.message });
    }
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`WebPOS Multi-Tenant Server aktivan na http://localhost:${PORT}`);
  });
}

module.exports = { createServer };
