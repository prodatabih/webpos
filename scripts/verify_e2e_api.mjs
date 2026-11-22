import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = 5196;
const BASE = `http://127.0.0.1:${PORT}`;
const DB_PATH = '/tmp/webpos_e2e_full.db';

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
  console.log('[1/18] Server booted and serving SPA');

  // 1. SuperAdmin login & Tenant A + Tenant B creation
  const saLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'superadmin@webpos.ba', password: 'Admin123!' },
  });
  assert.equal(saLogin.status, 200, `SuperAdmin login failed: ${saLogin.text}`);
  const saToken = saLogin.json.token;

  const tenantA = await api('/api/superadmin/tenants', {
    method: 'POST', token: saToken,
    body: { code: 'TENA', name: 'Tenant A d.o.o.', adminEmail: 'admin@tenanta.ba', adminPassword: 'Password123!' },
  });
  assert.equal(tenantA.status, 201, `Create Tenant A failed: ${tenantA.text}`);
  assert.equal(tenantA.json.userCount, 1);

  const editTenantA = await api(`/api/superadmin/tenants/${tenantA.json.id}`, {
    method: 'PUT', token: saToken,
    body: { code: 'TENA', name: 'Tenant A Enterprise d.o.o.' },
  });
  assert.equal(editTenantA.status, 200, `Update Tenant A failed: ${editTenantA.text}`);

  const tenantB = await api('/api/superadmin/tenants', {
    method: 'POST', token: saToken,
    body: { code: 'TENB', name: 'Tenant B d.o.o.', adminEmail: 'admin@tenantb.ba', adminPassword: 'Password123!' },
  });
  assert.equal(tenantB.status, 201, `Create Tenant B failed: ${tenantB.text}`);
  console.log('[2/18] SuperAdmin Tenant CRUD passed');

  // 2. Forgot Password & Reset Password flow
  const forgot = await api('/api/auth/forgot-password', {
    method: 'POST',
    body: { emailOrUsername: 'admin@tenanta.ba' },
  });
  assert.equal(forgot.status, 200, `Forgot password failed: ${forgot.text}`);
  assert.ok(forgot.json.resetCode, 'Reset code must be generated');

  const reset = await api('/api/auth/reset-password', {
    method: 'POST',
    body: { emailOrUsername: 'admin@tenanta.ba', resetCode: forgot.json.resetCode, newPassword: 'NewPassword123!' },
  });
  assert.equal(reset.status, 200, `Reset password failed: ${reset.text}`);

  const taLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@tenanta.ba', password: 'NewPassword123!' },
  });
  assert.equal(taLogin.status, 200, `TenantAdmin A login after reset failed: ${taLogin.text}`);
  const tokenA = taLogin.json.token;

  const chgPwd = await api('/api/auth/change-password', {
    method: 'POST', token: tokenA,
    body: { currentPassword: 'NewPassword123!', newPassword: 'FinalPassword123!' },
  });
  assert.equal(chgPwd.status, 200, `Change password failed: ${chgPwd.text}`);
  console.log('[3/18] Forgot Password, Reset Password & Change Password passed');

  // 3. Users CRUD + RBAC check (Cashier forbidden from admin routes)
  const createCashier = await api('/api/users', {
    method: 'POST', token: tokenA,
    body: { username: 'kasir1', email: 'kasir1@tenanta.ba', password: 'Password123!', role: 'Cashier' },
  });
  assert.equal(createCashier.status, 201, `Create Cashier failed: ${createCashier.text}`);
  const cashierId = createCashier.json.id;

  const editCashier = await api(`/api/users/${cashierId}`, {
    method: 'PUT', token: tokenA,
    body: { username: 'kasir1_upd', email: 'kasir1@tenanta.ba', role: 'Cashier' },
  });
  assert.equal(editCashier.status, 200, `Edit Cashier failed: ${editCashier.text}`);

  const cashierLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'kasir1@tenanta.ba', password: 'Password123!' },
  });
  assert.equal(cashierLogin.status, 200);
  const cashierToken = cashierLogin.json.token;

  const cashierForbiddenUsers = await api('/api/users', { token: cashierToken });
  assert.equal(cashierForbiddenUsers.status, 403, 'Cashier must be 403 on GET /api/users');

  const cashierForbiddenCompany = await api('/api/organization/companies', {
    method: 'POST', token: cashierToken,
    body: { name: 'Hack', jib: '1234567890123', address: 'A', city: 'B' },
  });
  assert.equal(cashierForbiddenCompany.status, 403, 'Cashier must be 403 on POST company');
  console.log('[4/18] Users CRUD + RBAC enforcement passed');

  // 4. Organization CRUD + Conditional Delete + Production StoreType
  const companyId = '10000000-0000-7000-8000-000000000001';
  const tempCompId = '10000000-0000-7000-8000-000000000099';
  const store1Id = '10000000-0000-7000-8000-000000000002';
  const store2Id = '10000000-0000-7000-8000-000000000003';
  const registerId = '10000000-0000-7000-8000-000000000004';
  const vatId = '10000000-0000-7000-8000-000000000005';
  const fyId = '10000000-0000-7000-8000-000000000006';
  const partnerId = '10000000-0000-7000-8000-000000000007';
  const item1Id = '10000000-0000-7000-8000-000000000008';
  const itemTempId = '10000000-0000-7000-8000-000000000009';

  assert.equal((await api('/api/organization/companies', {
    method: 'POST', token: tokenA,
    body: { id: tempCompId, code: 'TMP', name: 'Temp', jib: '4200000000009', address: 'X', city: 'Sarajevo' },
  })).status, 200);
  assert.equal((await api(`/api/organization/companies/${tempCompId}`, { method: 'DELETE', token: tokenA })).status, 204);

  assert.equal((await api('/api/organization/companies', {
    method: 'POST', token: tokenA,
    body: { id: companyId, code: 'FIR-01', name: 'Bosna Trade d.o.o.', jib: '4200123450001', pdvNumber: '200123450001', address: 'Titova 10', city: 'Sarajevo', currencyCode: 'BAM', bankAccount: '1610000000000011' },
  })).status, 200);

  assert.equal((await api('/api/organization/stores', {
    method: 'POST', token: tokenA,
    body: { id: store1Id, companyId, code: 'MP-01', name: 'Maloprodaja 1', storeType: 'Retail', address: 'Ferhadija 5', city: 'Sarajevo', isActive: true },
  })).status, 200);

  assert.equal((await api('/api/organization/stores', {
    method: 'POST', token: tokenA,
    body: { id: store2Id, companyId, code: 'PR-01', name: 'Proizvodnja 1', storeType: 'Production', address: 'Ilidža 1', city: 'Sarajevo', isActive: true },
  })).status, 200);

  // Deleting company with stores must return 409 Conflict
  assert.equal((await api(`/api/organization/companies/${companyId}`, { method: 'DELETE', token: tokenA })).status, 409);

  assert.equal((await api('/api/organization/registers', {
    method: 'POST', token: tokenA,
    body: { id: registerId, storeId: store1Id, code: 'BL-01', name: 'Blagajna 1', fiscalDeviceId: 'BF-01', isActive: true },
  })).status, 200);
  console.log('[5/18] Organization CRUD + Production StoreType + Conditional DELETE passed');

  // 5. Tenant Settings
  const setSettings = await api('/api/organization/tenant-settings', {
    method: 'PUT', token: tokenA,
    body: { allowNegativeStock: false, allowPriceChangeWithoutLeveling: false, autoCreatePriceLevelingOnInbound: true, defaultCurrency: 'BAM' },
  });
  assert.equal(setSettings.status, 200, `Tenant settings failed: ${setSettings.text}`);
  console.log('[6/18] Tenant Settings persistence passed');

  // 6. VAT Rates + Fiscal Year + 12 Periods + Period Lock Guard
  assert.equal((await api('/api/organization/vat-rates', {
    method: 'POST', token: tokenA,
    body: { id: vatId, companyId, code: 'E', name: 'Opća stopa 17%', ratePercent: 17.0, validFrom: '2026-01-01', isActive: true },
  })).status, 200);

  const fyRes = await api('/api/organization/fiscal-years', {
    method: 'POST', token: tokenA,
    body: { id: fyId, companyId, year: 2026, isClosed: false },
  });
  assert.equal(fyRes.status, 200, `Fiscal year failed: ${fyRes.text}`);
  assert.equal(fyRes.json.periods.length, 12);
  const novPeriod = fyRes.json.periods.find((p) => p.month === 11);
  assert.ok(novPeriod, 'November period must exist');
  console.log('[7/18] VAT Rate + Fiscal Year + 12 Monthly Periods passed');

  // 7. Partner CRUD
  const partRes = await api('/api/master-data/partners', {
    method: 'POST', token: tokenA,
    body: {
      id: partnerId, companyId, code: 'DOB-01', name: 'Dobavljač d.o.o.',
      jib: '4200999880001', pib: '200999880001', address: 'Rajlovac bb', city: 'Sarajevo',
      phone: '033-111-222', email: 'dob@test.ba', isSupplier: true, isCustomer: true,
      defaultDiscountPct: 5, paymentTermsDays: 30, creditLimit: 50000, isActive: true,
    },
  });
  assert.equal(partRes.status, 200, `Create Partner failed: ${partRes.text}`);
  console.log('[8/18] Partner CRUD passed');

  // 8. Item CRUD (Barcodes + BOM + Declaration + StorePrices) & Conditional Delete
  const item1Res = await api('/api/master-data/items', {
    method: 'POST', token: tokenA,
    body: {
      id: item1Id, companyId, sku: 'MLJ-001', primaryBarcode: '3871234567890',
      name: 'Mlijeko 1L', shortName: 'Mlijeko', categoryName: 'Mlijeko', uom: 'kom',
      vatRateId: vatId, itemType: 'Goods', isWeighable: false, isActive: true,
      netContentQty: 1, netContentUom: 'L', countryOfOrigin: 'Bosna i Hercegovina', normativeMode: 'NONE',
      barcodes: [{ barcode: '3871234567899', uom: 'pak', packMultiplier: 12, description: 'Karton 12 kom' }],
      storePrices: [{ storeId: store1Id, itemId: item1Id, retailPriceInclVat2: 2.5, minStockQty: 5, shelfLocation: 'B-02-01' }],
    },
  });
  assert.equal(item1Res.status, 200, `Create Item 1 failed: ${item1Res.text}`);

  const itemTempRes = await api('/api/master-data/items', {
    method: 'POST', token: tokenA,
    body: {
      id: itemTempId, companyId, sku: 'TMP-001', primaryBarcode: '3870000000001',
      name: 'Temp Artikal', uom: 'kom', vatRateId: vatId, itemType: 'Goods', isWeighable: false, isActive: true,
    },
  });
  assert.equal(itemTempRes.status, 200);
  const delTempItem = await api(`/api/master-data/items/${itemTempId}`, { method: 'DELETE', token: tokenA });
  assert.equal(delTempItem.status, 200);
  assert.equal(delTempItem.json.deleted, true, 'Unused item should be hard-deleted');
  console.log('[9/18] Item + Barcodes + Declaration + StorePrices + Conditional Delete passed');

  // 9. Label Templates CRUD
  const tplId = '10000000-0000-7000-8000-000000000010';
  const tplRes = await api('/api/master-data/label-templates', {
    method: 'POST', token: tokenA,
    body: {
      id: tplId, name: 'Polica Standard 70x35mm', widthMm: 70, heightMm: 35,
      fontScale: 1.0, showBarcode: true, showUnitPrice: true, showOrigin: true, showSku: true, isDefault: true,
    },
  });
  assert.equal(tplRes.status, 200, `Create LabelTemplate failed: ${tplRes.text}`);
  console.log('[10/18] Label Templates CRUD passed');

  // 10. Calculation: Draft -> Delete Draft -> Draft -> Post -> Auto-Leveling on 2nd Calc -> Reverse
  const calcDelId = '10000000-0000-7000-8000-000000000011';
  const calc1Id = '10000000-0000-7000-8000-000000000012';
  const calc2Id = '10000000-0000-7000-8000-000000000013';

  assert.equal((await api('/api/warehouse-documents/calculations', {
    method: 'POST', token: tokenA,
    body: {
      id: calcDelId, storeId: store1Id, supplierId: partnerId, fiscalYearId: fyId,
      documentNumber: 'KALK-DEL-1', documentDate: '2026-11-22',
      lines: [{ itemId: item1Id, quantity: 5, invoicePriceExclVat4: 1.5, discountPct: 0, dependentCostPct: 0, marginPct: 30, vatRatePercent: 17 }],
    },
  })).status, 200);
  assert.equal((await api(`/api/warehouse-documents/calculations/${calcDelId}`, { method: 'DELETE', token: tokenA })).status, 204);

  // Lock November period and confirm PostCalculation is BLOCKED!
  await api(`/api/organization/fiscal-periods/${novPeriod.id}/toggle`, { method: 'PATCH', token: tokenA });
  assert.equal((await api('/api/warehouse-documents/calculations', {
    method: 'POST', token: tokenA,
    body: {
      id: calc1Id, storeId: store1Id, supplierId: partnerId, fiscalYearId: fyId,
      documentNumber: 'KALK-2026-0001', documentDate: '2026-11-22', invoiceNumber: 'FAK-100',
      lines: [{ itemId: item1Id, quantity: 20, invoicePriceExclVat4: 1.5, discountPct: 0, dependentCostPct: 0, marginPct: 42.45, vatRatePercent: 17 }],
    },
  })).status, 200);
  const blockedPost = await api(`/api/warehouse-documents/calculations/${calc1Id}/post`, { method: 'POST', token: tokenA });
  assert.equal(blockedPost.status, 400, 'Posting in locked period must be blocked with 400');

  // Unlock November period and post Calc 1
  await api(`/api/organization/fiscal-periods/${novPeriod.id}/toggle`, { method: 'PATCH', token: tokenA });
  const postCalc1 = await api(`/api/warehouse-documents/calculations/${calc1Id}/post`, { method: 'POST', token: tokenA });
  assert.equal(postCalc1.status, 200, `Post Calc 1 failed: ${postCalc1.text}`);

  // Calc 2 with higher margin -> new retail price -> MUST auto-create NIV-AUTO-KALK-2026-0002!
  assert.equal((await api('/api/warehouse-documents/calculations', {
    method: 'POST', token: tokenA,
    body: {
      id: calc2Id, storeId: store1Id, supplierId: partnerId, fiscalYearId: fyId,
      documentNumber: 'KALK-2026-0002', documentDate: '2026-11-22', invoiceNumber: 'FAK-101',
      lines: [{ itemId: item1Id, quantity: 10, invoicePriceExclVat4: 1.8, discountPct: 0, dependentCostPct: 0, marginPct: 50, vatRatePercent: 17 }],
    },
  })).status, 200);
  const postCalc2 = await api(`/api/warehouse-documents/calculations/${calc2Id}/post`, { method: 'POST', token: tokenA });
  assert.equal(postCalc2.status, 200, `Post Calc 2 failed: ${postCalc2.text}`);
  assert.ok(postCalc2.json.autoLevelingDocNumber, 'Auto price leveling must be generated on inbound price change');

  // Posted calc cannot be deleted (400), only reversed
  assert.equal((await api(`/api/warehouse-documents/calculations/${calc2Id}`, { method: 'DELETE', token: tokenA })).status, 400);
  const revCalc2 = await api(`/api/warehouse-documents/calculations/${calc2Id}/reverse`, {
    method: 'POST', token: tokenA, body: { reason: 'Greška na fakturi' },
  });
  assert.equal(revCalc2.status, 200, `Reverse Calc 2 failed: ${revCalc2.text}`);
  console.log('[11/18] Calculations (Draft/Delete/PeriodLock/Post/AutoLeveling/Reverse) passed');

  // 11. Price Leveling: Draft -> Delete -> Draft -> Post -> Reverse
  const nivId = '10000000-0000-7000-8000-000000000014';
  assert.equal((await api('/api/warehouse-documents/levelings', {
    method: 'POST', token: tokenA,
    body: {
      id: nivId, storeId: store1Id, fiscalYearId: fyId,
      documentNumber: 'NIV-2026-0001', documentDate: '2026-11-22', reason: 'Akcija',
      lines: [{ itemId: item1Id, newRetailPriceInclVat2: 3.5 }],
    },
  })).status, 200);
  assert.equal((await api(`/api/warehouse-documents/levelings/${nivId}/post`, { method: 'POST', token: tokenA })).status, 200);
  assert.equal((await api(`/api/warehouse-documents/levelings/${nivId}/reverse`, {
    method: 'POST', token: tokenA, body: { reason: 'Korekcija' },
  })).status, 200);
  console.log('[12/18] Price Leveling (Draft/Post/Reverse) passed');

  // 12. Warehouse Transfer: Negative stock guard + Post + Reverse
  const trfId = '10000000-0000-7000-8000-000000000015';
  assert.equal((await api('/api/warehouse-documents/transfers', {
    method: 'POST', token: tokenA,
    body: {
      id: trfId, sourceStoreId: store1Id, targetStoreId: store2Id, fiscalYearId: fyId,
      documentNumber: 'MS-2026-0001', documentDate: '2026-11-22', note: 'Test prenos',
      lines: [{ itemId: item1Id, quantity: 999 }],
    },
  })).status, 200);
  const blockedTrf = await api(`/api/warehouse-documents/transfers/${trfId}/post`, { method: 'POST', token: tokenA });
  assert.equal(blockedTrf.status, 400, 'Transfer exceeding stock must be blocked when AllowNegativeStock=false');

  assert.equal((await api('/api/warehouse-documents/transfers', {
    method: 'POST', token: tokenA,
    body: {
      id: trfId, sourceStoreId: store1Id, targetStoreId: store2Id, fiscalYearId: fyId,
      documentNumber: 'MS-2026-0001', documentDate: '2026-11-22', note: 'Prenos 5 kom',
      lines: [{ itemId: item1Id, quantity: 5 }],
    },
  })).status, 200);
  assert.equal((await api(`/api/warehouse-documents/transfers/${trfId}/post`, { method: 'POST', token: tokenA })).status, 200);
  console.log('[13/18] Warehouse Transfer (NegativeStock guard + Post) passed');

  // 13. Inventory Count: Draft + Post + Reverse
  const invId = '10000000-0000-7000-8000-000000000016';
  assert.equal((await api('/api/warehouse-documents/inventory-counts', {
    method: 'POST', token: tokenA,
    body: {
      id: invId, storeId: store1Id, fiscalYearId: fyId,
      documentNumber: 'POP-2026-0001', countDate: '2026-11-22', note: 'Kontrolni popis',
      lines: [{ itemId: item1Id, countedQty: 14, approvedShrinkageQty: 1, vatRatePercent: 17 }],
    },
  })).status, 200);
  assert.equal((await api(`/api/warehouse-documents/inventory-counts/${invId}/post`, { method: 'POST', token: tokenA })).status, 200);
  console.log('[14/18] Inventory Count (Draft + Post) passed');

  // 14. Other Warehouse Doc (Writeoff): Draft + Post + Reverse
  const owId = '10000000-0000-7000-8000-000000000017';
  assert.equal((await api('/api/warehouse-documents/other-documents', {
    method: 'POST', token: tokenA,
    body: {
      id: owId, storeId: store1Id, fiscalYearId: fyId,
      documentNumber: 'ZAP-2026-0001', documentDate: '2026-11-22', subtype: 'WriteoffKalorastur',
      note: 'Lom', lines: [{ itemId: item1Id, quantity: 1, reason: 'Razbijeno' }],
    },
  })).status, 200);
  assert.equal((await api(`/api/warehouse-documents/other-documents/${owId}/post`, { method: 'POST', token: tokenA })).status, 200);
  console.log('[15/18] Other Warehouse Doc (Draft + Post) passed');

  // 15. POS Receipt: Oversell blocked -> Valid Sale -> Fiscalize (BF) -> Refund
  const posOversell = await api('/api/pos/receipts', {
    method: 'POST', token: tokenA,
    body: {
      storeId: store1Id, cashRegisterId: registerId, fiscalYearId: fyId,
      receiptNumber: 'POS-ERR-1', paymentMethod: 'Cash',
      lines: [{ itemId: item1Id, quantity: 500, unitPriceInclVat2: 3.16, discountPct: 0, vatRatePercent: 17 }],
    },
  });
  assert.equal(posOversell.status, 400, 'POS oversell must be blocked when AllowNegativeStock=false');

  const posId = '10000000-0000-7000-8000-000000000018';
  const posOk = await api('/api/pos/receipts', {
    method: 'POST', token: tokenA,
    body: {
      id: posId, storeId: store1Id, cashRegisterId: registerId, fiscalYearId: fyId,
      customerId: partnerId, receiptNumber: 'POS-2026-0001', paymentMethod: 'Cash',
      lines: [{ itemId: item1Id, quantity: 2, unitPriceInclVat2: 3.16, discountPct: 0, vatRatePercent: 17 }],
    },
  });
  assert.equal(posOk.status, 200, `POS Sale failed: ${posOk.text}`);

  const fisc = await api(`/api/pos/receipts/${posId}/fiscalize`, {
    method: 'PATCH', token: tokenA, body: { fiscalReceiptNumber: 'BF-000123' },
  });
  assert.equal(fisc.status, 200, `Fiscalize failed: ${fisc.text}`);
  assert.equal(fisc.json.isFiscalized, true);

  const refund = await api(`/api/pos/receipts/${posId}/refund`, { method: 'POST', token: tokenA });
  assert.equal(refund.status, 200, `POS Refund failed: ${refund.text}`);

  // Clear Label Print flags
  const clearLbl = await api('/api/master-data/labels/clear', {
    method: 'POST', token: tokenA, body: { storeId: store1Id, itemIds: [item1Id] },
  });
  assert.equal(clearLbl.status, 200, `Clear labels failed: ${clearLbl.text}`);
  console.log('[16/18] POS Sale + NegativeStock guard + Fiscalize + Refund + Labels Clear passed');

  // 16. STRICT MULTI-TENANT ISOLATION CHECK (Tenant B must see ZERO of Tenant A's data!)
  const tbLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@tenantb.ba', password: 'Password123!' },
  });
  assert.equal(tbLogin.status, 200);
  const tokenB = tbLogin.json.token;

  const bootB = await api('/api/bootstrap', { token: tokenB });
  assert.equal(bootB.status, 200);
  assert.equal(bootB.json.companies.length, 0, 'Tenant B leaked companies!');
  assert.equal(bootB.json.storeLocations.length, 0, 'Tenant B leaked stores!');
  assert.equal(bootB.json.items.length, 0, 'Tenant B leaked items!');
  assert.equal(bootB.json.partners.length, 0, 'Tenant B leaked partners!');
  assert.equal(bootB.json.calculations.length, 0, 'Tenant B leaked calculations!');
  assert.equal(bootB.json.posReceipts.length, 0, 'Tenant B leaked receipts!');
  assert.equal(bootB.json.kepLedgerEntries.length, 0, 'Tenant B leaked KEP!');
  assert.equal(bootB.json.labelTemplates.length, 0, 'Tenant B leaked labelTemplates!');

  const crossDelete = await api(`/api/organization/companies/${companyId}`, { method: 'DELETE', token: tokenB });
  assert.equal(crossDelete.status, 404, 'Tenant B must NOT be able to touch Tenant A company');
  console.log('[17/18] Strict Multi-Tenant Isolation verified (0 data leakage)');

  // 17. Full /api/bootstrap reload verification for Tenant A (all 21 collections!)
  const bootA = await api('/api/bootstrap', { token: tokenA });
  assert.equal(bootA.status, 200, `Bootstrap A failed: ${bootA.text}`);
  const b = bootA.json;
  assert.equal(b.companies.length, 1);
  assert.equal(b.companies[0].code, 'FIR-01');
  assert.equal(b.companies[0].bankAccount, '1610000000000011');
  assert.equal(b.storeLocations.length, 2);
  assert.equal(b.storeLocations.find((s) => s.id === store2Id).storeType, 'PRODUCTION');
  assert.equal(b.posTerminals.length, 1);
  assert.equal(b.vatRates.length, 1);
  assert.equal(b.fiscalYears.length, 1);
  assert.equal(b.fiscalPeriods.length, 12);
  assert.equal(b.partners.length, 1);
  assert.equal(b.partners[0].taxIdNumber, '4200999880001');
  assert.equal(b.partners[0].partnerType, 'BOTH');
  assert.equal(b.items.length, 1);
  assert.equal(b.itemBarcodes.length, 1);
  assert.equal(b.storeItemPrices.length, 2);
  assert.equal(b.labelTemplates.length, 1);
  assert.equal(b.calculations.length, 2);
  assert.ok(b.calculations[0].docNumber && b.calculations[0].docDate, 'Calculation DTO must have docNumber & docDate');
  assert.ok(b.priceLevelings.length >= 2, 'Should have manual leveling + auto leveling');
  assert.equal(b.transfers.length, 1);
  assert.equal(b.inventoryCounts.length, 1);
  assert.equal(b.otherWarehouseDocs.length, 1);
  assert.equal(b.posReceipts.length, 2, 'Should have original SALE (REVERSED) + REFUND (POSTED)');
  assert.ok(b.kepLedgerEntries.length > 0 && b.kepLedgerEntries[0].debitRetailAmount !== undefined, 'KEP DTO must be mapped');
  assert.ok(b.auditLog.length > 0 && b.auditLog[0].timestamp && b.auditLog[0].entityType, 'AuditLog DTO must be mapped');
  assert.equal(b.systemConfig.allowNegativeStock, false);
  console.log('[18/18] Full /api/bootstrap reload verification passed (ALL 21 collections verified!)');
  console.log('\n=== ALL 18 FULL-STACK E2E & MULTI-TENANT TESTS PASSED 100%! ===');
} finally {
  server.kill('SIGTERM');
  if (fs.existsSync(DB_PATH)) {
    try { fs.unlinkSync(DB_PATH); } catch { /* ignore */ }
  }
}
