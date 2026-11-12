import {
  initialCompanies,
  initialFiscalPeriods,
  initialFiscalYears,
  initialPartners,
  initialPosTerminals,
  initialStoreLocations,
  initialVatRates,
} from './initialOrgData';
import {
  initialItemBarcodes,
  initialItemBomLines,
  initialItems,
  initialStoreItemPrices,
} from './initialMasterData';
import {
  initialCalculations,
  initialInventoryCounts,
  initialOtherWarehouseDocs,
  initialPriceLevelings,
  initialTransfers,
} from './initialDocumentsData';
import {
  initialAuditLogs,
  initialKepEntries,
  initialPosReceipts,
} from './initialPosAndLedgerData';
import type { AppStoreState } from './storeTypes';

type DataKeys =
  | 'authStatus'
  | 'backendMode'
  | 'currentUserRole'
  | 'currentUserEmail'
  | 'activeTenantId'
  | 'companies'
  | 'activeCompanyId'
  | 'fiscalYears'
  | 'activeFiscalYearId'
  | 'fiscalPeriods'
  | 'storeLocations'
  | 'activeStoreId'
  | 'posTerminals'
  | 'activeTerminalId'
  | 'posWorkMode'
  | 'theme'
  | 'isOnline'
  | 'currentUserName'
  | 'vatRates'
  | 'partners'
  | 'items'
  | 'itemBarcodes'
  | 'itemBomLines'
  | 'storeItemPrices'
  | 'calculations'
  | 'priceLevelings'
  | 'transfers'
  | 'inventoryCounts'
  | 'otherWarehouseDocs'
  | 'posReceipts'
  | 'heldReceipts'
  | 'kepLedgerEntries'
  | 'auditLog'
  | 'systemConfig';

export const initialStoreData: Pick<AppStoreState, DataKeys> = {
  authStatus: 'AUTHENTICATED',
  backendMode: 'LOCAL_FALLBACK',
  currentUserRole: 'TenantAdmin',
  currentUserEmail: 'tenant.admin@bosnatrgovina.ba',
  activeTenantId: null,
  companies: initialCompanies,
  activeCompanyId: 'comp-1',
  fiscalYears: initialFiscalYears,
  activeFiscalYearId: 'fy-2026',
  fiscalPeriods: initialFiscalPeriods,
  storeLocations: initialStoreLocations,
  activeStoreId: 'store-1',
  posTerminals: initialPosTerminals,
  activeTerminalId: 'term-1',
  posWorkMode: 'TABLE',
  theme: 'light',
  isOnline: true,
  currentUserName: 'tenant.admin',
  vatRates: initialVatRates,
  partners: initialPartners,
  items: initialItems,
  itemBarcodes: initialItemBarcodes,
  itemBomLines: initialItemBomLines,
  storeItemPrices: initialStoreItemPrices,
  calculations: initialCalculations,
  priceLevelings: initialPriceLevelings,
  transfers: initialTransfers,
  inventoryCounts: initialInventoryCounts,
  otherWarehouseDocs: initialOtherWarehouseDocs,
  posReceipts: initialPosReceipts,
  heldReceipts: [],
  kepLedgerEntries: initialKepEntries,
  auditLog: initialAuditLogs,
  systemConfig: {
    allowPriceChangeWithoutLeveling: false,
  },
};
