import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 5197;
const BASE = `http://127.0.0.1:${PORT}`;
const DB_PATH = '/tmp/webpos_e2e_verify.db';

if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

const dotnetBin = fs.existsSync('/home/antigravity/.dotnet/dotnet')
  ? '/home/antigravity/.dotnet/dotnet'
  : 'dotnet';

const server = spawn(
  dotnetBin,
  ['run', '--no-build', '--project', 'src/WebPos.WebApi/WebPos.WebApi.csproj', '--no-launch-profile', '--urls', BASE],
  {
    env: {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: 'Development',
      Database__Provider: 'Sqlite',
      ConnectionStrings__Sqlite: `Data Source=${DB_PATH}`,
      HTTP_PROXY: '',
      HTTPS_PROXY: '',
      http_proxy: '',
      https_proxy: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  }
);

let serverLogs = '';
server.stdout.on('data', (d) => { serverLogs += d.toString(); });
server.stderr.on('data', (d) => { serverLogs += d.toString(); });

async function api(urlPath, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-json */ }
  return { status: res.status, json, text };
}

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${BASE}/`);
      if (res.status === 200) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server did not start on ${BASE}.\nLogs:\n${serverLogs}`);
}

try {
  await waitForServer();
  console.log('[PASS] Server booted and serving SPA on /');

  // 1. SuperAdmin login
  const saLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'superadmin@webpos.ba', password: 'Admin123!' },
  });
  assert.equal(saLogin.status, 200, `SuperAdmin login failed: ${saLogin.text}`);
  assert.equal(saLogin.json.user.role, 'SuperAdmin');
  const saToken = saLogin.json.token;
  console.log('[PASS] SuperAdmin login');

  // 2. Create Tenant
  const tenantRes = await api('/api/superadmin/tenants', {
    method: 'POST',
    token: saToken,
    body: { code: 'E2E01', name: 'E2E Test Firma', adminEmail: 'admin@e2e.ba', adminPassword: 'Password123!' },
  });
  assert.equal(tenantRes.status, 201, `Create tenant failed: ${tenantRes.text}`);
  assert.ok(tenantRes.json.createdAt, 'Tenant response must include createdAt');
  console.log('[PASS] Create Tenant');

  // 3. TenantAdmin login
  const taLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@e2e.ba', password: 'Password123!' },
  });
  assert.equal(taLogin.status, 200, `TenantAdmin login failed: ${taLogin.text}`);
  const token = taLogin.json.token;
  console.log('[PASS] TenantAdmin login');

  // 4. Create Company, Store, Cash Register with client UUIDs
  const companyId = '10000000-0000-7000-8000-000000000001';
  const storeId = '10000000-0000-7000-8000-000000000002';
  const registerId = '10000000-0000-7000-8000-000000000003';
  const vatId = '10000000-0000-7000-8000-000000000004';
  const fyId = '10000000-0000-7000-8000-000000000005';
  const itemId = '10000000-0000-7000-8000-000000000006';
  const levelingId = '10000000-0000-7000-8000-000000000007';

  const compRes = await api('/api/organization/companies', {
    method: 'POST', token,
    body: { id: companyId, name: 'Test Preduzeće d.o.o.', jib: '4200999880001', pdvNumber: '200999880001', address: 'Maršala Tita 1', city: 'Sarajevo', bankAccount: '1610000000000011' },
  });
  assert.equal(compRes.status, 200, `Create company failed: ${compRes.text}`);

  const storeRes = await api('/api/organization/stores', {
    method: 'POST', token,
    body: { id: storeId, companyId, code: 'MP-01', name: 'Maloprodaja Centar', storeType: 'Retail' },
  });
  assert.equal(storeRes.status, 200, `Create store failed: ${storeRes.text}`);

  const regRes = await api('/api/organization/registers', {
    method: 'POST', token,
    body: { id: registerId, storeId, code: 'BL-01', name: 'Blagajna 1', fiscalDeviceId: 'FP-001' },
  });
  assert.equal(regRes.status, 200, `Create register failed: ${regRes.text}`);
  console.log('[PASS] Company + Store + Cash Register persisted');

  // 5. Create VAT Rate
  const vatRes = await api('/api/organization/vat-rates', {
    method: 'POST', token,
    body: { id: vatId, code: 'E', name: 'Opća stopa 17%', ratePercent: 17.0 },
  });
  assert.equal(vatRes.status, 200, `Create VAT rate failed: ${vatRes.text}`);
  console.log('[PASS] VAT Rate persisted');

  // 6. Create Fiscal Year + auto 12 monthly periods + toggle period lock
  const fyRes = await api('/api/organization/fiscal-years', {
    method: 'POST', token,
    body: { id: fyId, companyId, year: 2026, isClosed: false },
  });
  assert.equal(fyRes.status, 200, `Create FiscalYear failed: ${fyRes.text}`);
  assert.equal(fyRes.json.periods.length, 12, 'FiscalYear must auto-generate 12 monthly periods');

  const janId = fyRes.json.periods[0].id;
  const lockRes = await api(`/api/organization/fiscal-periods/${janId}/toggle`, { method: 'PATCH', token });
  assert.equal(lockRes.status, 200, `Toggle period lock failed: ${lockRes.text}`);
  assert.equal(lockRes.json.isLocked, true, 'January period should now be locked');
  console.log('[PASS] Fiscal Year + 12 Monthly Periods + Period Lock persisted');

  // 7. Create Item + StoreItemPrice (initial retail price when stock == 0)
  const itemRes = await api('/api/master-data/items', {
    method: 'POST', token,
    body: {
      id: itemId, companyId, sku: 'PEK-00001', primaryBarcode: '3871234567890',
      name: 'Mlijeko Megle 1l', shortName: 'Mlijeko 1l', categoryName: 'Pekara i mlijeko',
      uom: 'kom', vatRateId: vatId, itemType: 'Goods', isWeighable: false, isActive: true,
    },
  });
  assert.equal(itemRes.status, 200, `Create item failed: ${itemRes.text}`);

  const priceRes = await api('/api/master-data/store-prices', {
    method: 'POST', token,
    body: { storeId, itemId, retailPriceInclVat2: 2.5 },
  });
  assert.equal(priceRes.status, 200, `Upsert StoreItemPrice failed: ${priceRes.text}`);
  assert.equal(priceRes.json.retailPriceInclVat2, 2.5);
  console.log('[PASS] Item + StoreItemPrice persisted');

  // 8. Create Price Leveling Draft, update Draft (idempotent), then Post
  const nivDraft1 = await api('/api/warehouse-documents/levelings', {
    method: 'POST', token,
    body: {
      id: levelingId, storeId, fiscalYearId: fyId,
      documentNumber: 'NIV-2026-0001', documentDate: '2026-11-22', reason: 'Promjena cijene',
      lines: [{ itemId, newRetailPriceInclVat2: 2.8 }],
    },
  });
  assert.equal(nivDraft1.status, 200, `Create leveling draft failed: ${nivDraft1.text}`);

  const nivDraft2 = await api('/api/warehouse-documents/levelings', {
    method: 'POST', token,
    body: {
      id: levelingId, storeId, fiscalYearId: fyId,
      documentNumber: 'NIV-2026-0001', documentDate: '2026-11-22', reason: 'Korigovana cijena',
      lines: [{ itemId, newRetailPriceInclVat2: 2.95 }],
    },
  });
  assert.equal(nivDraft2.status, 200, `Update leveling draft failed: ${nivDraft2.text}`);

  const nivPost = await api(`/api/warehouse-documents/levelings/${levelingId}/post`, {
    method: 'POST', token,
  });
  assert.equal(nivPost.status, 200, `Post leveling failed: ${nivPost.text}`);
  console.log('[PASS] Price Leveling Draft + Update + Post persisted');

  // 9. Reload via /api/bootstrap and verify ALL persisted entities survive reload
  const boot = await api('/api/bootstrap', { token });
  assert.equal(boot.status, 200, `Bootstrap failed: ${boot.text}`);
  assert.equal(boot.json.companies.length, 1);
  assert.equal(boot.json.storeLocations.length, 1);
  assert.equal(boot.json.posTerminals.length, 1);
  assert.equal(boot.json.vatRates.length, 1);
  assert.equal(boot.json.fiscalYears.length, 1);
  assert.equal(boot.json.fiscalPeriods.length, 12);
  assert.equal(boot.json.fiscalPeriods[0].isLocked, true);
  assert.equal(boot.json.items.length, 1);
  assert.equal(boot.json.storeItemPrices.length, 1);
  assert.equal(boot.json.storeItemPrices[0].retailUnitPriceWithVat, '2.95');
  assert.equal(boot.json.priceLevelings.length, 1);
  assert.equal(boot.json.priceLevelings[0].status, 'POSTED');
  console.log('[PASS] Full /api/bootstrap reload verification passed (100% persisted)');
  console.log('\nALL E2E API INTEGRATION TESTS PASSED!');
} finally {
  server.kill('SIGTERM');
  if (fs.existsSync(DB_PATH)) {
    try { fs.unlinkSync(DB_PATH); } catch { /* ignore */ }
  }
}
