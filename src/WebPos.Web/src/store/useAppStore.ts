import { useSyncExternalStore } from 'react';
import { generateUuidV7 } from '../lib/utils';
import { t } from '../i18n';
import type { PosReceipt } from '../types/domain';
import type { ActionResult, AppStoreState } from './storeTypes';
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
import { checkDateLocked, createAuditEntry } from './storeHelpers';
import {
  executeIssuePosReceipt,
  executePostCalculation,
  executeReverseCalculation,
} from './documentMutations';
import {
  executePostPriceLeveling,
  executePostTransfer,
  executeReversePriceLeveling,
  executeReverseTransfer,
} from './warehouseMutations';
import {
  executePostInventoryCount,
  executePostOtherWarehouseDoc,
  executeReverseInventoryCount,
  executeReverseOtherWarehouseDoc,
} from './inventoryAndInternalMutations';

export type { ActionResult, AppStoreState } from './storeTypes';

const listeners = new Set<() => void>();
let state: AppStoreState;

function setState(patch: Partial<AppStoreState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function saveDraftGeneric<T extends { id: string; status: string }>(
  list: T[],
  doc: T
): { next: T[]; res: ActionResult } {
  const existing = list.find((dItem) => dItem.id === doc.id);
  if (existing && existing.status !== 'DRAFT') {
    return { next: list, res: { ok: false, error: t('messages.postedImmutableError') } };
  }
  const next = existing
    ? list.map((dItem) => (dItem.id === doc.id ? doc : dItem))
    : [doc, ...list];
  return { next, res: { ok: true } };
}

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id)
    ? list.map((x) => (x.id === item.id ? item : x))
    : [item, ...list];
}

state = {
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
  setActiveCompanyId: (id) => setState({ activeCompanyId: id }),
  setActiveFiscalYearId: (id) => setState({ activeFiscalYearId: id }),
  setActiveStoreId: (id) => {
    const firstTerm = state.posTerminals.find((tr) => tr.storeId === id);
    setState({ activeStoreId: id, activeTerminalId: firstTerm?.id ?? state.activeTerminalId });
  },
  setActiveTerminalId: (id) => setState({ activeTerminalId: id }),
  setPosWorkMode: (mode) => setState({ posWorkMode: mode }),
  toggleTheme: () => {
    const next = state.theme === 'light' ? 'dark' : 'light';
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', next === 'dark');
    }
    setState({ theme: next });
  },
  setIsOnline: (online) => setState({ isOnline: online }),
  isDateInLockedPeriod: (dateStr) =>
    checkDateLocked(state.activeCompanyId, dateStr, state.fiscalYears, state.fiscalPeriods),
  toggleFiscalPeriodLock: (periodId) => {
    const target = state.fiscalPeriods.find((p) => p.id === periodId);
    if (!target) return;
    const nextLocked = !target.isLocked;
    setState({
      fiscalPeriods: state.fiscalPeriods.map((p) =>
        p.id === periodId
          ? {
              ...p,
              isLocked: nextLocked,
              lockedAt: nextLocked ? new Date().toISOString() : undefined,
              lockedBy: nextLocked ? state.currentUserName : undefined,
            }
          : p
      ),
      auditLog: [
        createAuditEntry({
          userName: state.currentUserName,
          entityType: 'FiscalPeriod',
          entityId: target.id,
          entityCode: target.name,
          action: nextLocked ? 'LOCK_PERIOD' : 'UNLOCK_PERIOD',
          summary: `${target.name} -> ${nextLocked ? t('status.LOCKED') : t('status.OPEN')}`,
        }),
        ...state.auditLog,
      ],
    });
  },
  upsertCompany: (company) => setState({ companies: upsertById(state.companies, company) }),
  upsertStoreLocation: (loc) =>
    setState({ storeLocations: upsertById(state.storeLocations, loc) }),
  upsertPosTerminal: (term) => setState({ posTerminals: upsertById(state.posTerminals, term) }),
  upsertVatRate: (rate) => setState({ vatRates: upsertById(state.vatRates, rate) }),
  upsertPartner: (partner) => setState({ partners: upsertById(state.partners, partner) }),
  upsertItem: (item, barcodes, bomLines) =>
    setState({
      items: upsertById(state.items, item),
      itemBarcodes: barcodes
        ? [...state.itemBarcodes.filter((b) => b.itemId !== item.id), ...barcodes]
        : state.itemBarcodes,
      itemBomLines: bomLines
        ? [...state.itemBomLines.filter((b) => b.parentItemId !== item.id), ...bomLines]
        : state.itemBomLines,
    }),
  upsertStoreItemPrice: (price) =>
    setState({ storeItemPrices: upsertById(state.storeItemPrices, price) }),
  clearLabelPrintFlags: (storeId, itemIds) =>
    setState({
      storeItemPrices: state.storeItemPrices.map((p) =>
        p.storeId === storeId && itemIds.includes(p.itemId) ? { ...p, needsLabelPrint: false } : p
      ),
    }),
  saveCalculationDraft: (doc) => {
    const { next, res } = saveDraftGeneric(state.calculations, doc);
    if (res.ok) setState({ calculations: next });
    return res;
  },
  postCalculation: (docId) => executePostCalculation(state, setState, docId),
  reverseCalculation: (docId, reason) => executeReverseCalculation(state, setState, docId, reason),
  savePriceLevelingDraft: (doc) => {
    const { next, res } = saveDraftGeneric(state.priceLevelings, doc);
    if (res.ok) setState({ priceLevelings: next });
    return res;
  },
  postPriceLeveling: (docId) => executePostPriceLeveling(state, setState, docId),
  reversePriceLeveling: (docId, reason) =>
    executeReversePriceLeveling(state, setState, docId, reason),
  saveTransferDraft: (doc) => {
    const { next, res } = saveDraftGeneric(state.transfers, doc);
    if (res.ok) setState({ transfers: next });
    return res;
  },
  postTransfer: (docId) => executePostTransfer(state, setState, docId),
  reverseTransfer: (docId, reason) => executeReverseTransfer(state, setState, docId, reason),
  saveInventoryCountDraft: (doc) => {
    const { next, res } = saveDraftGeneric(state.inventoryCounts, doc);
    if (res.ok) setState({ inventoryCounts: next });
    return res;
  },
  postInventoryCount: (docId) => executePostInventoryCount(state, setState, docId),
  reverseInventoryCount: (docId, reason) =>
    executeReverseInventoryCount(state, setState, docId, reason),
  saveOtherWarehouseDraft: (doc) => {
    const { next, res } = saveDraftGeneric(state.otherWarehouseDocs, doc);
    if (res.ok) setState({ otherWarehouseDocs: next });
    return res;
  },
  postOtherWarehouseDoc: (docId) => executePostOtherWarehouseDoc(state, setState, docId),
  reverseOtherWarehouseDoc: (docId, reason) =>
    executeReverseOtherWarehouseDoc(state, setState, docId, reason),
  issuePosReceipt: (receipt) => executeIssuePosReceipt(state, setState, receipt),
  refundPosReceipt: (originalReceiptId) => {
    const orig = state.posReceipts.find((r) => r.id === originalReceiptId);
    if (!orig || orig.receiptType === 'REFUND' || orig.status === 'REVERSED') {
      return { ok: false, error: t('common.errorTitle') };
    }
    const refundDoc: PosReceipt = {
      ...orig,
      id: generateUuidV7(),
      receiptNumber: `ST-${orig.receiptNumber}`,
      fiscalNumber: `BF-ST-${orig.fiscalNumber}`,
      receiptType: 'REFUND',
      referenceReceiptId: orig.id,
      referenceFiscalNumber: orig.fiscalNumber,
      issuedAt: new Date().toISOString(),
      status: 'POSTED',
    };
    setState({
      posReceipts: state.posReceipts.map((r) =>
        r.id === orig.id ? { ...r, status: 'REVERSED' } : r
      ),
    });
    return executeIssuePosReceipt(state, setState, refundDoc);
  },
  holdPosReceipt: (held) => setState({ heldReceipts: [held, ...state.heldReceipts] }),
  removeHeldReceipt: (heldId) =>
    setState({ heldReceipts: state.heldReceipts.filter((h) => h.id !== heldId) }),
};

export function getAppStoreState(): AppStoreState { return state; }
export function useAppStore(): AppStoreState;
export function useAppStore<T>(selector: (s: AppStoreState) => T): T;
export function useAppStore<T>(selector?: (s: AppStoreState) => T): T | AppStoreState {
  const snap = useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
    () => state
  );
  return selector ? selector(snap) : snap;
}
