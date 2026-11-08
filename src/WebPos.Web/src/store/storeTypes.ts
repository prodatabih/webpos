import type {
  AuditLogEntry,
  CalculationDocument,
  Company,
  FiscalPeriod,
  FiscalYear,
  HeldPosReceipt,
  InventoryCountDocument,
  Item,
  ItemBarcode,
  ItemBomLine,
  KepLedgerEntry,
  OtherWarehouseDocument,
  Partner,
  PosReceipt,
  PosTerminal,
  PosWorkMode,
  PriceLevelingDocument,
  StoreItemPrice,
  StoreLocation,
  SystemConfig,
  TransferDocument,
  VatRate,
} from '../types/domain';

export interface ActionResult {
  ok: boolean;
  error?: string;
  autoLevelingDocNumber?: string;
}

export interface AppStoreState {
  companies: Company[];
  activeCompanyId: string;
  fiscalYears: FiscalYear[];
  activeFiscalYearId: string;
  fiscalPeriods: FiscalPeriod[];
  storeLocations: StoreLocation[];
  activeStoreId: string;
  posTerminals: PosTerminal[];
  activeTerminalId: string;
  posWorkMode: PosWorkMode;
  theme: 'light' | 'dark';
  isOnline: boolean;
  currentUserName: string;
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
  heldReceipts: HeldPosReceipt[];
  kepLedgerEntries: KepLedgerEntry[];
  auditLog: AuditLogEntry[];
  systemConfig: SystemConfig;
  setActiveCompanyId: (id: string) => void;
  setActiveFiscalYearId: (id: string) => void;
  setActiveStoreId: (id: string) => void;
  setActiveTerminalId: (id: string) => void;
  setPosWorkMode: (mode: PosWorkMode) => void;
  toggleTheme: () => void;
  setIsOnline: (online: boolean) => void;
  setSystemConfig: (config: Partial<SystemConfig>) => void;
  isDateInLockedPeriod: (dateStr: string) => boolean;
  toggleFiscalPeriodLock: (periodId: string) => void;
  upsertCompany: (company: Company) => void;
  upsertStoreLocation: (loc: StoreLocation) => void;
  upsertPosTerminal: (term: PosTerminal) => void;
  upsertVatRate: (rate: VatRate) => void;
  upsertPartner: (partner: Partner) => void;
  upsertItem: (item: Item, barcodes?: ItemBarcode[], bomLines?: ItemBomLine[]) => void;
  upsertStoreItemPrice: (price: StoreItemPrice) => void;
  clearLabelPrintFlags: (storeId: string, itemIds: string[]) => void;
  saveCalculationDraft: (doc: CalculationDocument) => ActionResult;
  postCalculation: (docId: string) => ActionResult;
  reverseCalculation: (docId: string, reason?: string) => ActionResult;
  savePriceLevelingDraft: (doc: PriceLevelingDocument) => ActionResult;
  postPriceLeveling: (docId: string) => ActionResult;
  reversePriceLeveling: (docId: string, reason?: string) => ActionResult;
  saveTransferDraft: (doc: TransferDocument) => ActionResult;
  postTransfer: (docId: string) => ActionResult;
  reverseTransfer: (docId: string, reason?: string) => ActionResult;
  saveInventoryCountDraft: (doc: InventoryCountDocument) => ActionResult;
  postInventoryCount: (docId: string) => ActionResult;
  reverseInventoryCount: (docId: string, reason?: string) => ActionResult;
  saveOtherWarehouseDraft: (doc: OtherWarehouseDocument) => ActionResult;
  postOtherWarehouseDoc: (docId: string) => ActionResult;
  reverseOtherWarehouseDoc: (docId: string, reason?: string) => ActionResult;
  issuePosReceipt: (receipt: PosReceipt) => ActionResult;
  refundPosReceipt: (originalReceiptId: string) => ActionResult;
  holdPosReceipt: (held: HeldPosReceipt) => void;
  removeHeldReceipt: (heldId: string) => void;
}
