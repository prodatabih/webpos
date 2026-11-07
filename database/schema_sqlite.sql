-- =============================================================================
-- WebPOS Multi-Tenant & Multi-Fiscal-Year Database Schema (SQLite WAL Edition)
-- Sve poslovne godine i svi tenanti u jednoj bazi sa niskim utroškom resursa
-- =============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;

-- 1. TENANTI (Pravna lica / Kompanije u Multi-Tenant arhitekturi)
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,                    -- npr. 'TEN-001', 'TEN-002'
    name TEXT NOT NULL,                           -- Pun naziv firme / tenanta
    tax_number TEXT NOT NULL,                     -- JIB / PIB / OIB
    vat_number TEXT,                              -- PDV broj
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'Bosna i Hercegovina',
    contact_email TEXT NOT NULL,
    contact_phone TEXT,
    subscription_plan TEXT NOT NULL DEFAULT 'ENTERPRISE',
    status TEXT NOT NULL DEFAULT 'ACTIVE',        -- 'ACTIVE', 'SUSPENDED'
    created_by_admin_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. POSLOVNE GODINE PO TENANTU (Sve poslovne godine svih tenanata u jednoj bazi)
CREATE TABLE IF NOT EXISTS fiscal_years (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,                        -- npr. 2024, 2025, 2026
    label TEXT NOT NULL,                          -- npr. 'Poslovna 2026. godina'
    start_date TEXT NOT NULL,                     -- '2026-01-01'
    end_date TEXT NOT NULL,                       -- '2026-12-31'
    is_active INTEGER NOT NULL DEFAULT 1,         -- Aktivna podrazumijevana godina tenanta
    is_closed INTEGER NOT NULL DEFAULT 0,         -- Zaključena godina (samo čitanje)
    initial_state_transferred INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (tenant_id, year)
);
CREATE INDEX IF NOT EXISTS idx_fiscal_years_tenant ON fiscal_years(tenant_id, year);

-- 3. KORISNICI SISTEMA (Globalni Super-Admin platforme + Administratori i Operateri Tenanata)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE, -- NULL za globalnog SUPER_ADMIN-a sistema
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,                           -- 'SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'CASHIER', 'WAREHOUSE', 'ACCOUNTANT'
    cashier_pin TEXT,                             -- Brzi PIN za operatere na kasi
    badge_barcode TEXT,                           -- Barkod kartice operatera
    must_change_password INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    invited_by_user_id TEXT,
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id, role);

-- 4. TOKENI ZA ZABORAVLJENU LOZINKU (Password Reset Flow)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,              -- SHA-256 hash sigurnosnog tokena
    reset_code TEXT NOT NULL,                     -- 6-cifreni kod za brzi unos
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_email ON password_reset_tokens(email, expires_at);

-- 5. SISTEMSKI OUTBOX ZA POSLANE EMAILOVE (Slanje Admin računa tenantu & Zaboravljena lozinka)
CREATE TABLE IF NOT EXISTS email_notifications_outbox (
    id TEXT PRIMARY KEY,
    tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    email_type TEXT NOT NULL,                     -- 'TENANT_ADMIN_CREDENTIALS', 'PASSWORD_RESET_LINK'
    subject TEXT NOT NULL,
    body_text TEXT NOT NULL,
    metadata_json TEXT DEFAULT '{}',              -- Privremena lozinka / reset token za brzi pregled u dev/admin modu
    status TEXT NOT NULL DEFAULT 'SENT',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. AKTIVNE SESIJE KORISNIKA (Kontekst: Tenant + Poslovna godina + Aktivni objekat)
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
    fiscal_year INTEGER NOT NULL DEFAULT 2026,
    active_store_id TEXT,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 7. REGISTAR PRODAJNIH OBJEKATA PO TENANTU (Market, Hipermarket, Veleprodajni magacin)
CREATE TABLE IF NOT EXISTS stores (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code TEXT NOT NULL,                           -- npr. 'PJ-01', 'PJ-02', 'VP-01'
    name TEXT NOT NULL,
    store_type TEXT NOT NULL DEFAULT 'RETAIL',    -- 'RETAIL', 'WHOLESALE', 'PRODUCTION'
    address TEXT,
    city TEXT,
    manager_name TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (tenant_id, code)
);

-- 8. REGISTAR POS KASA PO OBJEKTU (Izolovani brojevi računa po kasi i poslovnoj godini)
CREATE TABLE IF NOT EXISTS pos_terminals (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    code TEXT NOT NULL,                           -- npr. 'K1', 'K2'
    name TEXT NOT NULL,
    fiscal_device_type TEXT DEFAULT 'ESIR_LPFR',
    printer_port TEXT DEFAULT 'USB_ESC_POS',
    last_receipt_seq INTEGER NOT NULL DEFAULT 0,
    last_sync_version INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (tenant_id, store_id, code)
);

-- 9. REGISTAR PORESKIH STOPA I KATEGORIJA PO TENANTU
CREATE TABLE IF NOT EXISTS tax_rates (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code TEXT NOT NULL,                           -- npr. 'E' (17%), 'A' (0%)
    name TEXT NOT NULL,
    rate_pct REAL NOT NULL DEFAULT 17.0,
    is_default INTEGER NOT NULL DEFAULT 0,
    UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    UNIQUE (tenant_id, code)
);

-- 10. REGISTAR POSLOVNIH PARTNERA (Dobavljači i Kupci po tenantu)
CREATE TABLE IF NOT EXISTS partners (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code TEXT NOT NULL,                           -- npr. 'DOB-001', 'KUP-101'
    name TEXT NOT NULL,
    partner_type TEXT NOT NULL DEFAULT 'BOTH',    -- 'SUPPLIER', 'CUSTOMER', 'BOTH'
    tax_number TEXT NOT NULL,                     -- JIB / PIB
    vat_number TEXT,                              -- PDV broj
    address TEXT,
    city TEXT,
    phone TEXT,
    email TEXT,
    payment_due_days INTEGER NOT NULL DEFAULT 30,
    credit_limit REAL NOT NULL DEFAULT 0,
    default_rebate_pct REAL NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (tenant_id, code)
);

-- 11. REGISTAR ARTIKALA, BARKODOVA I NORMATIVA PO TENANTU
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,                            -- Interna šifra artikla
    barcode TEXT NOT NULL,                        -- Primarni EAN barkod
    name TEXT NOT NULL,
    short_name TEXT,
    item_type TEXT NOT NULL DEFAULT 'GOODS',      -- 'GOODS', 'SERVICE', 'COMPOSITE', 'RAW_MATERIAL'
    normative_mode TEXT NOT NULL DEFAULT 'NONE',  -- 'NONE', 'ON_SALE_BACKFLUSH', 'PRODUCTION_ORDER'
    uom TEXT NOT NULL DEFAULT 'kom',              -- 'kom', 'kg', 'l', 'm'
    net_content_qty REAL NOT NULL DEFAULT 1.0,    -- Za automatsku cijenu po 1kg / 1l na deklaraciji
    net_content_uom TEXT NOT NULL DEFAULT 'kg',
    tax_rate_id TEXT REFERENCES tax_rates(id),
    category_name TEXT DEFAULT 'Opšta roba',
    origin_country TEXT DEFAULT 'Bosna i Hercegovina',
    importer_name TEXT,
    ingredients_text TEXT,
    is_weighable INTEGER NOT NULL DEFAULT 0,      -- Vaga artikal (prefiks 20-29)
    pack_multiplier REAL NOT NULL DEFAULT 1.0,    -- 1 za komad, 24 za paket/baksu
    is_active INTEGER NOT NULL DEFAULT 1,
    sync_version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (tenant_id, sku),
    UNIQUE (tenant_id, barcode)
);
CREATE INDEX IF NOT EXISTS idx_items_tenant_barcode ON items(tenant_id, barcode);

CREATE TABLE IF NOT EXISTS item_barcodes (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    barcode TEXT NOT NULL,
    uom TEXT NOT NULL DEFAULT 'kom',
    pack_multiplier REAL NOT NULL DEFAULT 1.0,
    description TEXT,
    UNIQUE (tenant_id, barcode)
);

CREATE TABLE IF NOT EXISTS item_normatives (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    parent_item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    component_item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    quantity REAL NOT NULL,
    waste_pct REAL NOT NULL DEFAULT 0.0,
    UNIQUE (tenant_id, parent_item_id, component_item_id)
);

-- 12. CIJENE I ZALIHE PO OBJEKTU, TENANTU I POSLOVNOJ GODINI
-- (Svaki prodajni objekat ima svoje cijene i svoju zalihu u datoj poslovnoj godini!)
CREATE TABLE IF NOT EXISTS store_item_state (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    fiscal_year INTEGER NOT NULL,
    store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    purchase_price REAL NOT NULL DEFAULT 0.0,     -- Nabavna cijena (NC)
    wholesale_price REAL NOT NULL DEFAULT 0.0,    -- Veleprodajna cijena (VPC)
    retail_price REAL NOT NULL DEFAULT 0.0,       -- Maloprodajna cijena sa PDV-om (MPC)
    promo_price REAL,
    lowest_price_30d REAL,
    initial_stock_qty REAL NOT NULL DEFAULT 0.0,  -- Početno stanje u poslovnoj godini
    stock_qty REAL NOT NULL DEFAULT 0.0,          -- Trenutna zaliha u objektu u toj poslovnoj godini
    min_stock_qty REAL NOT NULL DEFAULT 0.0,
    shelf_location TEXT,
    needs_label_print INTEGER NOT NULL DEFAULT 0,
    sync_version INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (tenant_id, fiscal_year, store_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_store_item_lookup ON store_item_state(tenant_id, fiscal_year, store_id, item_id);

-- 13. POS FISKALNI RAČUNI (Izolovani po tenantu, poslovnoj godini, objektu i kasi)
CREATE TABLE IF NOT EXISTS pos_receipts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    fiscal_year INTEGER NOT NULL,
    store_id TEXT NOT NULL REFERENCES stores(id),
    terminal_id TEXT NOT NULL REFERENCES pos_terminals(id),
    cashier_id TEXT NOT NULL REFERENCES users(id),
    terminal_seq INTEGER NOT NULL,                -- Redni broj računa na toj kasi u toj poslovnoj godini
    receipt_number TEXT NOT NULL,                 -- npr. 'PJ01-K1-2026-000001'
    receipt_type TEXT NOT NULL DEFAULT 'SALE',    -- 'SALE', 'REFUND'
    partner_id TEXT REFERENCES partners(id),
    subtotal_net REAL NOT NULL,
    discount_amount REAL NOT NULL DEFAULT 0.0,
    tax_amount REAL NOT NULL,
    total_amount REAL NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'CASH',
    fiscal_number TEXT,
    issued_offline INTEGER NOT NULL DEFAULT 0,
    issued_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (tenant_id, fiscal_year, terminal_id, terminal_seq),
    UNIQUE (tenant_id, receipt_number)
);
CREATE INDEX IF NOT EXISTS idx_pos_receipts_tenant_year ON pos_receipts(tenant_id, fiscal_year, store_id);

CREATE TABLE IF NOT EXISTS pos_receipt_items (
    id TEXT PRIMARY KEY,
    receipt_id TEXT NOT NULL REFERENCES pos_receipts(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES items(id),
    scanned_barcode TEXT,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    discount_pct REAL NOT NULL DEFAULT 0.0,
    tax_rate REAL NOT NULL DEFAULT 17.0,
    line_total REAL NOT NULL,
    cost_price_snapshot REAL NOT NULL DEFAULT 0.0
);

-- 14. ROBNO-MATERIJALNI DOKUMENTI PO TENANTU I POSLOVNOJ GODINI
-- (Kalkulacije, Nivelacije, Prelokacije, Zapisnici, Predračuni, Fakture, Narudžbenice)
CREATE TABLE IF NOT EXISTS warehouse_documents (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    fiscal_year INTEGER NOT NULL,
    store_id TEXT NOT NULL REFERENCES stores(id),
    target_store_id TEXT REFERENCES stores(id),   -- Za Prelokacije (Međuskladišnice)
    doc_type TEXT NOT NULL,
    -- 'CALCULATION', 'PRICE_LEVELING', 'TRANSFER', 'RECORD_WRITEOFF',
    -- 'RECORD_SURPLUS', 'RECORD_SHORTAGE', 'PROFORMA', 'INVOICE', 'PURCHASE_ORDER'
    doc_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'POSTED',        -- 'DRAFT', 'POSTED', 'VOIDED'
    partner_id TEXT REFERENCES partners(id),
    partner_name TEXT,
    external_invoice_no TEXT,
    doc_date TEXT NOT NULL,
    total_purchase_value REAL NOT NULL DEFAULT 0.0,
    total_retail_value REAL NOT NULL DEFAULT 0.0,
    notes TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (tenant_id, fiscal_year, store_id, doc_type, doc_number)
);
CREATE INDEX IF NOT EXISTS idx_wh_docs_tenant_year ON warehouse_documents(tenant_id, fiscal_year, doc_type);

CREATE TABLE IF NOT EXISTS warehouse_document_items (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES warehouse_documents(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES items(id),
    quantity REAL NOT NULL,
    supplier_price REAL NOT NULL DEFAULT 0.0,
    discount_pct REAL NOT NULL DEFAULT 0.0,
    dependent_cost REAL NOT NULL DEFAULT 0.0,
    purchase_price REAL NOT NULL DEFAULT 0.0,
    margin_pct REAL NOT NULL DEFAULT 0.0,
    tax_rate REAL NOT NULL DEFAULT 17.0,
    old_retail_price REAL NOT NULL DEFAULT 0.0,
    new_retail_price REAL NOT NULL DEFAULT 0.0,
    price_diff_total REAL NOT NULL DEFAULT 0.0
);

-- 15. MOBILNI POPIS ROBE PO TENANTU I POSLOVNOJ GODINI
CREATE TABLE IF NOT EXISTS inventory_counts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    fiscal_year INTEGER NOT NULL,
    store_id TEXT NOT NULL REFERENCES stores(id),
    doc_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory_scans (
    id TEXT PRIMARY KEY,
    inventory_count_id TEXT NOT NULL REFERENCES inventory_counts(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    item_id TEXT NOT NULL REFERENCES items(id),
    scanned_barcode TEXT NOT NULL,
    book_qty REAL NOT NULL DEFAULT 0.0,
    scanned_qty REAL NOT NULL DEFAULT 0.0,
    scanned_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 16. ŠABLONI DEKLARACIJA I CIJENA ZA POLICE PO TENANTU
CREATE TABLE IF NOT EXISTS label_templates (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    template_type TEXT NOT NULL,                  -- 'SHELF_REGULAR', 'SHELF_PROMO', 'DECLARATION'
    width_mm REAL NOT NULL DEFAULT 50,
    height_mm REAL NOT NULL DEFAULT 30,
    layout_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
