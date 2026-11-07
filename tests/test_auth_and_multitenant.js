const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Koristi privremenu testnu bazu za čist testni prolaz
const testDbPath = path.join(__dirname, '..', 'data', 'test_webpos.db');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
process.env.WEBPOS_DB_PATH = testDbPath;

const { getDb } = require('../database/db');
const {
  handleLogin,
  handleForgotPassword,
  handleResetPassword,
  getAuthenticatedSession
} = require('../src/routes/auth');
const {
  getSuperAdminOverview,
  createTenantAndSendAdminAccount,
  openNewFiscalYearForTenant
} = require('../src/routes/superAdmin');
const {
  getTenantBootstrap,
  createCalculation,
  createTransfer,
  createPosReceipt
} = require('../src/routes/registries');

function runTests() {
  console.log('1. Provjera kreiranja baze i svih tabela...');
  const db = getDb();
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all().map(r => r.name);
  const requiredTables = [
    'tenants',
    'fiscal_years',
    'users',
    'password_reset_tokens',
    'email_notifications_outbox',
    'user_sessions',
    'stores',
    'pos_terminals',
    'tax_rates',
    'partners',
    'items',
    'store_item_state',
    'pos_receipts',
    'pos_receipt_items',
    'warehouse_documents',
    'warehouse_document_items'
  ];
  for (const t of requiredTables) {
    assert(tables.includes(t), `Tabela ${t} mora postojati u bazi!`);
  }
  console.log('   ✓ Sve tabele postoje u jednoj bazi:', requiredTables.length, 'ključnih tabela.');

  console.log('2. Testiranje prijave Super-Admina sistema...');
  const saLogin = handleLogin({ identifier: 'superadmin@webpos.ba', password: 'Admin123!' });
  assert.strictEqual(saLogin.status, 200);
  assert.strictEqual(saLogin.data.user.role, 'SUPER_ADMIN');
  const saAuth = getAuthenticatedSession({ headers: { authorization: `Bearer ${saLogin.data.token}` } });
  assert(saAuth, 'Super-Admin sesija mora biti validna');
  console.log('   ✓ Super-Admin uspješno prijavljen.');

  console.log('3. Testiranje: Super-Admin kreira novog Tenanta i šalje mu Administratorski račun...');
  const newTenantRes = createTenantAndSendAdminAccount(saAuth, {
    companyName: 'Konzum BH d.o.o.',
    taxNumber: '4200556670008',
    vatNumber: '200556670008',
    city: 'Sarajevo',
    adminFullName: 'Mirza Delić',
    adminEmail: 'mirza.admin@konzumbh.ba',
    initialFiscalYear: 2026
  });
  assert.strictEqual(newTenantRes.status, 201);
  const issued = newTenantRes.data.issuedCredentials;
  assert(issued.tempPassword.startsWith('WP-'), 'Privremena lozinka mora biti generisana');
  console.log(`   ✓ Kreiran Tenant ${issued.tenantCode} (${issued.companyName}) i poslan račun za ${issued.adminEmail} (lozinka: ${issued.tempPassword}).`);

  console.log('4. Testiranje prijave novog Tenant Administratora sa poslanim računom...');
  const tenantAdminLogin = handleLogin({
    identifier: issued.adminEmail,
    password: issued.tempPassword,
    fiscalYear: 2026
  });
  assert.strictEqual(tenantAdminLogin.status, 200);
  assert.strictEqual(tenantAdminLogin.data.user.role, 'TENANT_ADMIN');
  assert.strictEqual(tenantAdminLogin.data.tenant.code, issued.tenantCode);
  console.log('   ✓ Novi Tenant Administrator se uspješno prijavio sa poslanim pristupnim podacima.');

  console.log('5. Testiranje funkcije Zaboravljena lozinka (Forgot & Reset Password)...');
  const forgotRes = handleForgotPassword({ email: issued.adminEmail });
  assert.strictEqual(forgotRes.status, 200);
  const resetCode = forgotRes.data.simulatedEmailPreview.resetCode;
  assert.strictEqual(resetCode.length, 6);

  const resetRes = handleResetPassword({
    email: issued.adminEmail,
    resetCode,
    newPassword: 'NovaSigurnaLozinka2026!'
  });
  assert.strictEqual(resetRes.status, 200);

  const reLogin = handleLogin({
    identifier: issued.adminEmail,
    password: 'NovaSigurnaLozinka2026!'
  });
  assert.strictEqual(reLogin.status, 200);
  console.log('   ✓ Zaboravljena lozinka uspješno resetovana pomoću 6-cifrenog sigurnosnog koda.');

  console.log('6. Testiranje više poslovnih godina (2025, 2026, 2027) i više tenanata u istoj bazi...');
  const open2027 = openNewFiscalYearForTenant(saAuth, issued.tenantId, { year: 2027 });
  assert.strictEqual(open2027.status, 201);

  const t1Login = handleLogin({ identifier: 'admin@marketibosna.ba', password: 'Bosna2026!', fiscalYear: 2026 });
  const t1Auth = getAuthenticatedSession({ headers: { authorization: `Bearer ${t1Login.data.token}` } });

  const boot2026 = getTenantBootstrap(t1Auth, { fiscalYear: 2026 });
  const boot2025 = getTenantBootstrap(t1Auth, { fiscalYear: 2025 });
  assert.strictEqual(boot2026.data.fiscalYear, 2026);
  assert.strictEqual(boot2025.data.fiscalYear, 2025);
  assert(boot2026.data.items[0].storePrices['PJ-01'] !== boot2025.data.items[0].storePrices['PJ-01'], 'Cijene u 2026. i 2025. godini su nezavisno sačuvane u istoj bazi');

  const calcRes = createCalculation(t1Auth, {
    storeId: boot2026.data.stores[0].id,
    supplierName: 'Vispak d.d.',
    itemId: boot2026.data.items[0].id,
    qty: 25,
    purchasePrice: 7.00,
    newRetailPrice: 10.50
  });
  assert.strictEqual(calcRes.status, 201);
  assert(calcRes.data.autoLevelingNo, 'Automatska nivelacija mora biti kreirana pri promjeni MPC');

  const transferRes = createTransfer(t1Auth, {
    fromStoreId: boot2026.data.stores[0].id,
    toStoreId: boot2026.data.stores[1].id,
    itemId: boot2026.data.items[0].id,
    qty: 5
  });
  assert.strictEqual(transferRes.status, 201);

  const posRes = createPosReceipt(t1Auth, {
    storeId: boot2026.data.stores[0].id,
    terminalId: boot2026.data.terminals[0].id,
    items: [{ itemId: boot2026.data.items[0].id, qty: 2, unitPrice: 10.50 }]
  });
  assert.strictEqual(posRes.status, 201);
  console.log('   ✓ Svi testovi (Multi-Tenant, Multi-Poslovna-Godina, Zaboravljena lozinka, Kalkulacije, Prelokacije i POS Kasa) uspješno prošli!');

  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
}

runTests();
