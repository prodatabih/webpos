const { getDb } = require('../../database/db');
const { generateId } = require('../utils/crypto');

function getTenantContextOrError(auth, query = {}) {
  if (!auth) {
    return { error: { status: 401, data: { error: 'Niste prijavljeni.' } } };
  }
  const db = getDb();
  let tenantId = auth.user.tenant_id || query.tenantId;
  if (!tenantId) {
    const firstTenant = db.prepare(`SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1`).get();
    tenantId = firstTenant ? firstTenant.id : null;
  }
  if (!tenantId) {
    return { error: { status: 400, data: { error: 'Tenant nije odabran.' } } };
  }
  const fiscalYear = Number(query.fiscalYear || auth.session.fiscal_year || 2026);
  return { db, tenantId, fiscalYear };
}

function getTenantBootstrap(auth, query = {}) {
  const ctx = getTenantContextOrError(auth, query);
  if (ctx.error) return ctx.error;
  const { db, tenantId, fiscalYear } = ctx;

  const tenant = db.prepare(`SELECT * FROM tenants WHERE id = ?`).get(tenantId);
  const fiscalYears = db.prepare(`SELECT * FROM fiscal_years WHERE tenant_id = ? ORDER BY year DESC`).all(tenantId);
  const stores = db.prepare(`SELECT * FROM stores WHERE tenant_id = ? AND is_active = 1 ORDER BY code ASC`).all(tenantId);
  const terminals = db.prepare(`SELECT * FROM pos_terminals WHERE tenant_id = ? AND is_active = 1 ORDER BY code ASC`).all(tenantId);
  const partners = db.prepare(`SELECT * FROM partners WHERE tenant_id = ? ORDER BY code ASC`).all(tenantId);
  const itemsRaw = db.prepare(`SELECT * FROM items WHERE tenant_id = ? AND is_active = 1 ORDER BY sku ASC`).all(tenantId);
  const statesRaw = db.prepare(`SELECT * FROM store_item_state WHERE tenant_id = ? AND fiscal_year = ?`).all(tenantId, fiscalYear);

  const items = itemsRaw.map(it => {
    const storePrices = {};
    const storeStocks = {};
    let purchasePrice = 0;

    for (const st of stores) {
      const state = statesRaw.find(s => s.store_id === st.id && s.item_id === it.id);
      storePrices[st.id] = state ? state.retail_price : 0;
      storePrices[st.code] = state ? state.retail_price : 0;
      storeStocks[st.id] = state ? state.stock_qty : 0;
      storeStocks[st.code] = state ? state.stock_qty : 0;
      if (state && state.purchase_price > 0) purchasePrice = state.purchase_price;
    }

    return {
      ...it,
      purchasePrice,
      storePrices,
      storeStocks
    };
  });

  const documents = db.prepare(`
    SELECT wd.*, s1.code AS store_code, s1.name AS store_name, s2.code AS target_store_code, s2.name AS target_store_name
    FROM warehouse_documents wd
    LEFT JOIN stores s1 ON wd.store_id = s1.id
    LEFT JOIN stores s2 ON wd.target_store_id = s2.id
    WHERE wd.tenant_id = ? AND wd.fiscal_year = ?
    ORDER BY wd.created_at DESC
  `).all(tenantId, fiscalYear);

  const receipts = db.prepare(`
    SELECT * FROM pos_receipts
    WHERE tenant_id = ? AND fiscal_year = ?
    ORDER BY issued_at DESC LIMIT 30
  `).all(tenantId, fiscalYear);

  return {
    status: 200,
    data: {
      tenant,
      fiscalYear,
      fiscalYears,
      stores,
      terminals,
      partners,
      items,
      documents,
      receipts
    }
  };
}

function upsertRegistryItem(auth, body) {
  const ctx = getTenantContextOrError(auth, body);
  if (ctx.error) return ctx.error;
  const { db, tenantId, fiscalYear } = ctx;

  const sku = String(body.sku || '').trim();
  const barcode = String(body.barcode || '').trim();
  const name = String(body.name || '').trim();
  const uom = String(body.uom || 'kom').trim();
  const categoryName = String(body.categoryName || 'Opšta roba').trim();
  const originCountry = String(body.originCountry || 'Bosna i Hercegovina').trim();
  const importerName = String(body.importerName || '').trim();
  const purchasePrice = Number(body.purchasePrice || 0);
  const storePrices = body.storePrices || {};

  if (!sku || !barcode || !name) {
    return { status: 400, data: { error: 'Šifra (SKU), barkod i naziv artikla su obavezni.' } };
  }

  let itemId = body.id;
  const existing = itemId
    ? db.prepare(`SELECT * FROM items WHERE id = ? AND tenant_id = ?`).get(itemId, tenantId)
    : db.prepare(`SELECT * FROM items WHERE tenant_id = ? AND sku = ?`).get(tenantId, sku);

  if (existing) {
    itemId = existing.id;
    db.prepare(`
      UPDATE items
      SET sku = ?, barcode = ?, name = ?, uom = ?, category_name = ?, origin_country = ?, importer_name = ?, sync_version = sync_version + 1, updated_at = datetime('now')
      WHERE id = ? AND tenant_id = ?
    `).run(sku, barcode, name, uom, categoryName, originCountry, importerName, itemId, tenantId);
  } else {
    itemId = generateId();
    const taxRow = db.prepare(`SELECT id FROM tax_rates WHERE tenant_id = ? LIMIT 1`).get(tenantId);
    db.prepare(`
      INSERT INTO items (id, tenant_id, sku, barcode, name, uom, category_name, origin_country, importer_name, tax_rate_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(itemId, tenantId, sku, barcode, name, uom, categoryName, originCountry, importerName, taxRow ? taxRow.id : null);
  }

  const stores = db.prepare(`SELECT * FROM stores WHERE tenant_id = ?`).all(tenantId);
  for (const st of stores) {
    const newPrice = storePrices[st.id] !== undefined ? Number(storePrices[st.id]) : (storePrices[st.code] !== undefined ? Number(storePrices[st.code]) : 0);
    const existingState = db.prepare(`
      SELECT * FROM store_item_state WHERE tenant_id = ? AND fiscal_year = ? AND store_id = ? AND item_id = ?
    `).get(tenantId, fiscalYear, st.id, itemId);

    if (existingState) {
      db.prepare(`
        UPDATE store_item_state
        SET purchase_price = ?, retail_price = ?, sync_version = sync_version + 1, updated_at = datetime('now')
        WHERE id = ?
      `).run(purchasePrice || existingState.purchase_price, newPrice || existingState.retail_price, existingState.id);
    } else {
      db.prepare(`
        INSERT INTO store_item_state (id, tenant_id, fiscal_year, store_id, item_id, purchase_price, retail_price, stock_qty)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(generateId(), tenantId, fiscalYear, st.id, itemId, purchasePrice, newPrice, Number(body.initialStock || 0));
    }
  }

  return {
    status: 200,
    data: { message: `Artikal "${name}" sačuvan u Registru artikala za poslovnu ${fiscalYear}. godinu.`, itemId }
  };
}

function createPartner(auth, body) {
  const ctx = getTenantContextOrError(auth, body);
  if (ctx.error) return ctx.error;
  const { db, tenantId } = ctx;

  const code = String(body.code || '').trim();
  const name = String(body.name || '').trim();
  const taxNumber = String(body.taxNumber || '').trim();
  const vatNumber = String(body.vatNumber || '').trim();
  const partnerType = String(body.partnerType || 'BOTH').trim();
  const city = String(body.city || 'Sarajevo').trim();

  if (!code || !name || !taxNumber) {
    return { status: 400, data: { error: 'Šifra, naziv partnera i JIB/PIB su obavezni.' } };
  }

  const partnerId = generateId();
  db.prepare(`
    INSERT INTO partners (id, tenant_id, code, name, partner_type, tax_number, vat_number, city)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(partnerId, tenantId, code, name, partnerType, taxNumber, vatNumber, city);

  return {
    status: 201,
    data: { message: `Partner "${name}" je dodan u Registar partnera.` }
  };
}

function createCalculation(auth, body) {
  const ctx = getTenantContextOrError(auth, body);
  if (ctx.error) return ctx.error;
  const { db, tenantId, fiscalYear } = ctx;

  const storeId = body.storeId;
  const supplierName = String(body.supplierName || 'Dobavljač').trim();
  const externalInvoiceNo = String(body.externalInvoiceNo || 'UF-001').trim();
  const itemId = body.itemId;
  const qty = Number(body.qty || 0);
  const purchasePrice = Number(body.purchasePrice || 0);
  const newRetailPrice = Number(body.newRetailPrice || 0);

  if (!storeId || !itemId || qty <= 0) {
    return { status: 400, data: { error: 'Odaberite prodajni objekat, artikal i količinu veću od 0.' } };
  }

  const countCalc = db.prepare(`SELECT COUNT(*) AS c FROM warehouse_documents WHERE tenant_id = ? AND fiscal_year = ? AND doc_type = 'CALCULATION'`).get(tenantId, fiscalYear).c;
  const docNumber = `KAL-${fiscalYear}-${String(countCalc + 1).padStart(4, '0')}`;
  const docId = generateId();

  const state = db.prepare(`
    SELECT * FROM store_item_state WHERE tenant_id = ? AND fiscal_year = ? AND store_id = ? AND item_id = ?
  `).get(tenantId, fiscalYear, storeId, itemId);

  const oldPrice = state ? state.retail_price : newRetailPrice;
  const oldStock = state ? state.stock_qty : 0;

  if (state) {
    db.prepare(`
      UPDATE store_item_state
      SET stock_qty = stock_qty + ?, purchase_price = ?, retail_price = ?, needs_label_print = 1, updated_at = datetime('now')
      WHERE id = ?
    `).run(qty, purchasePrice || state.purchase_price, newRetailPrice, state.id);
  } else {
    db.prepare(`
      INSERT INTO store_item_state (id, tenant_id, fiscal_year, store_id, item_id, purchase_price, retail_price, stock_qty, needs_label_print)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(generateId(), tenantId, fiscalYear, storeId, itemId, purchasePrice, newRetailPrice, qty);
  }

  db.prepare(`
    INSERT INTO warehouse_documents (id, tenant_id, fiscal_year, store_id, doc_type, doc_number, status, partner_name, external_invoice_no, doc_date, total_purchase_value, total_retail_value, created_by)
    VALUES (?, ?, ?, ?, 'CALCULATION', ?, 'POSTED', ?, ?, date('now'), ?, ?, ?)
  `).run(docId, tenantId, fiscalYear, storeId, docNumber, supplierName, externalInvoiceNo, purchasePrice * qty, newRetailPrice * qty, auth.user.id);

  // Automatska nivelacija ako se MPC promijenila na zatečenu zalihu
  let autoLevelingNo = null;
  if (Math.abs(newRetailPrice - oldPrice) >= 0.01 && oldStock > 0) {
    const countLvl = db.prepare(`SELECT COUNT(*) AS c FROM warehouse_documents WHERE tenant_id = ? AND fiscal_year = ? AND doc_type = 'PRICE_LEVELING'`).get(tenantId, fiscalYear).c;
    autoLevelingNo = `NIV-${fiscalYear}-${String(countLvl + 1).padStart(4, '0')}`;
    db.prepare(`
      INSERT INTO warehouse_documents (id, tenant_id, fiscal_year, store_id, doc_type, doc_number, status, doc_date, total_purchase_value, total_retail_value, notes, created_by)
      VALUES (?, ?, ?, ?, 'PRICE_LEVELING', ?, 'POSTED', date('now'), ?, ?, ?, ?)
    `).run(
      generateId(),
      tenantId,
      fiscalYear,
      storeId,
      autoLevelingNo,
      oldPrice * oldStock,
      newRetailPrice * oldStock,
      `Automatska nivelacija uz kalkulaciju ${docNumber} (${oldPrice.toFixed(2)} -> ${newRetailPrice.toFixed(2)} KM)`,
      auth.user.id
    );
  }

  return {
    status: 201,
    data: {
      message: `Proknjižena Kalkulacija ${docNumber} u poslovnoj ${fiscalYear}. godini${autoLevelingNo ? ` (automatski kreirana i Nivelacija ${autoLevelingNo})` : ''}!`,
      docNumber,
      autoLevelingNo
    }
  };
}

function createTransfer(auth, body) {
  const ctx = getTenantContextOrError(auth, body);
  if (ctx.error) return ctx.error;
  const { db, tenantId, fiscalYear } = ctx;

  const fromStoreId = body.fromStoreId;
  const toStoreId = body.toStoreId;
  const itemId = body.itemId;
  const qty = Number(body.qty || 0);

  if (!fromStoreId || !toStoreId || fromStoreId === toStoreId || !itemId || qty <= 0) {
    return { status: 400, data: { error: 'Odaberite različit objekat izlaza i ulaza, artikal i količinu.' } };
  }

  const fromState = db.prepare(`SELECT * FROM store_item_state WHERE tenant_id = ? AND fiscal_year = ? AND store_id = ? AND item_id = ?`).get(tenantId, fiscalYear, fromStoreId, itemId);
  const toState = db.prepare(`SELECT * FROM store_item_state WHERE tenant_id = ? AND fiscal_year = ? AND store_id = ? AND item_id = ?`).get(tenantId, fiscalYear, toStoreId, itemId);

  const fromPrice = fromState ? fromState.retail_price : 0;
  const toPrice = toState ? toState.retail_price : fromPrice;

  if (fromState) {
    db.prepare(`UPDATE store_item_state SET stock_qty = stock_qty - ? WHERE id = ?`).run(qty, fromState.id);
  }
  if (toState) {
    db.prepare(`UPDATE store_item_state SET stock_qty = stock_qty + ? WHERE id = ?`).run(qty, toState.id);
  } else {
    db.prepare(`
      INSERT INTO store_item_state (id, tenant_id, fiscal_year, store_id, item_id, purchase_price, retail_price, stock_qty)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(generateId(), tenantId, fiscalYear, toStoreId, itemId, fromState ? fromState.purchase_price : 0, toPrice, qty);
  }

  const countTr = db.prepare(`SELECT COUNT(*) AS c FROM warehouse_documents WHERE tenant_id = ? AND fiscal_year = ? AND doc_type = 'TRANSFER'`).get(tenantId, fiscalYear).c;
  const docNumber = `MS-${fiscalYear}-${String(countTr + 1).padStart(4, '0')}`;

  db.prepare(`
    INSERT INTO warehouse_documents (id, tenant_id, fiscal_year, store_id, target_store_id, doc_type, doc_number, status, doc_date, total_purchase_value, total_retail_value, notes, created_by)
    VALUES (?, ?, ?, ?, ?, 'TRANSFER', ?, 'POSTED', date('now'), ?, ?, ?, ?)
  `).run(
    generateId(),
    tenantId,
    fiscalYear,
    fromStoreId,
    toStoreId,
    docNumber,
    fromPrice * qty,
    toPrice * qty,
    body.notes || 'Međuskladišna prelokacija robe',
    auth.user.id
  );

  return {
    status: 201,
    data: {
      message: `Proknjižena Prelokacija ${docNumber} u poslovnoj ${fiscalYear}. godini!`,
      docNumber
    }
  };
}

function createPosReceipt(auth, body) {
  const ctx = getTenantContextOrError(auth, body);
  if (ctx.error) return ctx.error;
  const { db, tenantId, fiscalYear } = ctx;

  const storeId = body.storeId;
  const terminalId = body.terminalId;
  const lines = Array.isArray(body.items) ? body.items : [];
  if (!storeId || !terminalId || lines.length === 0) {
    return { status: 400, data: { error: 'Račun mora sadržavati bar jednu stavku.' } };
  }

  const store = db.prepare(`SELECT * FROM stores WHERE id = ? AND tenant_id = ?`).get(storeId, tenantId);
  const terminal = db.prepare(`SELECT * FROM pos_terminals WHERE id = ? AND tenant_id = ?`).get(terminalId, tenantId);
  if (!store || !terminal) {
    return { status: 404, data: { error: 'Prodajni objekat ili kasa nisu pronađeni.' } };
  }

  const nextSeq = terminal.last_receipt_seq + 1;
  db.prepare(`UPDATE pos_terminals SET last_receipt_seq = ? WHERE id = ?`).run(nextSeq, terminal.id);

  const receiptNumber = `${store.code.replace('-', '')}-${terminal.code}-${fiscalYear}-${String(nextSeq).padStart(6, '0')}`;
  const receiptId = generateId();

  let totalAmount = 0;
  for (const line of lines) {
    const qty = Number(line.qty || 1);
    const price = Number(line.unitPrice || 0);
    totalAmount += qty * price;
  }

  const subtotalNet = totalAmount / 1.17;
  const taxAmount = totalAmount - subtotalNet;

  db.prepare(`
    INSERT INTO pos_receipts (id, tenant_id, fiscal_year, store_id, terminal_id, cashier_id, terminal_seq, receipt_number, subtotal_net, tax_amount, total_amount, payment_method, fiscal_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    receiptId,
    tenantId,
    fiscalYear,
    storeId,
    terminalId,
    auth.user.id,
    nextSeq,
    receiptNumber,
    subtotalNet,
    taxAmount,
    totalAmount,
    body.paymentMethod || 'CASH',
    `BF-${90000 + nextSeq}`
  );

  for (const line of lines) {
    const qty = Number(line.qty || 1);
    const price = Number(line.unitPrice || 0);
    const sub = qty * price;

    db.prepare(`
      UPDATE store_item_state
      SET stock_qty = stock_qty - ?
      WHERE tenant_id = ? AND fiscal_year = ? AND store_id = ? AND item_id = ?
    `).run(qty, tenantId, fiscalYear, storeId, line.itemId);

    db.prepare(`
      INSERT INTO pos_receipt_items (id, receipt_id, tenant_id, item_id, quantity, unit_price, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(generateId(), receiptId, tenantId, line.itemId, qty, price, sub);
  }

  return {
    status: 201,
    data: {
      message: `Fiskalizovan račun ${receiptNumber}`,
      receiptNumber,
      totalAmount
    }
  };
}

module.exports = {
  getTenantBootstrap,
  upsertRegistryItem,
  createPartner,
  createCalculation,
  createTransfer,
  createPosReceipt
};
