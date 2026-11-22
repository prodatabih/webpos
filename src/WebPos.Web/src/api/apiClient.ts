import type {
  CalculationDocument,
  Company,
  Item,
  Partner,
  PosReceipt,
  PriceLevelingDocument,
  StoreLocation,
  TransferDocument,
} from '../types/domain';
import type {
  AuthUserProfile,
  BootstrapDataResponse,
  CreateTenantRequest,
  CreateUserRequest,
  LoginRequest,
  LoginResponse,
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
        const body = (await response.json()) as { message?: string; error?: string; title?: string };
        errorMessage = body.message || body.error || body.title || errorMessage;
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

export const apiClient = {
  login: (payload: LoginRequest): Promise<LoginResponse> =>
    request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMe: (): Promise<AuthUserProfile> =>
    request<AuthUserProfile>('/api/auth/me', {
      method: 'GET',
    }),

  getTenants: (): Promise<TenantSummary[]> =>
    request<TenantSummary[]>('/api/superadmin/tenants', {
      method: 'GET',
    }),

  createTenant: (payload: CreateTenantRequest): Promise<TenantSummary> =>
    request<TenantSummary>('/api/superadmin/tenants', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  toggleTenant: (tenantId: string): Promise<TenantSummary> =>
    request<TenantSummary>(`/api/superadmin/tenants/${encodeURIComponent(tenantId)}/toggle`, {
      method: 'PATCH',
    }),

  getUsers: (): Promise<TenantUser[]> =>
    request<TenantUser[]>('/api/users', {
      method: 'GET',
    }),

  createUser: (payload: CreateUserRequest): Promise<TenantUser> =>
    request<TenantUser>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getBootstrapData: (): Promise<BootstrapDataResponse> =>
    request<BootstrapDataResponse>('/api/bootstrap', {
      method: 'GET',
    }),

  saveCompany: (company: Company): Promise<Company> =>
    request<Company>('/api/organization/companies', {
      method: 'POST',
      body: JSON.stringify({
        id: company.id,
        name: company.name,
        jib: company.taxIdNumber || company.code,
        pdvNumber: company.vatIdNumber || null,
        address: company.address || '-',
        city: company.city || '-',
        bankAccount: company.bankAccount || null,
      }),
    }),

  saveStore: (store: StoreLocation): Promise<StoreLocation> => {
    const storeTypeMap: Record<StoreLocation['storeType'], string> = {
      RETAIL: 'Retail',
      WHOLESALE: 'Wholesale',
      RAW_MATERIAL: 'RawMaterial',
      PRODUCTION: 'Production',
    };
    return request<StoreLocation>('/api/organization/stores', {
      method: 'POST',
      body: JSON.stringify({
        id: store.id,
        companyId: store.companyId,
        code: store.code,
        name: store.name,
        storeType: storeTypeMap[store.storeType] ?? 'Retail',
      }),
    });
  },

  saveRegister: (term: { id?: string; storeId: string; code: string; name: string; fiscalPrefix: string }): Promise<unknown> =>
    request<unknown>('/api/organization/registers', {
      method: 'POST',
      body: JSON.stringify({
        id: term.id,
        storeId: term.storeId,
        code: term.code,
        name: term.name,
        fiscalDeviceId: term.fiscalPrefix,
      }),
    }),

  saveFiscalYear: (payload: { id?: string; companyId: string; year: number; isClosed?: boolean }): Promise<{
    fiscalYear: { id: string; companyId: string; year: number; startDate: string; endDate: string; isLocked: boolean };
    periods: Array<{ id: string; companyId: string; fiscalYearId: string; month: number; name: string; startDate: string; endDate: string; isLocked: boolean; lockedAt?: string; lockedBy?: string }>;
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

  toggleFiscalPeriod: (periodId: string): Promise<unknown> =>
    request(`/api/organization/fiscal-periods/${encodeURIComponent(periodId)}/toggle`, {
      method: 'PATCH',
    }),

  saveVatRate: (rate: { id: string; code: string; name: string; ratePercent: string }): Promise<unknown> =>
    request('/api/organization/vat-rates', {
      method: 'POST',
      body: JSON.stringify({
        id: rate.id,
        code: rate.code,
        name: rate.name,
        ratePercent: Number(rate.ratePercent),
      }),
    }),

  saveItem: (payload: SaveItemRequest): Promise<Item> => {
    const itemTypeMap: Record<Item['itemType'], string> = {
      GOODS: 'Goods',
      SERVICE: 'Service',
      COMPOSITE: 'Manufactured',
      RAW_MATERIAL: 'RawMaterial',
    };
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
        categoryPrefix: null,
        uom: it.uom || 'kom',
        vatRateId: it.vatRateId,
        itemType: itemTypeMap[it.itemType] ?? 'Goods',
        isWeighable: it.isWeighable,
        isActive: it.isActive,
      }),
    });
  },

  saveStoreItemPrice: (price: {
    storeId: string;
    itemId: string;
    purchaseUnitPrice?: string;
    wholesaleUnitPriceExclVat?: string;
    retailUnitPriceWithVat?: string;
  }): Promise<unknown> =>
    request('/api/master-data/store-prices', {
      method: 'POST',
      body: JSON.stringify({
        storeId: price.storeId,
        itemId: price.itemId,
        purchasePriceExclVat4: price.purchaseUnitPrice !== undefined ? Number(price.purchaseUnitPrice) : null,
        wholesalePriceExclVat4: price.wholesaleUnitPriceExclVat !== undefined ? Number(price.wholesaleUnitPriceExclVat) : null,
        retailPriceInclVat2: price.retailUnitPriceWithVat !== undefined ? Number(price.retailUnitPriceWithVat) : null,
      }),
    }),

  savePartner: (partner: Partner): Promise<Partner> =>
    request<Partner>('/api/master-data/partners', {
      method: 'POST',
      body: JSON.stringify(partner),
    }),

  saveCalculation: (doc: CalculationDocument): Promise<CalculationDocument> =>
    request<CalculationDocument>('/api/warehouse-documents/calculations', {
      method: 'POST',
      body: JSON.stringify(doc),
    }),

  postCalculation: (docId: string): Promise<CalculationDocument> =>
    request<CalculationDocument>(`/api/warehouse-documents/calculations/${encodeURIComponent(docId)}/post`, {
      method: 'POST',
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
            newRetailPriceInclVat2: Number(l.newRetailPriceWithVat),
          })),
      }),
    }),

  postLeveling: (docId: string): Promise<PriceLevelingDocument> =>
    request<PriceLevelingDocument>(`/api/warehouse-documents/levelings/${encodeURIComponent(docId)}/post`, {
      method: 'POST',
    }),

  saveTransfer: (doc: TransferDocument): Promise<TransferDocument> =>
    request<TransferDocument>('/api/warehouse-documents/transfers', {
      method: 'POST',
      body: JSON.stringify(doc),
    }),

  postTransfer: (docId: string): Promise<TransferDocument> =>
    request<TransferDocument>(`/api/warehouse-documents/transfers/${encodeURIComponent(docId)}/post`, {
      method: 'POST',
    }),

  createPosReceipt: (receipt: PosReceipt): Promise<PosReceipt> =>
    request<PosReceipt>('/api/pos/receipts', {
      method: 'POST',
      body: JSON.stringify(receipt),
    }),
};
