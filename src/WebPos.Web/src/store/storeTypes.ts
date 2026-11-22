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
  LabelTemplate,
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
  UserRole,
  VatRate,
} from '../types/domain';

export type AuthStatus = 'CHECKING' | 'AUTHENTICATED' | 'UNAUTHENTICATED';
export type BackendMode = 'API' | 'LOCAL_FALLBACK';

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
  autoLevelingDocNumber?: string;
  deleted?: boolean;
  deactivated?: boolean;
}

export interface AppStoreState {
  authStatus: AuthStatus;
  backendMode: BackendMode;
  connectionError: string | null;
  mustChangePassword: boolean;
  currentUserRole: UserRole;
  currentUserEmail: string;
  activeTenantId: string | null;
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
  labelTemplates: LabelTemplate[];
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

  initializeSession: () => Promise<void>;
  loginWithApi: (email: string, password: string) => Promise<ActionResult>;
  logout: () => void;
  refreshBootstrapData: () => Promise<void>;
  setMustChangePassword: (mustChange: boolean) => void;

  setActiveCompanyId: (id: string) => void;
  setActiveFiscalYearId: (id: string) => void;
  setActiveStoreId: (id: string) => void;
  setActiveTerminalId: (id: string) => void;
  setPosWorkMode: (mode: PosWorkMode) => void;
  toggleTheme: () => void;
  setIsOnline: (online: boolean) => void;
  setSystemConfig: (config: Partial<SystemConfig>) => void;
  saveTenantSettings: (config: SystemConfig) => Promise<ActionResult>;
  isDateInLockedPeriod: (dateStr: string) => boolean;

  createFiscalYear: (companyId: string, year: number) => Promise<ActionResult>;
  deleteFiscalYear: (id: string) => Promise<ActionResult>;
  toggleFiscalYearLock: (id: string) => Promise<ActionResult>;
  toggleFiscalPeriodLock: (periodId: string) => Promise<ActionResult>;

  upsertCompany: (company: Company) => Promise<ActionResult>;
  deleteCompany: (id: string) => Promise<ActionResult>;
  upsertStoreLocation: (loc: StoreLocation) => Promise<ActionResult>;
  deleteStoreLocation: (id: string) => Promise<ActionResult>;
  upsertPosTerminal: (term: PosTerminal) => Promise<ActionResult>;
  deletePosTerminal: (id: string) => Promise<ActionResult>;
  upsertVatRate: (rate: VatRate) => Promise<ActionResult>;
  deleteVatRate: (id: string) => Promise<ActionResult>;

  upsertPartner: (partner: Partner) => Promise<ActionResult>;
  deletePartner: (id: string) => Promise<ActionResult>;
  upsertItem: (
    item: Item,
    barcodes?: ItemBarcode[],
    bomLines?: ItemBomLine[],
    storePrices?: StoreItemPrice[]
  ) => Promise<ActionResult>;
  deleteItem: (id: string) => Promise<ActionResult>;
  upsertStoreItemPrice: (price: StoreItemPrice) => Promise<ActionResult>;
  clearLabelPrintFlags: (storeId: string, itemIds: string[]) => Promise<ActionResult>;
  saveLabelTemplate: (tpl: LabelTemplate) => Promise<ActionResult>;
  deleteLabelTemplate: (id: string) => Promise<ActionResult>;

  saveCalculationDraft: (doc: CalculationDocument) => Promise<ActionResult>;
  postCalculation: (docId: string) => Promise<ActionResult>;
  reverseCalculation: (docId: string, reason?: string) => Promise<ActionResult>;
  deleteCalculationDraft: (docId: string) => Promise<ActionResult>;

  savePriceLevelingDraft: (doc: PriceLevelingDocument) => Promise<ActionResult>;
  postPriceLeveling: (docId: string) => Promise<ActionResult>;
  reversePriceLeveling: (docId: string, reason?: string) => Promise<ActionResult>;
  deletePriceLevelingDraft: (docId: string) => Promise<ActionResult>;

  saveTransferDraft: (doc: TransferDocument) => Promise<ActionResult>;
  postTransfer: (docId: string) => Promise<ActionResult>;
  reverseTransfer: (docId: string, reason?: string) => Promise<ActionResult>;
  deleteTransferDraft: (docId: string) => Promise<ActionResult>;

  saveInventoryCountDraft: (doc: InventoryCountDocument) => Promise<ActionResult>;
  postInventoryCount: (docId: string) => Promise<ActionResult>;
  reverseInventoryCount: (docId: string, reason?: string) => Promise<ActionResult>;
  deleteInventoryCountDraft: (docId: string) => Promise<ActionResult>;

  saveOtherWarehouseDraft: (doc: OtherWarehouseDocument) => Promise<ActionResult>;
  postOtherWarehouseDoc: (docId: string) => Promise<ActionResult>;
  reverseOtherWarehouseDoc: (docId: string, reason?: string) => Promise<ActionResult>;
  deleteOtherWarehouseDraft: (docId: string) => Promise<ActionResult>;

  issuePosReceipt: (receipt: PosReceipt) => Promise<ActionResult>;
  refundPosReceipt: (originalReceiptId: string) => Promise<ActionResult>;
  fiscalizePosReceipt: (receiptId: string, fiscalReceiptNumber: string) => Promise<ActionResult>;
  holdPosReceipt: (held: HeldPosReceipt) => void;
  removeHeldReceipt: (heldId: string) => void;
}
