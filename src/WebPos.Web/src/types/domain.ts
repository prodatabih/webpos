export type DocumentStatus = 'DRAFT' | 'POSTED' | 'REVERSED';
export type StoreType = 'RETAIL' | 'WHOLESALE' | 'PRODUCTION' | 'RAW_MATERIAL';
export type PartnerType = 'SUPPLIER' | 'BUYER' | 'BOTH';
export type ItemType = 'GOODS' | 'SERVICE' | 'COMPOSITE' | 'RAW_MATERIAL';
export type NormativeMode = 'NONE' | 'ON_SALE_BACKFLUSH' | 'PRODUCTION_ORDER';
export type PaymentMethod = 'CASH' | 'CARD' | 'WIRE' | 'COMBINED';
export type PosReceiptType = 'SALE' | 'REFUND';
export type PosWorkMode = 'TABLE' | 'TOUCH';
export type OtherWarehouseDocSubtype =
  | 'WRITEOFF_KALORASTUR'
  | 'INTERNAL_ISSUE'
  | 'INTERNAL_RECEIPT'
  | 'SUPPLIER_RETURN'
  | 'INTERNAL_PRODUCTION';
export type UserRole = 'SuperAdmin' | 'TenantAdmin' | 'Manager' | 'Cashier' | 'Accountant';

export interface Company {
  id: string;
  code: string;
  name: string;
  taxIdNumber: string;
  vatIdNumber: string;
  address: string;
  city: string;
  currencyCode: string;
  bankAccount: string;
}

export interface FiscalYear {
  id: string;
  companyId: string;
  year: number;
  startDate: string;
  endDate: string;
  isLocked: boolean;
}

export interface FiscalPeriod {
  id: string;
  fiscalYearId: string;
  companyId: string;
  month: number;
  name: string;
  startDate: string;
  endDate: string;
  isLocked: boolean;
  lockedAt?: string;
  lockedBy?: string;
}

export interface StoreLocation {
  id: string;
  companyId: string;
  code: string;
  name: string;
  storeType: StoreType;
  address: string;
  city: string;
  isActive: boolean;
}

export interface PosTerminal {
  id: string;
  storeId: string;
  code: string;
  name: string;
  fiscalPrefix: string;
  lastSequenceNumber: number;
  isOnline: boolean;
  isActive: boolean;
}

export interface VatRate {
  id: string;
  companyId: string;
  code: string;
  name: string;
  ratePercent: string;
  validFrom: string;
  isActive: boolean;
}

export interface Partner {
  id: string;
  companyId: string;
  code: string;
  name: string;
  partnerType: PartnerType;
  taxIdNumber: string;
  vatIdNumber: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  paymentTermsDays: number;
  creditLimit: string;
  isActive: boolean;
}

export interface ItemBarcode {
  id: string;
  itemId: string;
  barcode: string;
  uom: string;
  packMultiplier: string;
  description: string;
}

export interface ItemBomLine {
  id: string;
  parentItemId: string;
  componentItemId: string;
  quantity: string;
  wastePercent: string;
  sourceStoreId?: string;
}

export interface SystemConfig {
  allowPriceChangeWithoutLeveling: boolean;
}

export interface Item {
  id: string;
  companyId: string;
  sku: string;
  primaryBarcode: string;
  name: string;
  shortName: string;
  itemType: ItemType;
  normativeMode: NormativeMode;
  uom: string;
  netContentQty: string;
  netContentUom: string;
  vatRateId: string;
  categoryName: string;
  countryOfOrigin: string;
  isWeighable: boolean;
  isActive: boolean;
  groupCode?: string;
  categoryPrefix?: string;
}

export interface StoreItemPrice {
  id: string;
  storeId: string;
  itemId: string;
  purchaseUnitPrice: string;
  wholesaleUnitPriceExclVat: string;
  retailUnitPriceWithVat: string;
  promoRetailPriceWithVat?: string;
  lowestPrice30Days?: string;
  currentStockQty: string;
  minStockQty: string;
  shelfLocation: string;
  needsLabelPrint: boolean;
  updatedAt: string;
}

export interface HeldPosReceipt {
  id: string;
  storeId: string;
  terminalId: string;
  label: string;
  createdAt: string;
  partnerId?: string;
  lines: Array<{
    itemId: string;
    scannedBarcode: string;
    quantity: string;
    discountPercent: string;
  }>;
}

export interface KepLedgerEntry {
  id: string;
  companyId: string;
  fiscalYearId: string;
  storeId: string;
  entryNumber: number;
  entryDate: string;
  documentId: string;
  documentNumber: string;
  documentType: string;
  description: string;
  debitRetailAmount: string;
  creditRetailAmount: string;
  runningBalanceAmount: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  entityType: string;
  entityId: string;
  entityCode: string;
  action: 'CREATE' | 'UPDATE' | 'POST' | 'REVERSE' | 'LOCK_PERIOD' | 'UNLOCK_PERIOD';
  summary: string;
  previousState?: string;
  newState?: string;
}

export type {
  CalculationLine,
  CalculationDocument,
  PriceLevelingLine,
  PriceLevelingDocument,
  TransferLine,
  TransferDocument,
  InventoryCountLine,
  InventoryCountDocument,
  OtherWarehouseLine,
  OtherWarehouseDocument,
  PosReceiptLine,
  PosReceipt,
} from './documents';
