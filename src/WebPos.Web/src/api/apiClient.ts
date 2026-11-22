import type {
  CalculationDocument,
  Company,
  InventoryCountDocument,
  Item,
  LabelTemplate,
  OtherWarehouseDocument,
  Partner,
  PaymentMethod,
  PosReceipt,
  PosTerminal,
  PriceLevelingDocument,
  StoreItemPrice,
  StoreLocation,
  SystemConfig,
  TransferDocument,
  VatRate,
} from '../types/domain';
import type {
  AuthUserProfile,
  BootstrapDataResponse,
  ChangePasswordRequest,
  CreateTenantRequest,
  CreateUserRequest,
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
  ResetPasswordRequest,
  SaveItemRequest,
  TenantSummary,
  TenantUser,
} from './apiTypes';

const TOKEN_STORAGE_KEY = 'webpos_auth_token';

export class ApiError extends Error {
  readonly status: number;
  readonly isNetworkError: boolean;

  constructor(message: string, status: number, isNetworkError = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isNetworkError = isNetworkError;
  }
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setAuthToken(token: string | null): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  if (token) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

function toNum(val: string | number | undefined | null, fallback = 0): number {
  if (val === undefined || val === null || val === '') return fallback;
  const parsed = Number(String(val).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    throw new ApiError(message, 0, true);
  }

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    if (isJson) {
      try {
        const body = (await response.json()) as {
          message?: string;
          error?: string;
          title?: string;
          errors?: Record<string, string[]>;
        };
        const validationDetail = body.errors
          ? Object.values(body.errors).flat().filter(Boolean).join(' ')
          : '';
        errorMessage =
          body.message || body.error || validationDetail || body.title || errorMessage;
      } catch {
        // ignore JSON parse failure on error body
      }
    }
    const isProxyOrMissingBackend =
      response.status === 502 ||
      response.status === 503 ||
      response.status === 504 ||
      (response.status === 404 && !isJson);
    throw new ApiError(errorMessage, response.status, isProxyOrMissingBackend);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!isJson) {
    throw new ApiError('Unexpected non-JSON response from API', response.status, true);
  }

  return (await response.json()) as T;
}

const storeTypeMap: Record<StoreLocation['storeType'], string> = {
  RETAIL: 'Retail',
  WHOLESALE: 'Wholesale',
  RAW_MATERIAL: 'RawMaterial',
  PRODUCTION: 'Production',
};

const itemTypeMap: Record<Item['itemType'], string> = {
  GOODS: 'Goods',
  SERVICE: 'Service',
  COMPOSITE: 'Manufactured',
  RAW_MATERIAL: 'RawMaterial',
};

const otherSubtypeMap: Record<OtherWarehouseDocument['subtype'], string> = {
  WRITEOFF_KALORASTUR: 'WriteoffKalorastur',
  INTERNAL_ISSUE: 'InternalIssue',
  INTERNAL_RECEIPT: 'InternalReceipt',
  SUPPLIER_RETURN: 'SupplierReturn',
  INTERNAL_PRODUCTION: 'InternalProduction',
};

const paymentMethodMap: Record<PaymentMethod, 'Cash' | 'Card' | 'BankTransfer' | 'Mixed'> = {
  CASH: 'Cash',
  CARD: 'Card',
  WIRE: 'BankTransfer',
  COMBINED: 'Mixed',
};

export interface DeleteItemResponse {
  deleted: boolean;
  deactivated: boolean;
  message: string;
}

export interface PostCalculationResponse extends Partial<CalculationDocument> {
  autoLevelingDocNumber?: string;
}

export const apiClient = {
  // ===== Auth =====
  login: (payload: LoginRequest): Promise<LoginResponse> =>
    request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMe: (): Promise<AuthUserProfile> =>
    request<AuthUserProfile>('/api/auth/me', {
      method: 'GET',
    }),

  forgotPassword: (emailOrUsername: string): Promise<ForgotPasswordResponse> =>
    request<ForgotPasswordResponse>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        emailOrUsername,
        email: emailOrUsername,
        usernameOrEmail: emailOrUsername,
      }),
    }),

  resetPassword: (payload: ResetPasswordRequest): Promise<{ message?: string }> =>
    request<{ message?: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        emailOrUsername: payload.emailOrUsername,
        email: payload.emailOrUsername,
        usernameOrEmail: payload.emailOrUsername,
        resetCode: payload.resetCode,
        code: payload.resetCode,
        token: payload.resetCode,
        newPassword: payload.newPassword,
      }),
    }),

  changePassword: (payload: ChangePasswordRequest): Promise<{ message?: string }> =>
    request<{ message?: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // ===== SuperAdmin =====
  getTenants: (): Promise<TenantSummary[]> =>
    request<TenantSummary[]>('/api/superadmin/tenants', {
      method: 'GET',
    }),

  createTenant: (payload: CreateTenantRequest): Promise<TenantSummary> =>
    request<TenantSummary>('/api/superadmin/tenants', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTenant: (id: string, payload: { code: string; name: string }): Promise<TenantSummary> =>
    request<TenantSummary>(`/api/superadmin/tenants/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  toggleTenant: (tenantId: string): Promise<TenantSummary> =>
    request<TenantSummary>(`/api/superadmin/tenants/${encodeURIComponent(tenantId)}/toggle`, {
      method: 'PATCH',
    }),

  resetTenantAdminPassword: (
    id: string,
    payload: { newPassword: string }
  ): Promise<{ message?: string }> =>
    request<{ message?: string }>(
      `/api/superadmin/tenants/${encodeURIComponent(id)}/reset-admin-password`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  // ===== Users =====
  getUsers: (): Promise<TenantUser[]> =>
    request<TenantUser[]>('/api/users', {
      method: 'GET',
    }),

  createUser: (payload: CreateUserRequest): Promise<TenantUser> =>
    request<TenantUser>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateUser: (
    id: string,
    payload: { username: string; email: string; role: string }
  ): Promise<TenantUser> =>
    request<TenantUser>(`/api/users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  toggleUser: (id: string): Promise<TenantUser> =>
    request<TenantUser>(`/api/users/${encodeURIComponent(id)}/toggle`, {
      method: 'PATCH',
    }),

  resetUserPassword: (
    id: string,
    payload: { newPassword: string }
  ): Promise<{ message?: string }> =>
    request<{ message?: string }>(`/api/users/${encodeURIComponent(id)}/reset-password`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // ===== Bootstrap =====
  getBootstrapData: (): Promise<BootstrapDataResponse> =>
    request<BootstrapDataResponse>('/api/bootstrap', {
      method: 'GET',
    }),

  // ===== Organization & Settings =====
  saveCompany: (company: Company): Promise<Company> =>
    request<Company>('/api/organization/companies', {
      method: 'POST',
      body: JSON.stringify({
        id: company.id,
        code: company.code,
        name: company.name,
        jib: company.taxIdNumber || company.code,
        pdvNumber: company.vatIdNumber || null,
        address: company.address || '',
        city: company.city || '',
        currencyCode: company.currencyCode || 'BAM',
        bankAccount: company.bankAccount || null,
      }),
    }),

  deleteCompany: (id: string): Promise<void> =>
    request<void>(`/api/organization/companies/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  saveStore: (store: StoreLocation): Promise<StoreLocation> =>
    request<StoreLocation>('/api/organization/stores', {
      method: 'POST',
      body: JSON.stringify({
        id: store.id,
        companyId: store.companyId,
        code: store.code,
        name: store.name,
        storeType: storeTypeMap[store.storeType] ?? 'Retail',
        address: store.address || '',
        city: store.city || '',
        isActive: store.isActive,
      }),
    }),

  deleteStore: (id: string): Promise<void> =>
    request<void>(`/api/organization/stores/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  saveRegister: (
    term: Pick<PosTerminal, 'storeId' | 'code' | 'name' | 'fiscalPrefix'> & {
      id?: string;
      isActive?: boolean;
    }
  ): Promise<unknown> =>
    request<unknown>('/api/organization/registers', {
      method: 'POST',
      body: JSON.stringify({
        id: term.id,
        storeId: term.storeId,
        code: term.code,
        name: term.name,
        fiscalDeviceId: term.fiscalPrefix,
        isActive: term.isActive ?? true,
      }),
    }),

  deleteRegister: (id: string): Promise<void> =>
    request<void>(`/api/organization/registers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  saveFiscalYear: (payload: {
    id?: string;
    companyId: string;
    year: number;
    isClosed?: boolean;
  }): Promise<{
    fiscalYear: {
      id: string;
      companyId: string;
      year: number;
      startDate: string;
      endDate: string;
      isLocked: boolean;
    };
    periods: Array<{
      id: string;
      companyId: string;
      fiscalYearId: string;
      month: number;
      name: string;
      startDate: string;
      endDate: string;
      isLocked: boolean;
      lockedAt?: string;
      lockedBy?: string;
    }>;
  }> =>
    request('/api/organization/fiscal-years', {
      method: 'POST',
      body: JSON.stringify({
        id: payload.id,
        companyId: payload.companyId,
        year: payload.year,
        isClosed: payload.isClosed ?? false,
      }),
    }),

  deleteFiscalYear: (id: string): Promise<void> =>
    request<void>(`/api/organization/fiscal-years/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  toggleFiscalYearLock: (id: string): Promise<unknown> =>
    request<unknown>(`/api/organization/fiscal-years/${encodeURIComponent(id)}/toggle-lock`, {
      method: 'PATCH',
    }),

  toggleFiscalPeriod: (periodId: string): Promise<unknown> =>
    request(`/api/organization/fiscal-periods/${encodeURIComponent(periodId)}/toggle`, {
      method: 'PATCH',
    }),

  saveVatRate: (
    rate: Pick<VatRate, 'id' | 'code' | 'name' | 'ratePercent'> & {
      companyId?: string;
      validFrom?: string;
      isActive?: boolean;
    }
  ): Promise<unknown> =>
    request('/api/organization/vat-rates', {
      method: 'POST',
      body: JSON.stringify({
        id: rate.id,
        companyId: rate.companyId || null,
        code: rate.code,
        name: rate.name,
        ratePercent: toNum(rate.ratePercent, 0),
        validFrom: rate.validFrom || null,
        isActive: rate.isActive ?? true,
      }),
    }),

  deleteVatRate: (id: string): Promise<void> =>
    request<void>(`/api/organization/vat-rates/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  getTenantSettings: (): Promise<SystemConfig> =>
    request<SystemConfig>('/api/organization/tenant-settings', {
      method: 'GET',
    }),

  saveTenantSettings: (cfg: SystemConfig): Promise<SystemConfig> =>
    request<SystemConfig>('/api/organization/tenant-settings', {
      method: 'PUT',
      body: JSON.stringify({
        allowNegativeStock: Boolean(cfg.allowNegativeStock),
        allowPriceChangeWithoutLeveling: Boolean(cfg.allowPriceChangeWithoutLeveling),
        autoCreatePriceLevelingOnInbound: cfg.autoCreatePriceLevelingOnInbound ?? true,
        defaultCurrency: cfg.defaultCurrency || 'BAM',
      }),
    }),

  // ===== Master Data =====
  saveItem: (payload: SaveItemRequest & { storePrices?: StoreItemPrice[] }): Promise<Item> => {
    const it = payload.item;
    return request<Item>('/api/master-data/items', {
      method: 'POST',
      body: JSON.stringify({
        id: it.id,
        companyId: it.companyId,
        sku: it.sku,
        primaryBarcode: it.primaryBarcode || null,
        name: it.name,
        shortName: it.shortName || null,
        categoryName: it.categoryName || null,
        categoryPrefix: it.categoryPrefix || null,
        uom: it.uom || 'kom',
        vatRateId: it.vatRateId,
        itemType: itemTypeMap[it.itemType] ?? 'Goods',
        isWeighable: it.isWeighable,
        isActive: it.isActive,
        netContentQty: toNum(it.netContentQty, 1),
        netContentUom: it.netContentUom || 'kg',
        countryOfOrigin: it.countryOfOrigin || 'Bosna i Hercegovina',
        normativeMode: it.normativeMode || 'NONE',
        barcodes: payload.barcodes?.map((b) => ({
          barcode: b.barcode,
          uom: b.uom || 'kom',
          packMultiplier: toNum(b.packMultiplier, 1),
          description: b.description || null,
        })),
        bomLines: payload.bomLines?.map((b) => ({
          componentItemId: b.componentItemId,
          sourceStoreId: b.sourceStoreId || null,
          quantity: toNum(b.quantity, 0),
          wastePercent: toNum(b.wastePercent, 0),
        })),
        storePrices: payload.storePrices?.map((sp) => ({
          storeId: sp.storeId,
          purchasePriceExclVat4: toNum(sp.purchaseUnitPrice, 0),
          wholesalePriceExclVat4: toNum(sp.wholesaleUnitPriceExclVat, 0),
          retailPriceInclVat2: toNum(sp.retailUnitPriceWithVat, 0),
          minStockQty: toNum(sp.minStockQty, 0),
          shelfLocation: sp.shelfLocation || null,
          needsLabelPrint: sp.needsLabelPrint ?? false,
        })),
      }),
    });
  },

  deleteItem: (id: string): Promise<DeleteItemResponse> =>
    request<DeleteItemResponse>(`/api/master-data/items/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  saveStoreItemPrice: (price: {
    storeId: string;
    itemId: string;
    purchaseUnitPrice?: string;
    wholesaleUnitPriceExclVat?: string;
    retailUnitPriceWithVat?: string;
    minStockQty?: string;
    shelfLocation?: string;
    needsLabelPrint?: boolean;
  }): Promise<unknown> =>
    request('/api/master-data/store-prices', {
      method: 'POST',
      body: JSON.stringify({
        storeId: price.storeId,
        itemId: price.itemId,
        purchasePriceExclVat4:
          price.purchaseUnitPrice !== undefined ? toNum(price.purchaseUnitPrice, 0) : null,
        wholesalePriceExclVat4:
          price.wholesaleUnitPriceExclVat !== undefined
            ? toNum(price.wholesaleUnitPriceExclVat, 0)
            : null,
        retailPriceInclVat2:
          price.retailUnitPriceWithVat !== undefined
            ? toNum(price.retailUnitPriceWithVat, 0)
            : null,
        minStockQty: price.minStockQty !== undefined ? toNum(price.minStockQty, 0) : null,
        shelfLocation: price.shelfLocation !== undefined ? price.shelfLocation || null : null,
        needsLabelPrint: price.needsLabelPrint ?? null,
      }),
    }),

  savePartner: (partner: Partner): Promise<Partner> =>
    request<Partner>('/api/master-data/partners', {
      method: 'POST',
      body: JSON.stringify({
        id: partner.id,
        companyId: partner.companyId || null,
        code: partner.code,
        name: partner.name,
        jib: partner.taxIdNumber || null,
        pib: partner.vatIdNumber || null,
        address: partner.address || null,
        city: partner.city || null,
        phone: partner.phone || null,
        email: partner.email || null,
        isSupplier: partner.partnerType === 'SUPPLIER' || partner.partnerType === 'BOTH',
        isCustomer: partner.partnerType === 'BUYER' || partner.partnerType === 'BOTH',
        defaultDiscountPct: toNum(partner.discountPercent, 0),
        paymentTermsDays: partner.paymentTermsDays ?? 30,
        creditLimit: toNum(partner.creditLimit, 0),
        isActive: partner.isActive,
      }),
    }),

  deletePartner: (id: string): Promise<void> =>
    request<void>(`/api/master-data/partners/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  clearLabelPrintFlags: (storeId: string, itemIds: string[]): Promise<unknown> =>
    request<unknown>('/api/master-data/labels/clear', {
      method: 'POST',
      body: JSON.stringify({ storeId, itemIds }),
    }),

  saveLabelTemplate: (tpl: LabelTemplate): Promise<LabelTemplate> =>
    request<LabelTemplate>('/api/master-data/label-templates', {
      method: 'POST',
      body: JSON.stringify({
        id: tpl.id,
        name: tpl.name,
        widthMm: tpl.widthMm,
        heightMm: tpl.heightMm,
        fontScale: tpl.fontScale,
        showBarcode: tpl.showBarcode,
        showUnitPrice: tpl.showUnitPrice,
        showOrigin: tpl.showOrigin,
        showSku: tpl.showSku,
        isDefault: tpl.isDefault,
      }),
    }),

  deleteLabelTemplate: (id: string): Promise<void> =>
    request<void>(`/api/master-data/label-templates/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // ===== Warehouse Documents =====
  saveCalculation: (doc: CalculationDocument): Promise<CalculationDocument> =>
    request<CalculationDocument>('/api/warehouse-documents/calculations', {
      method: 'POST',
      body: JSON.stringify({
        id: doc.id,
        storeId: doc.storeId,
        supplierId: doc.partnerId,
        fiscalYearId: doc.fiscalYearId,
        documentNumber: doc.docNumber,
        documentDate: doc.docDate,
        invoiceNumber: doc.supplierInvoiceNumber || null,
        invoiceDate: doc.supplierInvoiceDate || null,
        orderNumber: doc.orderNumber || null,
        deliveryNoteNumber: doc.deliveryNoteNumber || null,
        note: doc.notes || null,
        lines: doc.lines
          .filter((l) => Boolean(l.itemId))
          .map((l) => {
            const dep = toNum(l.dependentCostPerUnit, 0);
            const net = toNum(l.netSupplierUnitPrice, 0);
            return {
              itemId: l.itemId,
              quantity: toNum(l.quantity, 0),
              invoicePriceExclVat4: toNum(l.supplierUnitPrice, 0),
              discountPct: toNum(l.discountPercent, 0),
              dependentCostPct: dep > 0 && net > 0 ? Number(((dep / net) * 100).toFixed(4)) : 0,
              marginPct: toNum(l.marginPercent, 0),
              vatRatePercent: toNum(l.vatRatePercent, 0),
            };
          }),
      }),
    }),

  postCalculation: (docId: string): Promise<PostCalculationResponse> =>
    request<PostCalculationResponse>(
      `/api/warehouse-documents/calculations/${encodeURIComponent(docId)}/post`,
      { method: 'POST' }
    ),

  reverseCalculation: (docId: string, reason?: string): Promise<unknown> =>
    request<unknown>(
      `/api/warehouse-documents/calculations/${encodeURIComponent(docId)}/reverse`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: reason || null }),
      }
    ),

  deleteCalculation: (docId: string): Promise<void> =>
    request<void>(`/api/warehouse-documents/calculations/${encodeURIComponent(docId)}`, {
      method: 'DELETE',
    }),

  saveLeveling: (doc: PriceLevelingDocument): Promise<PriceLevelingDocument> =>
    request<PriceLevelingDocument>('/api/warehouse-documents/levelings', {
      method: 'POST',
      body: JSON.stringify({
        id: doc.id,
        storeId: doc.storeId,
        fiscalYearId: doc.fiscalYearId,
        documentNumber: doc.docNumber,
        documentDate: doc.docDate,
        reason: doc.reason || null,
        lines: doc.lines
          .filter((l) => Boolean(l.itemId))
          .map((l) => ({
            itemId: l.itemId,
            newRetailPriceInclVat2: toNum(l.newRetailPriceWithVat, 0),
          })),
      }),
    }),

  postLeveling: (docId: string): Promise<PriceLevelingDocument> =>
    request<PriceLevelingDocument>(
      `/api/warehouse-documents/levelings/${encodeURIComponent(docId)}/post`,
      { method: 'POST' }
    ),

  reverseLeveling: (docId: string, reason?: string): Promise<unknown> =>
    request<unknown>(`/api/warehouse-documents/levelings/${encodeURIComponent(docId)}/reverse`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || null }),
    }),

  deleteLeveling: (docId: string): Promise<void> =>
    request<void>(`/api/warehouse-documents/levelings/${encodeURIComponent(docId)}`, {
      method: 'DELETE',
    }),

  saveTransfer: (doc: TransferDocument): Promise<TransferDocument> =>
    request<TransferDocument>('/api/warehouse-documents/transfers', {
      method: 'POST',
      body: JSON.stringify({
        id: doc.id,
        sourceStoreId: doc.sourceStoreId,
        targetStoreId: doc.targetStoreId,
        fiscalYearId: doc.fiscalYearId,
        documentNumber: doc.docNumber,
        documentDate: doc.docDate,
        note: doc.notes || null,
        lines: doc.lines
          .filter((l) => Boolean(l.itemId))
          .map((l) => ({
            itemId: l.itemId,
            quantity: toNum(l.quantity, 0),
          })),
      }),
    }),

  postTransfer: (docId: string): Promise<TransferDocument> =>
    request<TransferDocument>(
      `/api/warehouse-documents/transfers/${encodeURIComponent(docId)}/post`,
      { method: 'POST' }
    ),

  reverseTransfer: (docId: string, reason?: string): Promise<unknown> =>
    request<unknown>(`/api/warehouse-documents/transfers/${encodeURIComponent(docId)}/reverse`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || null }),
    }),

  deleteTransfer: (docId: string): Promise<void> =>
    request<void>(`/api/warehouse-documents/transfers/${encodeURIComponent(docId)}`, {
      method: 'DELETE',
    }),

  saveInventoryCount: (doc: InventoryCountDocument): Promise<InventoryCountDocument> =>
    request<InventoryCountDocument>('/api/warehouse-documents/inventory-counts', {
      method: 'POST',
      body: JSON.stringify({
        id: doc.id,
        storeId: doc.storeId,
        fiscalYearId: doc.fiscalYearId,
        documentNumber: doc.docNumber,
        countDate: doc.docDate,
        note: doc.notes || null,
        lines: doc.lines
          .filter((l) => Boolean(l.itemId))
          .map((l) => ({
            itemId: l.itemId,
            countedQty: toNum(l.countedQuantity, 0),
            approvedShrinkageQty: toNum(
              (l as { allowedWasteQty?: string }).allowedWasteQty ?? l.allowedWasteQuantity,
              0
            ),
            vatRatePercent: toNum(l.vatRatePercent, 17),
          })),
      }),
    }),

  postInventoryCount: (docId: string): Promise<InventoryCountDocument> =>
    request<InventoryCountDocument>(
      `/api/warehouse-documents/inventory-counts/${encodeURIComponent(docId)}/post`,
      { method: 'POST' }
    ),

  reverseInventoryCount: (docId: string, reason?: string): Promise<unknown> =>
    request<unknown>(
      `/api/warehouse-documents/inventory-counts/${encodeURIComponent(docId)}/reverse`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: reason || null }),
      }
    ),

  deleteInventoryCount: (docId: string): Promise<void> =>
    request<void>(`/api/warehouse-documents/inventory-counts/${encodeURIComponent(docId)}`, {
      method: 'DELETE',
    }),

  saveOtherWarehouseDoc: (doc: OtherWarehouseDocument): Promise<OtherWarehouseDocument> =>
    request<OtherWarehouseDocument>('/api/warehouse-documents/other-documents', {
      method: 'POST',
      body: JSON.stringify({
        id: doc.id,
        storeId: doc.storeId,
        fiscalYearId: doc.fiscalYearId,
        documentNumber: doc.docNumber,
        documentDate: doc.docDate,
        subtype: otherSubtypeMap[doc.subtype] ?? 'WriteoffKalorastur',
        note: doc.notes || null,
        lines: doc.lines
          .filter((l) => Boolean(l.itemId))
          .map((l) => ({
            itemId: l.itemId,
            quantity: toNum(l.quantity, 0),
            reason: (l as { reason?: string }).reason || null,
          })),
      }),
    }),

  postOtherWarehouseDoc: (docId: string): Promise<OtherWarehouseDocument> =>
    request<OtherWarehouseDocument>(
      `/api/warehouse-documents/other-documents/${encodeURIComponent(docId)}/post`,
      { method: 'POST' }
    ),

  reverseOtherWarehouseDoc: (docId: string, reason?: string): Promise<unknown> =>
    request<unknown>(
      `/api/warehouse-documents/other-documents/${encodeURIComponent(docId)}/reverse`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: reason || null }),
      }
    ),

  deleteOtherWarehouseDoc: (docId: string): Promise<void> =>
    request<void>(`/api/warehouse-documents/other-documents/${encodeURIComponent(docId)}`, {
      method: 'DELETE',
    }),

  // ===== POS =====
  createPosReceipt: (receipt: PosReceipt): Promise<PosReceipt> => {
    const rawPayments = (
      receipt as PosReceipt & {
        payments?: Array<{
          paymentMethod: PaymentMethod;
          amount: string | number;
          referenceNumber?: string;
        }>;
      }
    ).payments;

    let paymentsPayload:
      | Array<{ paymentMethod: string; amount2: number; referenceNumber: string | null }>
      | undefined;

    if (rawPayments && rawPayments.length > 0) {
      paymentsPayload = rawPayments.map((p) => ({
        paymentMethod: paymentMethodMap[p.paymentMethod] ?? 'Cash',
        amount2: toNum(p.amount, 0),
        referenceNumber: p.referenceNumber || null,
      }));
    } else if (receipt.paymentMethod === 'COMBINED') {
      const built: Array<{
        paymentMethod: string;
        amount2: number;
        referenceNumber: string | null;
      }> = [];
      const cashNet = Math.max(
        0,
        toNum(receipt.cashReceivedAmount, 0) - toNum(receipt.changeAmount, 0)
      );
      const cardAmt = toNum(receipt.cardAmount, 0);
      const wireAmt = toNum(receipt.wireAmount, 0);
      if (cashNet > 0) {
        built.push({
          paymentMethod: 'Cash',
          amount2: Number(cashNet.toFixed(2)),
          referenceNumber: null,
        });
      }
      if (cardAmt > 0) {
        built.push({
          paymentMethod: 'Card',
          amount2: Number(cardAmt.toFixed(2)),
          referenceNumber: null,
        });
      }
      if (wireAmt > 0) {
        built.push({
          paymentMethod: 'BankTransfer',
          amount2: Number(wireAmt.toFixed(2)),
          referenceNumber: null,
        });
      }
      if (built.length > 0) {
        paymentsPayload = built;
      }
    }

    return request<PosReceipt>('/api/pos/receipts', {
      method: 'POST',
      body: JSON.stringify({
        id: receipt.id,
        storeId: receipt.storeId,
        cashRegisterId: receipt.terminalId,
        fiscalYearId: receipt.fiscalYearId,
        customerId: receipt.partnerId || null,
        receiptNumber: receipt.receiptNumber,
        fiscalReceiptNumber: receipt.fiscalNumber || null,
        paymentMethod: paymentMethodMap[receipt.paymentMethod] ?? 'Cash',
        lines: receipt.lines.map((l) => ({
          itemId: l.itemId,
          quantity: toNum(l.quantity, 0),
          unitPriceInclVat2: toNum(
            (l as { unitPriceWithVat?: string }).unitPriceWithVat ?? l.retailUnitPriceWithVat,
            0
          ),
          discountPct: toNum(l.discountPercent, 0),
          vatRatePercent: toNum(l.vatRatePercent, 17),
        })),
        payments: paymentsPayload,
      }),
    });
  },

  refundPosReceipt: (id: string): Promise<PosReceipt> =>
    request<PosReceipt>(`/api/pos/receipts/${encodeURIComponent(id)}/refund`, {
      method: 'POST',
    }),

  fiscalizePosReceipt: (id: string, fiscalReceiptNumber: string): Promise<PosReceipt> =>
    request<PosReceipt>(`/api/pos/receipts/${encodeURIComponent(id)}/fiscalize`, {
      method: 'PATCH',
      body: JSON.stringify({ fiscalReceiptNumber }),
    }),
};
