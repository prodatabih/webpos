const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { generateId, hashPassword } = require('../src/utils/crypto');
const { seedCatalogPartners, seedCatalogItems } = require('./seedCatalog');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = process.env.WEBPOS_DB_PATH || path.join(DATA_DIR, 'webpos.db');
const SCHEMA_PATH = path.join(__dirname, 'schema_sqlite.sql');

let dbInstance = null;

function getDb() {
  if (dbInstance) return dbInstance;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  dbInstance = new DatabaseSync(DB_PATH);
  const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  dbInstance.exec(schemaSql);
  seedInitialData(dbInstance);
  return dbInstance;
}

/**
 * Automatski kreira početno okruženje za novog Tenanta (poslovne godine, početni objekat, kasu, poreske stope)
 */
function provisionTenantDefaults(db, { tenantId, initialFiscalYear = 2026, city = 'Sarajevo' }) {
  const fyId = generateId();
  db.prepare(`INSERT OR IGNORE INTO fiscal_years (id, tenant_id, year, label, start_date, end_date, is_active, is_closed) VALUES (?, ?, ?, ?, ?, ?, 1, 0)`).run(fyId, tenantId, initialFiscalYear, `Poslovna ${initialFiscalYear}. godina`, `${initialFiscalYear}-01-01`, `${initialFiscalYear}-12-31`);

  const prevYear = initialFiscalYear - 1;
  db.prepare(`INSERT OR IGNORE INTO fiscal_years (id, tenant_id, year, label, start_date, end_date, is_active, is_closed) VALUES (?, ?, ?, ?, ?, ?, 0, 1)`).run(generateId(), tenantId, prevYear, `Poslovna ${prevYear}. godina (Arhiva)`, `${prevYear}-01-01`, `${prevYear}-12-31`);

  const taxId = generateId();
  db.prepare(`INSERT OR IGNORE INTO tax_rates (id, tenant_id, code, name, rate_pct, is_default) VALUES (?, ?, 'E', 'Opšta stopa PDV 17%', 17.0, 1)`).run(taxId, tenantId);

  const store1Id = generateId();
  const store2Id = generateId();
  db.prepare(`INSERT OR IGNORE INTO stores (id, tenant_id, code, name, store_type, city, manager_name) VALUES (?, ?, 'PJ-01', ?, 'RETAIL', ?, 'Glavni poslovođa')`).run(store1Id, tenantId, `Market 1 (${city})`, city);
  db.prepare(`INSERT OR IGNORE INTO stores (id, tenant_id, code, name, store_type, city, manager_name) VALUES (?, ?, 'VP-01', ?, 'WHOLESALE', ?, 'Voditelj magacina')`).run(store2Id, tenantId, `Centralni Magacin (${city})`, city);

  db.prepare(`INSERT OR IGNORE INTO pos_terminals (id, tenant_id, store_id, code, name) VALUES (?, ?, ?, 'K1', 'Kasa #1 (Glavna)')`).run(generateId(), tenantId, store1Id);
  db.prepare(`INSERT OR IGNORE INTO pos_terminals (id, tenant_id, store_id, code, name) VALUES (?, ?, ?, 'K2', 'Kasa #2 (Brza traka)')`).run(generateId(), tenantId, store1Id);

  return { store1Id, store2Id, taxId };
}

function seedInitialData(db) {
  const existingAdmin = db.prepare(`SELECT id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1`).get();
  if (existingAdmin) return;

  // 1. Kreiraj Globalnog SUPER_ADMIN korisnika (Vlasnik sistema koji kreira tenante i šalje im admin naloge)
  const superAdminId = generateId();
  db.prepare(`
    INSERT INTO users (id, tenant_id, email, username, password_hash, full_name, role, must_change_password, is_active)
    VALUES (?, NULL, 'superadmin@webpos.ba', 'superadmin', ?, 'Sistemski Super Administrator', 'SUPER_ADMIN', 0, 1)
  `).run(superAdminId, hashPassword('Admin123!'));

  // 2. Kreiraj Tenant 1: Marketi Bosna d.o.o. (sa 2 poslovne godine: 2025 i 2026 i 3 prodajna objekta)
  const tenant1Id = generateId();
  db.prepare(`
    INSERT INTO tenants (id, code, name, tax_number, vat_number, address, city, contact_email, contact_phone, subscription_plan, status, created_by_admin_id)
    VALUES (?, 'TEN-001', 'Marketi Bosna d.o.o.', '4200112230001', '200112230001', 'Zmaja od Bosne 14', 'Sarajevo', 'admin@marketibosna.ba', '+387 33 221 100', 'ENTERPRISE', 'ACTIVE', ?)
  `).run(tenant1Id, superAdminId);

  // Poslovne godine za Tenant 1 (2025 i 2026 u istoj bazi)
  db.prepare(`
    INSERT INTO fiscal_years (id, tenant_id, year, label, start_date, end_date, is_active, is_closed, initial_state_transferred)
    VALUES (?, ?, 2025, 'Poslovna 2025. godina (Zaključena)', '2025-01-01', '2025-12-31', 0, 1, 1)
  `).run(generateId(), tenant1Id);

  db.prepare(`
    INSERT INTO fiscal_years (id, tenant_id, year, label, start_date, end_date, is_active, is_closed, initial_state_transferred)
    VALUES (?, ?, 2026, 'Poslovna 2026. godina (Aktivna)', '2026-01-01', '2026-12-31', 1, 0, 1)
  `).run(generateId(), tenant1Id);

  // Administrator Tenanta 1
  const tenant1AdminId = generateId();
  db.prepare(`
    INSERT INTO users (id, tenant_id, email, username, password_hash, full_name, role, cashier_pin, must_change_password, is_active, invited_by_user_id)
    VALUES (?, ?, 'admin@marketibosna.ba', 'admin.bosna', ?, 'Amir Hadžić (Admin Tenanta)', 'TENANT_ADMIN', '1111', 0, 1, ?)
  `).run(tenant1AdminId, tenant1Id, hashPassword('Bosna2026!'), superAdminId);

  // Dodatni operater na kasi za Tenant 1
  db.prepare(`
    INSERT INTO users (id, tenant_id, email, username, password_hash, full_name, role, cashier_pin, must_change_password, is_active, invited_by_user_id)
    VALUES (?, ?, 'kasir1@marketibosna.ba', 'maja.kasir', ?, 'Maja Kovačević (Kasir #1)', 'CASHIER', '2222', 0, 1, ?)
  `).run(generateId(), tenant1Id, hashPassword('Kasir2026!'), tenant1AdminId);

  // Evidentiraj poslani email sa administratorskim računom u email_notifications_outbox
  db.prepare(`
    INSERT INTO email_notifications_outbox (id, tenant_id, recipient_email, recipient_name, email_type, subject, body_text, metadata_json, status)
    VALUES (?, ?, 'admin@marketibosna.ba', 'Amir Hadžić', 'TENANT_ADMIN_CREDENTIALS',
      'Dobrodošli na WebPOS — Vaš administratorski račun za Marketi Bosna d.o.o.',
      'Poštovani, kreiran je Vaš multi-tenant prostor Marketi Bosna d.o.o. (TEN-001). Prijavite se sa emailom admin@marketibosna.ba i lozinkom Bosna2026!',
      ?, 'SENT')
  `).run(generateId(), tenant1Id, JSON.stringify({ tenantCode: 'TEN-001', username: 'admin.bosna', tempPassword: 'Bosna2026!' }));

  // Prodajni objekti za Tenant 1
  const st1Id = generateId();
  const st2Id = generateId();
  const st3Id = generateId();
  db.prepare(`INSERT INTO stores (id, tenant_id, code, name, store_type, city, manager_name) VALUES (?, ?, 'PJ-01', 'PJ-01 · Market Centar (Sarajevo)', 'RETAIL', 'Sarajevo', 'Haris B.')`).run(st1Id, tenant1Id);
  db.prepare(`INSERT INTO stores (id, tenant_id, code, name, store_type, city, manager_name) VALUES (?, ?, 'PJ-02', 'PJ-02 · Hipermarket Novi Grad', 'RETAIL', 'Sarajevo', 'Lejla M.')`).run(st2Id, tenant1Id);
  db.prepare(`INSERT INTO stores (id, tenant_id, code, name, store_type, city, manager_name) VALUES (?, ?, 'PJ-03', 'PJ-03 · Centralni Magacin (VP)', 'WHOLESALE', 'Sarajevo', 'Senad K.')`).run(st3Id, tenant1Id);

  // Kase za Tenant 1
  const term1Id = generateId();
  const term2Id = generateId();
  db.prepare(`INSERT INTO pos_terminals (id, tenant_id, store_id, code, name, last_receipt_seq) VALUES (?, ?, ?, 'K1', 'Kasa #1 (Brza traka)', 1428)`).run(term1Id, tenant1Id, st1Id);
  db.prepare(`INSERT INTO pos_terminals (id, tenant_id, store_id, code, name, last_receipt_seq) VALUES (?, ?, ?, 'K2', 'Kasa #2 (Glavni izlaz)', 891)`).run(term2Id, tenant1Id, st1Id);
  db.prepare(`INSERT INTO pos_terminals (id, tenant_id, store_id, code, name, last_receipt_seq) VALUES (?, ?, ?, 'K1', 'Kasa #1 (Hipermarket)', 510)`).run(generateId(), tenant1Id, st2Id);

  // Poreska stopa
  const tax17Id = generateId();
  db.prepare(`INSERT INTO tax_rates (id, tenant_id, code, name, rate_pct, is_default) VALUES (?, ?, 'E', 'PDV 17%', 17.0, 1)`).run(tax17Id, tenant1Id);

  // Partneri za Tenant 1
  let p1Id = null;
  let p2Id = null;
  const insertPartnerStmt = db.prepare(`
    INSERT INTO partners (id, tenant_id, code, name, partner_type, tax_number, vat_number, city, payment_due_days)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const p of seedCatalogPartners) {
    const pid = generateId();
    if (p.code === 'DOB-002') p1Id = pid;
    if (p.code === 'DOB-004') p2Id = pid;
    insertPartnerStmt.run(pid, tenant1Id, p.code, p.name, p.partnerType, p.taxNumber, p.vatNumber, p.city, p.paymentDays);
  }

  // Artikli za Tenant 1 (115 artikala)
  const insertItemStmt = db.prepare(`
    INSERT INTO items (id, tenant_id, sku, barcode, name, item_type, normative_mode, uom, net_content_qty, net_content_uom, tax_rate_id, category_name, origin_country, importer_name, is_weighable, pack_multiplier)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertStateStmt = db.prepare(`
    INSERT INTO store_item_state (id, tenant_id, fiscal_year, store_id, item_id, purchase_price, wholesale_price, retail_price, lowest_price_30d, stock_qty)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const it of seedCatalogItems) {
    const itemId = generateId();
    insertItemStmt.run(
      itemId,
      tenant1Id,
      it.sku,
      it.barcode,
      it.name,
      it.norm !== 'NONE' ? 'COMPOSITE' : (it.uom === 'kg' && it.isWeighable ? 'GOODS' : 'GOODS'),
      it.norm,
      it.uom,
      it.netQty,
      it.netUom,
      tax17Id,
      it.cat,
      it.origin,
      it.imp,
      it.uom === 'kg' ? 1 : 0,
      it.pack
    );

    // Stanje i cijene za Poslovnu 2026. godinu po objektima (PJ-01, PJ-02, PJ-03)
    insertStateStmt.run(generateId(), tenant1Id, 2026, st1Id, itemId, it.nc, it.p3, it.p1, it.p1 - 0.30, it.s1);
    insertStateStmt.run(generateId(), tenant1Id, 2026, st2Id, itemId, it.nc, it.p3, it.p2, it.p2 - 0.20, it.s2);
    insertStateStmt.run(generateId(), tenant1Id, 2026, st3Id, itemId, it.nc, it.p3, it.p3, it.p3, it.s3);

    // Stanje i cijene za arhivsku Poslovnu 2025. godinu u istoj bazi
    insertStateStmt.run(generateId(), tenant1Id, 2025, st1Id, itemId, it.nc * 0.92, it.p3 * 0.92, Number((it.p1 * 0.92).toFixed(2)), it.p1 * 0.90, Math.round(it.s1 * 0.8));
  }


  // Dokumenti u 2026. i 2025. godini za Tenant 1
  db.prepare(`
    INSERT INTO warehouse_documents (id, tenant_id, fiscal_year, store_id, doc_type, doc_number, status, partner_id, partner_name, external_invoice_no, doc_date, total_purchase_value, total_retail_value, created_by)
    VALUES (?, ?, 2026, ?, 'CALCULATION', 'KAL-2026-0118', 'POSTED', ?, 'AS Holding / Vispak d.d. Visoko', 'VF-4491/26', '2026-11-05', 1060.50, 1500.00, ?)
  `).run(generateId(), tenant1Id, st1Id, p1Id, tenant1AdminId);

  db.prepare(`
    INSERT INTO warehouse_documents (id, tenant_id, fiscal_year, store_id, doc_type, doc_number, status, partner_id, partner_name, external_invoice_no, doc_date, total_purchase_value, total_retail_value, created_by)
    VALUES (?, ?, 2025, ?, 'CALCULATION', 'KAL-2025-0899', 'POSTED', ?, 'Bimal d.d. Brčko', 'VF-9910/25', '2025-12-18', 840.00, 1120.00, ?)
  `).run(generateId(), tenant1Id, st1Id, p2Id, tenant1AdminId);

  db.prepare(`
    INSERT INTO warehouse_documents (id, tenant_id, fiscal_year, store_id, target_store_id, doc_type, doc_number, status, doc_date, total_purchase_value, total_retail_value, notes, created_by)
    VALUES (?, ?, 2026, ?, ?, 'TRANSFER', 'MS-2026-0052', 'POSTED', '2026-11-05', 308.00, 285.50, 'Redovna prelokacija PJ-01 -> PJ-02', ?)
  `).run(generateId(), tenant1Id, st1Id, st2Id, tenant1AdminId);

  // 3. Kreiraj Tenant 2 u istoj bazi: Adriatik Trade d.o.o. Mostar
  const tenant2Id = generateId();
  db.prepare(`
    INSERT INTO tenants (id, code, name, tax_number, vat_number, address, city, contact_email, contact_phone, subscription_plan, status, created_by_admin_id)
    VALUES (?, 'TEN-002', 'Adriatik Trade d.o.o. Mostar', '4227008810004', '227008810004', 'Bulevar narodne revolucije 32', 'Mostar', 'direktor@adriatik.ba', '+387 36 551 200', 'PROFESSIONAL', 'ACTIVE', ?)
  `).run(tenant2Id, superAdminId);

  const t2Defaults = provisionTenantDefaults(db, { tenantId: tenant2Id, initialFiscalYear: 2026, city: 'Mostar' });
  const tenant2AdminId = generateId();
  db.prepare(`
    INSERT INTO users (id, tenant_id, email, username, password_hash, full_name, role, cashier_pin, must_change_password, is_active, invited_by_user_id)
    VALUES (?, ?, 'direktor@adriatik.ba', 'admin.adriatik', ?, 'Ivan Bošnjak (Admin Tenanta)', 'TENANT_ADMIN', '1111', 0, 1, ?)
  `).run(tenant2AdminId, tenant2Id, hashPassword('Adriatik2026!'), superAdminId);

  const t2Item1Id = generateId();
  db.prepare(`
    INSERT INTO items (id, tenant_id, sku, barcode, name, item_type, normative_mode, uom, net_content_qty, net_content_uom, tax_rate_id, category_name, origin_country, importer_name)
    VALUES (?, ?, '50010', '3870005001010', 'Maslinovo Ulje Extra Djevičansko 1L', 'GOODS', 'NONE', 'kom', 1.0, 'l', ?, 'Mediteranski program', 'Italija', 'Adriatik Trade d.o.o.')
  `).run(t2Item1Id, tenant2Id, t2Defaults.taxId);

  db.prepare(`
    INSERT INTO store_item_state (id, tenant_id, fiscal_year, store_id, item_id, purchase_price, wholesale_price, retail_price, stock_qty)
    VALUES (?, ?, 2026, ?, ?, 14.50, 17.80, 21.90, 65)
  `).run(generateId(), tenant2Id, t2Defaults.store1Id, t2Item1Id);

  db.prepare(`
    INSERT INTO email_notifications_outbox (id, tenant_id, recipient_email, recipient_name, email_type, subject, body_text, metadata_json, status)
    VALUES (?, ?, 'direktor@adriatik.ba', 'Ivan Bošnjak', 'TENANT_ADMIN_CREDENTIALS',
      'Dobrodošli na WebPOS — Vaš administratorski račun za Adriatik Trade d.o.o.',
      'Poštovani, kreiran je Vaš multi-tenant prostor Adriatik Trade d.o.o. (TEN-002). Prijavite se sa emailom direktor@adriatik.ba i lozinkom Adriatik2026!',
      ?, 'SENT')
  `).run(generateId(), tenant2Id, JSON.stringify({ tenantCode: 'TEN-002', username: 'admin.adriatik', tempPassword: 'Adriatik2026!' }));
}

if (require.main === module && process.argv.includes('--init')) {
  const db = getDb();
  const counts = {
    tenants: db.prepare('SELECT COUNT(*) AS c FROM tenants').get().c,
    fiscal_years: db.prepare('SELECT COUNT(*) AS c FROM fiscal_years').get().c,
    users: db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
    items: db.prepare('SELECT COUNT(*) AS c FROM items').get().c
  };
  console.log('WebPOS baza uspješno inicijalizovana:', counts);
}

module.exports = {
  getDb,
  provisionTenantDefaults
};
