import { useSyncExternalStore } from 'react';
import { generateUuidV7 } from '../lib/utils';
import { t } from '../i18n';
import type { PosReceipt } from '../types/domain';
import type { ActionResult, AppStoreState } from './storeTypes';
import { initialStoreData } from './storeInitialState';
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
import { apiClient } from '../api/apiClient';
import {
  applyBootstrapData,
  initializeBackendSession,
  loginWithBackend,
  logoutFromBackend,
  syncIfApiMode,
} from './storeBackendSync';

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
  ...initialStoreData,
  initializeSession: () => initializeBackendSession(setState),
  loginWithApi: (email, password) => loginWithBackend(setState, email, password),
  logout: () => logoutFromBackend(() => state, setState),
  refreshBootstrapData: async () => {
    if (state.backendMode !== 'API') return;
    const data = await apiClient.getBootstrapData();
    applyBootstrapData(setState, data);
  },
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
  setSystemConfig: (cfg) =>
    setState({ systemConfig: { ...state.systemConfig, ...cfg } }),
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
  upsertCompany: (company) => {
    setState({
      companies: upsertById(state.companies, company),
      activeCompanyId: state.activeCompanyId || company.id,
    });
    syncIfApiMode(() => state, () => apiClient.saveCompany(company));
  },
  upsertStoreLocation: (loc) => {
    setState({
      storeLocations: upsertById(state.storeLocations, loc),
      activeStoreId: state.activeStoreId || loc.id,
    });
    syncIfApiMode(() => state, () => apiClient.saveStore(loc));
  },
  upsertPosTerminal: (term) => {
    setState({
      posTerminals: upsertById(state.posTerminals, term),
      activeTerminalId: state.activeTerminalId || term.id,
    });
    syncIfApiMode(() => state, () => apiClient.saveRegister(term));
  },
  upsertVatRate: (rate) => setState({ vatRates: upsertById(state.vatRates, rate) }),
  upsertPartner: (partner) => {
    setState({ partners: upsertById(state.partners, partner) });
    syncIfApiMode(() => state, () => apiClient.savePartner(partner));
  },
  upsertItem: (item, barcodes, bomLines) => {
    setState({
      items: upsertById(state.items, item),
      itemBarcodes: barcodes
        ? [...state.itemBarcodes.filter((b) => b.itemId !== item.id), ...barcodes]
        : state.itemBarcodes,
      itemBomLines: bomLines
        ? [...state.itemBomLines.filter((b) => b.parentItemId !== item.id), ...bomLines]
        : state.itemBomLines,
    });
    syncIfApiMode(() => state, () => apiClient.saveItem({ item, barcodes, bomLines }));
  },
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
    if (res.ok) {
      setState({ calculations: next });
      syncIfApiMode(() => state, () => apiClient.saveCalculation(doc));
    }
    return res;
  },
  postCalculation: (docId) => {
    const res = executePostCalculation(state, setState, docId);
    if (res.ok) syncIfApiMode(() => state, () => apiClient.postCalculation(docId));
    return res;
  },
  reverseCalculation: (docId, reason) => executeReverseCalculation(state, setState, docId, reason),
  savePriceLevelingDraft: (doc) => {
    const { next, res } = saveDraftGeneric(state.priceLevelings, doc);
    if (res.ok) {
      setState({ priceLevelings: next });
      syncIfApiMode(() => state, () => apiClient.saveLeveling(doc));
    }
    return res;
  },
  postPriceLeveling: (docId) => {
    const res = executePostPriceLeveling(state, setState, docId);
    if (res.ok) syncIfApiMode(() => state, () => apiClient.postLeveling(docId));
    return res;
  },
  reversePriceLeveling: (docId, reason) =>
    executeReversePriceLeveling(state, setState, docId, reason),
  saveTransferDraft: (doc) => {
    const { next, res } = saveDraftGeneric(state.transfers, doc);
    if (res.ok) {
      setState({ transfers: next });
      syncIfApiMode(() => state, () => apiClient.saveTransfer(doc));
    }
    return res;
  },
  postTransfer: (docId) => {
    const res = executePostTransfer(state, setState, docId);
    if (res.ok) syncIfApiMode(() => state, () => apiClient.postTransfer(docId));
    return res;
  },
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
  issuePosReceipt: (receipt) => {
    const res = executeIssuePosReceipt(state, setState, receipt);
    if (res.ok) syncIfApiMode(() => state, () => apiClient.createPosReceipt(receipt));
    return res;
  },
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
