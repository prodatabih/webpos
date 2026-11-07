-- =============================================================================
-- WebPOS Multi-Tenant & Multi-Fiscal-Year Database Schema (PostgreSQL 16 Edition)
-- Sve poslovne godine i svi tenanti u jednoj bazi sa niskim utroškom resursa
-- =============================================================================

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY,
    code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL,
    tax_number VARCHAR(32) NOT NULL,
    vat_number VARCHAR(32),
    address TEXT,
    city VARCHAR(80),
    country VARCHAR(80) DEFAULT 'Bosna i Hercegovina',
    contact_email VARCHAR(150) NOT NULL,
    contact_phone VARCHAR(50),
    subscription_plan VARCHAR(32) NOT NULL DEFAULT 'ENTERPRISE',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_by_admin_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fiscal_years (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    year SMALLINT NOT NULL,
    label VARCHAR(80) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    initial_state_transferred BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, year)
);
CREATE INDEX IF NOT EXISTS idx_pg_fiscal_years_tenant ON fiscal_years(tenant_id, year);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(150) NOT NULL UNIQUE,
    username VARCHAR(80) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(140) NOT NULL,
    role VARCHAR(32) NOT NULL, -- 'SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'CASHIER', 'WAREHOUSE', 'ACCOUNTANT'
    cashier_pin VARCHAR(32),
    badge_barcode VARCHAR(64),
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    invited_by_user_id UUID,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(150) NOT NULL,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    reset_code VARCHAR(12) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_notifications_outbox (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    recipient_email VARCHAR(150) NOT NULL,
    recipient_name VARCHAR(140) NOT NULL,
    email_type VARCHAR(40) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    body_text TEXT NOT NULL,
    metadata_json JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'SENT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(24) NOT NULL,
    name VARCHAR(140) NOT NULL,
    store_type VARCHAR(24) NOT NULL DEFAULT 'RETAIL',
    address TEXT,
    city VARCHAR(80),
    manager_name VARCHAR(120),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS pos_terminals (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    code VARCHAR(24) NOT NULL,
    name VARCHAR(100) NOT NULL,
    fiscal_device_type VARCHAR(40) DEFAULT 'ESIR_LPFR',
    printer_port VARCHAR(40) DEFAULT 'USB_ESC_POS',
    last_receipt_seq BIGINT NOT NULL DEFAULT 0,
    last_sync_version BIGINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, store_id, code)
);

CREATE TABLE IF NOT EXISTS tax_rates (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(12) NOT NULL,
    name VARCHAR(60) NOT NULL,
    rate_pct NUMERIC(5,2) NOT NULL DEFAULT 17.00,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS partners (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(32) NOT NULL,
    name VARCHAR(160) NOT NULL,
    partner_type VARCHAR(20) NOT NULL DEFAULT 'BOTH',
    tax_number VARCHAR(32) NOT NULL,
    vat_number VARCHAR(32),
    address TEXT,
    city VARCHAR(80),
    phone VARCHAR(50),
    email VARCHAR(150),
    payment_due_days SMALLINT NOT NULL DEFAULT 30,
    credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0,
    default_rebate_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sku VARCHAR(32) NOT NULL,
    barcode VARCHAR(64) NOT NULL,
    name VARCHAR(200) NOT NULL,
    short_name VARCHAR(64),
    item_type VARCHAR(24) NOT NULL DEFAULT 'GOODS',
    normative_mode VARCHAR(24) NOT NULL DEFAULT 'NONE',
    uom VARCHAR(16) NOT NULL DEFAULT 'kom',
    net_content_qty NUMERIC(10,4) NOT NULL DEFAULT 1.0,
    net_content_uom VARCHAR(16) NOT NULL DEFAULT 'kg',
    tax_rate_id UUID REFERENCES tax_rates(id),
    category_name VARCHAR(80) DEFAULT 'Opšta roba',
    origin_country VARCHAR(80) DEFAULT 'Bosna i Hercegovina',
    importer_name VARCHAR(140),
    ingredients_text TEXT,
    is_weighable BOOLEAN NOT NULL DEFAULT FALSE,
    pack_multiplier NUMERIC(12,4) NOT NULL DEFAULT 1.0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sync_version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, sku),
    UNIQUE (tenant_id, barcode)
);

CREATE TABLE IF NOT EXISTS store_item_state (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    fiscal_year SMALLINT NOT NULL,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    purchase_price NUMERIC(14,4) NOT NULL DEFAULT 0,
    wholesale_price NUMERIC(14,4) NOT NULL DEFAULT 0,
    retail_price NUMERIC(14,4) NOT NULL DEFAULT 0,
    promo_price NUMERIC(14,4),
    lowest_price_30d NUMERIC(14,4),
    initial_stock_qty NUMERIC(14,4) NOT NULL DEFAULT 0,
    stock_qty NUMERIC(14,4) NOT NULL DEFAULT 0,
    min_stock_qty NUMERIC(14,4) NOT NULL DEFAULT 0,
    shelf_location VARCHAR(32),
    needs_label_print BOOLEAN NOT NULL DEFAULT FALSE,
    sync_version BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, fiscal_year, store_id, item_id)
);

CREATE TABLE IF NOT EXISTS pos_receipts (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    fiscal_year SMALLINT NOT NULL,
    store_id UUID NOT NULL REFERENCES stores(id),
    terminal_id UUID NOT NULL REFERENCES pos_terminals(id),
    cashier_id UUID NOT NULL REFERENCES users(id),
    terminal_seq BIGINT NOT NULL,
    receipt_number VARCHAR(48) NOT NULL,
    receipt_type VARCHAR(16) NOT NULL DEFAULT 'SALE',
    partner_id UUID REFERENCES partners(id),
    subtotal_net NUMERIC(14,2) NOT NULL,
    discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(14,2) NOT NULL,
    total_amount NUMERIC(14,2) NOT NULL,
    payment_method VARCHAR(24) NOT NULL DEFAULT 'CASH',
    fiscal_number VARCHAR(64),
    issued_offline BOOLEAN NOT NULL DEFAULT FALSE,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, fiscal_year, terminal_id, terminal_seq),
    UNIQUE (tenant_id, receipt_number)
);

CREATE TABLE IF NOT EXISTS warehouse_documents (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    fiscal_year SMALLINT NOT NULL,
    store_id UUID NOT NULL REFERENCES stores(id),
    target_store_id UUID REFERENCES stores(id),
    doc_type VARCHAR(24) NOT NULL,
    doc_number VARCHAR(40) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'POSTED',
    partner_id UUID REFERENCES partners(id),
    partner_name VARCHAR(160),
    external_invoice_no VARCHAR(64),
    doc_date DATE NOT NULL,
    total_purchase_value NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_retail_value NUMERIC(14,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, fiscal_year, store_id, doc_type, doc_number)
);
