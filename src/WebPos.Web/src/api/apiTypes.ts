import type {
  AuditLogEntry,
  CalculationDocument,
  Company,
  FiscalPeriod,
  FiscalYear,
  InventoryCountDocument,
  Item,
  ItemBarcode,
  ItemBomLine,
  KepLedgerEntry,
  LabelTemplate,
  OtherWarehouseDocument,
  Partner,
  PosReceipt,
  PosTerminal,
  PriceLevelingDocument,
  StoreItemPrice,
  StoreLocation,
  SystemConfig,
  TransferDocument,
  UserRole,
  VatRate,
} from '../types/domain';

export interface LoginRequest {
  email: string;
  password: string;
  usernameOrEmail?: string;
}

export interface ForgotPasswordResponse {
  message?: string;
  resetCode?: string;
  code?: string;
  token?: string;
  expiresAtUtc?: string;
}

export interface ResetPasswordRequest {
  emailOrUsername: string;
  resetCode: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface AuthUserProfile {
  id: string;
  userName: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
  tenantCode?: string | null;
  tenantName?: string | null;
  mustChangePassword?: boolean;
}

export interface LoginResponse {
  token: string;
  expiresAt?: string;
  user: AuthUserProfile;
}

export interface TenantSummary {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  adminEmail?: string;
  userCount?: number;
  companyCount?: number;
}

export interface CreateTenantRequest {
  code: string;
  name: string;
  adminEmail: string;
  adminPassword: string;
}

export interface TenantUser {
  id: string;
  userName: string;
  email: string;
  role: Exclude<UserRole, 'SuperAdmin'>;
  isActive: boolean;
  createdAt: string;
  mustChangePassword?: boolean;
}

export interface CreateUserRequest {
  userName: string;
  email: string;
  password: string;
  role: Exclude<UserRole, 'SuperAdmin'>;
}

export interface SaveItemRequest {
  item: Item;
  barcodes?: ItemBarcode[];
  bomLines?: ItemBomLine[];
}

export interface BootstrapDataResponse {
  companies: Company[];
  fiscalYears: FiscalYear[];
  fiscalPeriods: FiscalPeriod[];
  storeLocations: StoreLocation[];
  posTerminals: PosTerminal[];
  vatRates: VatRate[];
  partners: Partner[];
  items: Item[];
  itemBarcodes: ItemBarcode[];
  itemBomLines: ItemBomLine[];
  storeItemPrices: StoreItemPrice[];
  calculations: CalculationDocument[];
  priceLevelings: PriceLevelingDocument[];
  transfers: TransferDocument[];
  inventoryCounts: InventoryCountDocument[];
  otherWarehouseDocs: OtherWarehouseDocument[];
  posReceipts: PosReceipt[];
  kepLedgerEntries: KepLedgerEntry[];
  auditLog: AuditLogEntry[];
  systemConfig?: SystemConfig;
  labelTemplates?: LabelTemplate[];
}
