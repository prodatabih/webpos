const { getDb, provisionTenantDefaults } = require('../../database/db');
const { generateId, hashPassword, generateTempPassword } = require('../utils/crypto');

function requireSuperAdmin(auth) {
  if (!auth || auth.user.role !== 'SUPER_ADMIN') {
    return { status: 403, data: { error: 'Pristup dozvoljen samo Super Administratoru sistema.' } };
  }
  return null;
}

function getSuperAdminOverview(auth) {
  const err = requireSuperAdmin(auth);
  if (err) return err;

  const db = getDb();
  const tenants = db.prepare(`SELECT * FROM tenants ORDER BY created_at DESC`).all();

  const enrichedTenants = tenants.map(t => {
    const fiscalYears = db.prepare(`SELECT year, label, is_active, is_closed FROM fiscal_years WHERE tenant_id = ? ORDER BY year DESC`).all(t.id);
    const admins = db.prepare(`SELECT id, email, username, full_name, role, last_login_at FROM users WHERE tenant_id = ? AND role = 'TENANT_ADMIN'`).all(t.id);
    const storesCount = db.prepare(`SELECT COUNT(*) AS c FROM stores WHERE tenant_id = ?`).get(t.id).c;
    const itemsCount = db.prepare(`SELECT COUNT(*) AS c FROM items WHERE tenant_id = ?`).get(t.id).c;
    return {
      ...t,
      fiscalYears,
      admins,
      storesCount,
      itemsCount
    };
  });

  const sentEmails = db.prepare(`
    SELECT * FROM email_notifications_outbox ORDER BY created_at DESC LIMIT 30
  `).all().map(e => ({
    ...e,
    metadata: JSON.parse(e.metadata_json || '{}')
  }));

  return {
    status: 200,
    data: {
      tenants: enrichedTenants,
      sentEmails
    }
  };
}

/**
 * Super-Admin kreira novog Tenanta i šalje mu Administratorski račun
 */
function createTenantAndSendAdminAccount(auth, body) {
  const err = requireSuperAdmin(auth);
  if (err) return err;

  const db = getDb();
  const companyName = String(body.companyName || '').trim();
  const taxNumber = String(body.taxNumber || '').trim();
  const vatNumber = String(body.vatNumber || '').trim();
  const city = String(body.city || 'Sarajevo').trim();
  const address = String(body.address || '').trim();
  const subscriptionPlan = String(body.subscriptionPlan || 'ENTERPRISE').trim();
  const initialFiscalYear = Number(body.initialFiscalYear || 2026);

  const adminFullName = String(body.adminFullName || '').trim();
  const adminEmail = String(body.adminEmail || '').trim().toLowerCase();
  const adminUsername = String(body.adminUsername || adminEmail.split('@')[0] || '').trim().toLowerCase();
  const rawAdminPassword = String(body.adminPassword || '').trim() || generateTempPassword();

  if (!companyName || !taxNumber || !adminFullName || !adminEmail) {
    return {
      status: 400,
      data: { error: 'Naziv tenanta (firme), JIB/PIB, ime administratora i email administratora su obavezni.' }
    };
  }

  const existingUser = db.prepare(`SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?`).get(adminEmail, adminUsername);
  if (existingUser) {
    return {
      status: 409,
      data: { error: 'Korisnik sa tim emailom ili korisničkim imenom već postoji u bazi.' }
    };
  }

  const countTenants = db.prepare(`SELECT COUNT(*) AS c FROM tenants`).get().c;
  const tenantCode = body.tenantCode || `TEN-${String(countTenants + 1).padStart(3, '0')}`;
  const tenantId = generateId();

  db.prepare(`
    INSERT INTO tenants (id, code, name, tax_number, vat_number, address, city, contact_email, subscription_plan, status, created_by_admin_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
  `).run(tenantId, tenantCode, companyName, taxNumber, vatNumber, address, city, adminEmail, subscriptionPlan, auth.user.id);

  // Automatski kreiraj poslovne godine, početne prodajne objekte, kase i poreske stope u istoj bazi
  const defaults = provisionTenantDefaults(db, { tenantId, initialFiscalYear, city });

  // Kreiraj početni demo artikal za novog tenanta da odmah ima popunjen registar
  const defaultItemId = generateId();
  db.prepare(`
    INSERT INTO items (id, tenant_id, sku, barcode, name, item_type, normative_mode, uom, net_content_qty, net_content_uom, tax_rate_id, category_name, origin_country, importer_name)
    VALUES (?, ?, '10001', ?, 'Artikal #1 (Početni šifarnik)', 'GOODS', 'NONE', 'kom', 1.0, 'kom', ?, 'Opšta roba', 'Bosna i Hercegovina', ?)
  `).run(defaultItemId, tenantId, `387${Date.now().toString().slice(-10)}`, defaults.taxId, companyName);

  db.prepare(`
    INSERT INTO store_item_state (id, tenant_id, fiscal_year, store_id, item_id, purchase_price, wholesale_price, retail_price, stock_qty)
    VALUES (?, ?, ?, ?, ?, 5.00, 6.50, 8.50, 100)
  `).run(generateId(), tenantId, initialFiscalYear, defaults.store1Id, defaultItemId);

  // Kreiraj Administratorski nalog za Tenanta
  const adminUserId = generateId();
  db.prepare(`
    INSERT INTO users (id, tenant_id, email, username, password_hash, full_name, role, cashier_pin, must_change_password, is_active, invited_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?, 'TENANT_ADMIN', '1111', 1, 1, ?)
  `).run(adminUserId, tenantId, adminEmail, adminUsername, hashPassword(rawAdminPassword), adminFullName, auth.user.id);

  // Pošalji i zapiši email sa administratorskim računom za tenanta
  const emailSubject = `Dobrodošli na WebPOS — Vaš administratorski račun za ${companyName} (${tenantCode})`;
  const emailBody = [
    `Poštovani ${adminFullName},`,
    ``,
    `Administrator WebPOS sistema kreirao je multi-tenant poslovni prostor za Vašu kompaniju: ${companyName} (Oznaka: ${tenantCode}).`,
    `Aktivna poslovna godina: ${initialFiscalYear}.`,
    ``,
    `Vaši pristupni podaci za Administratorski nalog:`,
    `- Email / Korisničko ime: ${adminEmail} (ili ${adminUsername})`,
    `- Privremena lozinka: ${rawAdminPassword}`,
    `- Uloga: TENANT_ADMIN (Kompletan pristup registrima, objektima, kasama i dokumentima)`
  ].join('\n');

  const metadata = {
    tenantId,
    tenantCode,
    companyName,
    fiscalYear: initialFiscalYear,
    adminEmail,
    adminUsername,
    tempPassword: rawAdminPassword
  };

  db.prepare(`
    INSERT INTO email_notifications_outbox (id, tenant_id, recipient_email, recipient_name, email_type, subject, body_text, metadata_json, status)
    VALUES (?, ?, ?, ?, 'TENANT_ADMIN_CREDENTIALS', ?, ?, ?, 'SENT')
  `).run(generateId(), tenantId, adminEmail, adminFullName, emailSubject, emailBody, JSON.stringify(metadata));

  return {
    status: 201,
    data: {
      message: `Tenant "${companyName}" (${tenantCode}) je uspješno kreiran i administratorski račun je poslan na ${adminEmail}!`,
      issuedCredentials: metadata,
      emailPreview: {
        to: adminEmail,
        subject: emailSubject,
        body: emailBody
      }
    }
  };
}

/**
 * Otvaranje nove poslovne godine za postojećeg tenanta u istoj bazi (sa prenosom šifarnika i početnog stanja)
 */
function openNewFiscalYearForTenant(auth, tenantId, body) {
  const err = requireSuperAdmin(auth);
  if (err) return err;

  const db = getDb();
  const year = Number(body.year);
  if (!year || year < 2000 || year > 2100) {
    return { status: 400, data: { error: 'Unesite ispravnu poslovnu godinu (npr. 2027).' } };
  }

  const tenant = db.prepare(`SELECT * FROM tenants WHERE id = ?`).get(tenantId);
  if (!tenant) {
    return { status: 404, data: { error: 'Tenant nije pronađen.' } };
  }

  const existing = db.prepare(`SELECT id FROM fiscal_years WHERE tenant_id = ? AND year = ?`).get(tenantId, year);
  if (existing) {
    return { status: 409, data: { error: `Poslovna ${year}. godina već postoji za ovog tenanta.` } };
  }

  db.prepare(`
    INSERT INTO fiscal_years (id, tenant_id, year, label, start_date, end_date, is_active, is_closed, initial_state_transferred)
    VALUES (?, ?, ?, ?, ?, ?, 1, 0, 1)
  `).run(generateId(), tenantId, year, `Poslovna ${year}. godina`, `${year}-01-01`, `${year}-12-31`);

  // Prenesi početna stanja i cijene iz prethodne poslovne godine u novu godinu u istoj bazi
  const prevYearStates = db.prepare(`
    SELECT * FROM store_item_state WHERE tenant_id = ? AND fiscal_year = ?
  `).all(tenantId, year - 1);

  for (const st of prevYearStates) {
    db.prepare(`
      INSERT OR IGNORE INTO store_item_state
      (id, tenant_id, fiscal_year, store_id, item_id, purchase_price, wholesale_price, retail_price, promo_price, lowest_price_30d, initial_stock_qty, stock_qty)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      generateId(),
      tenantId,
      year,
      st.store_id,
      st.item_id,
      st.purchase_price,
      st.wholesale_price,
      st.retail_price,
      st.promo_price,
      st.lowest_price_30d,
      st.stock_qty,
      st.stock_qty
    );
  }

  return {
    status: 201,
    data: {
      message: `Otvorena je Poslovna ${year}. godina za tenanta ${tenant.name} sa prenesenim početnim stanjem zaliha i cjenovnika!`
    }
  };
}

module.exports = {
  getSuperAdminOverview,
  createTenantAndSendAdminAccount,
  openNewFiscalYearForTenant
};
