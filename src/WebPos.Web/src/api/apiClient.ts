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
      body: JSON.stringify(company),
    }),

  saveStore: (store: StoreLocation): Promise<StoreLocation> =>
    request<StoreLocation>('/api/organization/stores', {
      method: 'POST',
      body: JSON.stringify(store),
    }),

  saveItem: (payload: SaveItemRequest): Promise<Item> =>
    request<Item>('/api/master-data/items', {
      method: 'POST',
      body: JSON.stringify(payload),
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
      body: JSON.stringify(doc),
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
