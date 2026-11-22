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
import { ApiError, apiClient } from '../api/apiClient';
import {
  applyBootstrapData,
  initializeBackendSession,
  loginWithBackend,
  logoutFromBackend,
  persistIfApiMode,
  SERVER_UNAVAILABLE_MESSAGE,
} from './storeBackendSync';

export type { ActionResult, AppStoreState } from './storeTypes';

const listeners = new Set<() => void>();
let state: AppStoreState;

function setState(patch: Partial<AppStoreState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function getState(): AppStoreState {
  return state;
}

function extractError(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.isNetworkError) {
    return SERVER_UNAVAILABLE_MESSAGE;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
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

function cascadeSelectionForCompany(companyId: string): Pick<
  AppStoreState,
  'activeCompanyId' | 'activeStoreId' | 'activeTerminalId' | 'activeFiscalYearId'
> {
  const matchingStores = companyId
    ? state.storeLocations.filter((s) => s.companyId === companyId)
    : state.storeLocations;
  const nextStoreId = matchingStores.some((s) => s.id === state.activeStoreId)
    ? state.activeStoreId
    : (matchingStores[0]?.id ?? '');

  const matchingTerms = nextStoreId
    ? state.posTerminals.filter((tr) => tr.storeId === nextStoreId)
    : state.posTerminals;
  const nextTerminalId = matchingTerms.some((tr) => tr.id === state.activeTerminalId)
    ? state.activeTerminalId
    : (matchingTerms[0]?.id ?? '');

  const matchingFys = companyId
    ? state.fiscalYears.filter((fy) => fy.companyId === companyId)
    : state.fiscalYears;
  const nextFiscalYearId = matchingFys.some((fy) => fy.id === state.activeFiscalYearId)
    ? state.activeFiscalYearId
    : (matchingFys[0]?.id ?? '');

  return {
    activeCompanyId: companyId,
    activeStoreId: nextStoreId,
    activeTerminalId: nextTerminalId,
    activeFiscalYearId: nextFiscalYearId,
  };
}

state = {
  ...initialStoreData,

  // ===== Session & Bootstrap =====
  initializeSession: () => initializeBackendSession(getState, setState),
  loginWithApi: (email, password) => loginWithBackend(getState, setState, email, password),
  logout: () => logoutFromBackend(getState, setState),
  refreshBootstrapData: async () => {
    if (state.backendMode !== 'API') return;
    const data = await apiClient.getBootstrapData();
    applyBootstrapData(getState, setState, data);
  },
  setMustChangePassword: (mustChange) => setState({ mustChangePassword: mustChange }),

  // ===== Context & UI =====
  setActiveCompanyId: (id) => setState(cascadeSelectionForCompany(id)),
  setActiveFiscalYearId: (id) => setState({ activeFiscalYearId: id }),
  setActiveStoreId: (id) => {
    const firstTerm = state.posTerminals.find((tr) => tr.storeId === id);
    setState({ activeStoreId: id, activeTerminalId: firstTerm?.id ?? '' });
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
  saveTenantSettings: async (config) => {
    const res = await persistIfApiMode(
      getState,
      () => apiClient.saveTenantSettings(config),
      'Greška pri snimanju postavki tenanta.'
    );
    if (!res.ok) return { ok: false, error: res.error };
    const saved = res.data ?? config;
    setState({
      systemConfig: {
        allowPriceChangeWithoutLeveling: Boolean(saved.allowPriceChangeWithoutLeveling),
        allowNegativeStock: Boolean(saved.allowNegativeStock),
        autoCreatePriceLevelingOnInbound: saved.autoCreatePriceLevelingOnInbound ?? true,
        defaultCurrency: saved.defaultCurrency || 'BAM',
      },
    });
    return { ok: true };
  },
  isDateInLockedPeriod: (dateStr) =>
    checkDateLocked(state.activeCompanyId, dateStr, state.fiscalYears, state.fiscalPeriods),

  // ===== Fiscal Years & Periods =====
  createFiscalYear: async (companyId, year) => {
    const id = generateUuidV7();
    if (state.backendMode === 'API') {
      try {
        const res = await apiClient.saveFiscalYear({ id, companyId, year, isClosed: false });
        setState({
          fiscalYears: upsertById(state.fiscalYears, res.fiscalYear),
          fiscalPeriods: [
            ...state.fiscalPeriods.filter((p) => p.fiscalYearId !== res.fiscalYear.id),
            ...res.periods,
          ],
          activeFiscalYearId: state.activeFiscalYearId || res.fiscalYear.id,
        });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: extractError(err, 'Greška pri kreiranju poslovne godine.') };
      }
    }
    const fy = {
      id,
      companyId,
      year,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      isLocked: false,
    };
    setState({
      fiscalYears: upsertById(state.fiscalYears, fy),
      activeFiscalYearId: state.activeFiscalYearId || fy.id,
    });
    return { ok: true };
  },

  deleteFiscalYear: async (id) => {
    const res = await persistIfApiMode(
      getState,
      () => apiClient.deleteFiscalYear(id),
      'Greška pri brisanju poslovne godine.'
    );
    if (!res.ok) return { ok: false, error: res.error };
    const nextYears = state.fiscalYears.filter((fy) => fy.id !== id);
    const nextPeriods = state.fiscalPeriods.filter((p) => p.fiscalYearId !== id);
    const nextActiveFy =
      state.activeFiscalYearId === id
        ? (nextYears.find((fy) => fy.companyId === state.activeCompanyId)?.id ??
          nextYears[0]?.id ??
          '')
        : state.activeFiscalYearId;
    setState({
      fiscalYears: nextYears,
      fiscalPeriods: nextPeriods,
      activeFiscalYearId: nextActiveFy,
    });
    return { ok: true };
  },

  toggleFiscalYearLock: async (id) => {
    const target = state.fiscalYears.find((fy) => fy.id === id);
    if (!target) return { ok: false, error: 'Poslovna godina nije pronađena.' };
    const res = await persistIfApiMode(
      getState,
      () => apiClient.toggleFiscalYearLock(id),
      'Greška pri promjeni statusa poslovne godine.'
    );
    if (!res.ok) return { ok: false, error: res.error };
    const nextLocked = !target.isLocked;
    setState({
      fiscalYears: state.fiscalYears.map((fy) =>
        fy.id === id ? { ...fy, isLocked: nextLocked } : fy
      ),
    });
    return { ok: true };
  },

  toggleFiscalPeriodLock: async (periodId) => {
    const target = state.fiscalPeriods.find((p) => p.id === periodId);
    if (!target) return { ok: false, error: 'Obračunski period nije pronađen.' };
    const res = await persistIfApiMode(
      getState,
      () => apiClient.toggleFiscalPeriod(periodId),
      'Greška pri promjeni statusa obračunskog perioda.'
    );
    if (!res.ok) return { ok: false, error: res.error };
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
    return { ok: true };
  },

  // ===== Organization =====
  upsertCompany: async (company) => {
    const res = await persistIfApiMode(
      getState,
      () => apiClient.saveCompany(company),
      'Greška pri snimanju preduzeća.'
    );
    if (!res.ok) return { ok: false, error: res.error };
    setState({
      companies: upsertById(state.companies, company),
      activeCompanyId: state.activeCompanyId || company.id,
    });
    return { ok: true };
  },

  deleteCompany: async (id) => {
    const res = await persistIfApiMode(
      getState,
      () => apiClient.deleteCompany(id),
      'Greška pri brisanju preduzeća.'
    );
    if (!res.ok) return { ok: false, error: res.error };
    const nextCompanies = state.companies.filter((c) => c.id !== id);
    const nextCompanyId =
      state.activeCompanyId === id ? (nextCompanies[0]?.id ?? '') : state.activeCompanyId;
    setState({
      companies: nextCompanies,
      ...cascadeSelectionForCompany(nextCompanyId),
    });
    return { ok: true };
  },

  upsertStoreLocation: async (loc) => {
    const res = await persistIfApiMode(
      getState,
      () => apiClient.saveStore(loc),
      'Greška pri snimanju poslovnice.'
    );
    if (!res.ok) return { ok: false, error: res.error };
    setState({
      storeLocations: upsertById(state.storeLocations, loc),
      activeStoreId: state.activeStoreId || loc.id,
    });
    return { ok: true };
  },

  deleteStoreLocation: async (id) => {
    const res = await persistIfApiMode(
      getState,
      () => apiClient.deleteStore(id),
      'Greška pri brisanju poslovnice.'
    );
    if (!res.ok) return { ok: false, error: res.error };
    const nextStores = state.storeLocations.filter((s) => s.id !== id);
    const nextStoreId =
      state.activeStoreId === id
        ? (nextStores.find((s) => s.companyId === state.activeCompanyId)?.id ??
          nextStores[0]?.id ??
          '')
        : state.activeStoreId;
    const nextTerminalId =
      state.activeStoreId === id
        ? (state.posTerminals.find((tr) => tr.storeId === nextStoreId)?.id ?? '')
        : state.activeTerminalId;
    setState({
      storeLocations: nextStores,
      activeStoreId: nextStoreId,
      activeTerminalId: nextTerminalId,
    });
    return { ok: true };
  },

  upsertPosTerminal: async (term) => {
    const res = await persistIfApiMode(
      getState,
      () => apiClient.saveRegister(term),
      'Greška pri snimanju POS kase.'
    );
    if (!res.ok) return { ok: false, error: res.error };
    setState({
      posTerminals: upsertById(state.posTerminals, term),
      activeTerminalId: state.activeTerminalId || term.id,
    });
    return { ok: true };
  },

  deletePosTerminal: async (id) => {
    const res = await persistIfApiMode(
      getState,
      () => apiClient.deleteRegister(id),
      'Greška pri brisanju POS kase.'
    );
    if (!res.ok) return { ok: false, error: res.error };
    const nextTerms = state.posTerminals.filter((tr) => tr.id !== id);
    const nextActiveTerm =
      state.activeTerminalId === id
        ? (nextTerms.find((tr) => tr.storeId === state.activeStoreId)?.id ??
          nextTerms[0]?.id ??
          '')
        : state.activeTerminalId;
    setState({
      posTerminals: nextTerms,
      activeTerminalId: nextActiveTerm,
    });
    return { ok: true };
  },

  upsertVatRate: async (rate) => {
    const res = await persistIfApiMode(
      getState,
      () => apiClient.saveVatRate(rate),
      'Greška pri snimanju PDV stope.'
    );
    if (!res.ok) return { ok: false, error: res.error };
    setState({ vatRates: upsertById(state.vatRates, rate) });
    return { ok: true };
  },

  deleteVatRate: async (id) => {
    const res = await persistIfApiMode(
      getState,
      () => apiClient.deleteVatRate(id),
      'Greška pri brisanju PDV stope.'
    );
    if (!res.ok) return { ok: false, error: res.error };
    setState({ vatRates: state.vatRates.filter((v) => v.id !== id) });
    return { ok: true };
  },

  // ===== Master Data =====
  upsertPartner: async (partner) => {
    const res = await persistIfApiMode(
      getState,
      () => apiClient.savePartner(partner),
      'Greška pri snimanju poslovnog partnera.'
    );
    if (!res.ok) return { ok: false, error: res.error };
    setState({ partners: upsertById(state.partners, partner) });
    return { ok: true };
  },

  deletePartner: async (id) => {
    const res = await persistIfApiMode(
      getState,
      () => apiClient.deletePartner(id),
      'Greška pri brisanju poslovnog partnera.'
    );
    if (!res.ok) return { ok: false, error: res.error };
    setState({ partners: state.partners.filter((p) => p.id !== id) });
    return { ok: true };
  },

  upsertItem: async (item, barcodes, bomLines, storePrices) => {
    const res = await persistIfApiMode(
      getState,
      () => apiClient.saveItem({ item, barcodes, bomLines, storePrices }),
      'Greška pri snimanju artikla.'
    );
    if (!res.ok) return { ok: false, error: res.error };

    let nextStorePrices = state.storeItemPrices;
    if (storePrices && storePrices.length > 0) {
      for (const sp of storePrices) {
        const existsIdx = nextStorePrices.findIndex(
          (p) => p.storeId === sp.storeId && p.itemId === sp.itemId
        );
        if (existsIdx >= 0) {
          nextStorePrices = nextStorePrices.map((p, i) => (i === existsIdx ? sp : p));
        } else {
          nextStorePrices = [sp, ...nextStorePrices];
        }
      }
    }

    setState({
      items: upsertById(state.items, item),
      itemBarcodes: barcodes
        ? [...state.itemBarcodes.filter((b) => b.itemId !== item.id), ...barcodes]
        : state.itemBarcodes,
      itemBomLines: bomLines
        ? [...state.itemBomLines.filter((b) => b.parentItemId !== item.id), ...bomLines]
        : state.itemBomLines,
      storeItemPrices: nextStorePrices,
    });
    return { ok: true };
  },

  deleteItem: async (id) => {
    if (state.backendMode === 'API') {
      try {
        const res = await apiClient.deleteItem(id);
        if (res?.deactivated && !res.deleted) {
          setState({
            items: state.items.map((it) => (it.id === id ? { ...it, isActive: false } : it)),
          });
        } else {
          setState({
            items: state.items.filter((it) => it.id !== id),
            itemBarcodes: state.itemBarcodes.filter((b) => b.itemId !== id),
            itemBomLines: state.itemBomLines.filter(
              (b) => b.parentItemId !== id && b.componentItemId !== id
            ),
            storeItemPrices: state.storeItemPrices.filter((p) => p.itemId !== id),
          });
        }
        return {
          ok: true,
          deleted: res?.deleted ?? true,
          deactivated: res?.deactivated ?? false,
          message: res?.message,
        };
      } catch (err) {
        return { ok: false, error: extractError(err, 'Greška pri brisanju artikla.') };
      }
    }

    setState({
      items: state.items.filter((it) => it.id !== id),
      itemBarcodes: state.itemBarcodes.filter((b) => b.itemId !== id),
      itemBomLines: state.itemBomLines.filter(
        (b) => b.parentItemId !== id && b.componentItemId !== id
      ),
      storeItemPrices: state.storeItemPrices.filter((p) => p.itemId !== id),
    });
    return { ok: true, deleted: true, deactivated: false };
  },

  upsertStoreItemPrice: async (price) => {
    const res = await persistIfApiMode(
      getState,
      () => apiClient.saveStoreItemPrice(price),
      'Greška pri snimanju cijene za poslovnicu.'
    );
    if (!res.ok) return { ok: false, error: res.error };
    const existsByComposite = state.storeItemPrices.some(
      (p) => p.id === price.id || (p.storeId === price.storeId && p.itemId === price.itemId)
    );
    setState({
      storeItemPrices: existsByComposite
        ? state.storeItemPrices.map((p) =>
            p.id === price.id || (p.storeId === price.storeId && p.itemId === price.itemId)
              ? price
              : p
          )
        : [price, ...state.storeItemPrices],
    });
    return { ok: true };
  },

  clearLabelPrintFlags: async (storeId, itemIds) => {
    const res = await persistIfApiMode(
      getState,
      () => apiClient.clearLabelPrintFlags(storeId, itemIds),
      'Greška pri čišćenju oznaka za štampu naljepnica.'
    );
    if (!res.ok) return { ok: false, error: res.error };
    setState({
      storeItemPrices: state.storeItemPrices.map((p) =>
        p.storeId === storeId && itemIds.includes(p.itemId) ? { ...p, needsLabelPrint: false } : p
      ),
    });
    return { ok: true };
  },

  saveLabelTemplate: async (tpl) => {
    const res = await persistIfApiMode(
      getState,
      () => apiClient.saveLabelTemplate(tpl),
      'Greška pri snimanju šablona naljepnice.'
    );
    if (!res.ok) return { ok: false, error: res.error };
    const saved = res.data ?? tpl;
    const baseList = saved.isDefault
      ? state.labelTemplates.map((x) => ({ ...x, isDefault: false }))
      : state.labelTemplates;
    setState({ labelTemplates: upsertById(baseList, saved) });
    return { ok: true };
  },

  deleteLabelTemplate: async (id) => {
    const res = await persistIfApiMode(
      getState,
      () => apiClient.deleteLabelTemplate(id),
      'Greška pri brisanju šablona naljepnice.'
    );
    if (!res.ok) return { ok: false, error: res.error };
    setState({ labelTemplates: state.labelTemplates.filter((x) => x.id !== id) });
    return { ok: true };
  },

  // ===== Warehouse Documents: Calculations =====
  saveCalculationDraft: async (doc) => {
    const { next, res } = saveDraftGeneric(state.calculations, doc);
    if (!res.ok) return res;
    const apiRes = await persistIfApiMode(
      getState,
      () => apiClient.saveCalculation(doc),
      'Greška pri snimanju nacrta kalkulacije.'
    );
    if (!apiRes.ok) return { ok: false, error: apiRes.error };
    setState({ calculations: next });
    return { ok: true };
  },

  postCalculation: async (docId) => {
    if (state.backendMode === 'API') {
      try {
        const posted = await apiClient.postCalculation(docId);
        await state.refreshBootstrapData();
        return {
          ok: true,
          autoLevelingDocNumber: posted?.autoLevelingDocNumber,
        };
      } catch (err) {
        return { ok: false, error: extractError(err, 'Greška pri knjiženju kalkulacije.') };
      }
    }
    return executePostCalculation(state, setState, docId);
  },

  reverseCalculation: async (docId, reason) => {
    if (state.backendMode === 'API') {
      try {
        await apiClient.reverseCalculation(docId, reason);
        await state.refreshBootstrapData();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: extractError(err, 'Greška pri storniranju kalkulacije.') };
      }
    }
    return executeReverseCalculation(state, setState, docId, reason);
  },

  deleteCalculationDraft: async (docId) => {
    const target = state.calculations.find((c) => c.id === docId);
    if (target && target.status !== 'DRAFT') {
      return { ok: false, error: t('messages.postedImmutableError') };
    }
    const res = await persistIfApiMode(
      getState,
      () => apiClient.deleteCalculation(docId),
      'Greška pri brisanju nacrta kalkulacije.'
    );
    if (!res.ok) return { ok: false, error: res.error };
    setState({ calculations: state.calculations.filter((c) => c.id !== docId) });
    return { ok: true };
  },

  // ===== Warehouse Documents: Price Levelings =====
  savePriceLevelingDraft: async (doc) => {
    const { next, res } = saveDraftGeneric(state.priceLevelings, doc);
    if (!res.ok) return res;
    const apiRes = await persistIfApiMode(
      getState,
      () => apiClient.saveLeveling(doc),
      'Greška pri snimanju nacrta nivelacije.'
    );
    if (!apiRes.ok) return { ok: false, error: apiRes.error };
    setState({ priceLevelings: next });
    return { ok: true };
  },

  postPriceLeveling: async (docId) => {
    if (state.backendMode === 'API') {
      try {
        await apiClient.postLeveling(docId);
        await state.refreshBootstrapData();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: extractError(err, 'Greška pri knjiženju nivelacije.') };
      }
    }
    return executePostPriceLeveling(state, setState, docId);
  },

  reversePriceLeveling: async (docId, reason) => {
    if (state.backendMode === 'API') {
      try {
        await apiClient.reverseLeveling(docId, reason);
        await state.refreshBootstrapData();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: extractError(err, 'Greška pri storniranju nivelacije.') };
      }
    }
    return executeReversePriceLeveling(state, setState, docId, reason);
  },

  deletePriceLevelingDraft: async (docId) => {
    const target = state.priceLevelings.find((d) => d.id === docId);
    if (target && target.status !== 'DRAFT') {
      return { ok: false, error: t('messages.postedImmutableError') };
    }
    const res = await persistIfApiMode(
      getState,
      () => apiClient.deleteLeveling(docId),
      'Greška pri brisanju nacrta nivelacije.'
    );
    if (!res.ok) return { ok: false, error: res.error };
    setState({ priceLevelings: state.priceLevelings.filter((d) => d.id !== docId) });
    return { ok: true };
  },

  // ===== Warehouse Documents: Transfers =====
  saveTransferDraft: async (doc) => {
    const { next, res } = saveDraftGeneric(state.transfers, doc);
    if (!res.ok) return res;
    const apiRes = await persistIfApiMode(
      getState,
      () => apiClient.saveTransfer(doc),
      'Greška pri snimanju nacrta međuskladišnice.'
    );
    if (!apiRes.ok) return { ok: false, error: apiRes.error };
    setState({ transfers: next });
    return { ok: true };
  },

  postTransfer: async (docId) => {
    if (state.backendMode === 'API') {
      try {
        await apiClient.postTransfer(docId);
        await state.refreshBootstrapData();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: extractError(err, 'Greška pri knjiženju međuskladišnice.') };
      }
    }
    return executePostTransfer(state, setState, docId);
  },

  reverseTransfer: async (docId, reason) => {
    if (state.backendMode === 'API') {
      try {
        await apiClient.reverseTransfer(docId, reason);
        await state.refreshBootstrapData();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: extractError(err, 'Greška pri storniranju međuskladišnice.') };
      }
    }
    return executeReverseTransfer(state, setState, docId, reason);
  },

  deleteTransferDraft: async (docId) => {
    const target = state.transfers.find((d) => d.id === docId);
    if (target && target.status !== 'DRAFT') {
      return { ok: false, error: t('messages.postedImmutableError') };
    }
    const res = await persistIfApiMode(
      getState,
      () => apiClient.deleteTransfer(docId),
      'Greška pri brisanju nacrta međuskladišnice.'
    );
    if (!res.ok) return { ok: false, error: res.error };
    setState({ transfers: state.transfers.filter((d) => d.id !== docId) });
    return { ok: true };
  },

  // ===== Warehouse Documents: Inventory Counts =====
  saveInventoryCountDraft: async (doc) => {
    const { next, res } = saveDraftGeneric(state.inventoryCounts, doc);
    if (!res.ok) return res;
    const apiRes = await persistIfApiMode(
      getState,
      () => apiClient.saveInventoryCount(doc),
      'Greška pri snimanju nacrta popisa.'
    );
    if (!apiRes.ok) return { ok: false, error: apiRes.error };
    setState({ inventoryCounts: next });
    return { ok: true };
  },

  postInventoryCount: async (docId) => {
    if (state.backendMode === 'API') {
      try {
        await apiClient.postInventoryCount(docId);
        await state.refreshBootstrapData();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: extractError(err, 'Greška pri knjiženju popisa.') };
      }
    }
    return executePostInventoryCount(state, setState, docId);
  },

  reverseInventoryCount: async (docId, reason) => {
    if (state.backendMode === 'API') {
      try {
        await apiClient.reverseInventoryCount(docId, reason);
        await state.refreshBootstrapData();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: extractError(err, 'Greška pri storniranju popisa.') };
      }
    }
    return executeReverseInventoryCount(state, setState, docId, reason);
  },

  deleteInventoryCountDraft: async (docId) => {
    const target = state.inventoryCounts.find((d) => d.id === docId);
    if (target && target.status !== 'DRAFT') {
      return { ok: false, error: t('messages.postedImmutableError') };
    }
    const res = await persistIfApiMode(
      getState,
      () => apiClient.deleteInventoryCount(docId),
      'Greška pri brisanju nacrta popisa.'
    );
    if (!res.ok) return { ok: false, error: res.error };
    setState({ inventoryCounts: state.inventoryCounts.filter((d) => d.id !== docId) });
    return { ok: true };
  },

  // ===== Warehouse Documents: Other Documents =====
  saveOtherWarehouseDraft: async (doc) => {
    const { next, res } = saveDraftGeneric(state.otherWarehouseDocs, doc);
    if (!res.ok) return res;
    const apiRes = await persistIfApiMode(
      getState,
      () => apiClient.saveOtherWarehouseDoc(doc),
      'Greška pri snimanju nacrta skladišnog dokumenta.'
    );
    if (!apiRes.ok) return { ok: false, error: apiRes.error };
    setState({ otherWarehouseDocs: next });
    return { ok: true };
  },

  postOtherWarehouseDoc: async (docId) => {
    if (state.backendMode === 'API') {
      try {
        await apiClient.postOtherWarehouseDoc(docId);
        await state.refreshBootstrapData();
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: extractError(err, 'Greška pri knjiženju skladišnog dokumenta.'),
        };
      }
    }
    return executePostOtherWarehouseDoc(state, setState, docId);
  },

  reverseOtherWarehouseDoc: async (docId, reason) => {
    if (state.backendMode === 'API') {
      try {
        await apiClient.reverseOtherWarehouseDoc(docId, reason);
        await state.refreshBootstrapData();
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: extractError(err, 'Greška pri storniranju skladišnog dokumenta.'),
        };
      }
    }
    return executeReverseOtherWarehouseDoc(state, setState, docId, reason);
  },

  deleteOtherWarehouseDraft: async (docId) => {
    const target = state.otherWarehouseDocs.find((d) => d.id === docId);
    if (target && target.status !== 'DRAFT') {
      return { ok: false, error: t('messages.postedImmutableError') };
    }
    const res = await persistIfApiMode(
      getState,
      () => apiClient.deleteOtherWarehouseDoc(docId),
      'Greška pri brisanju nacrta skladišnog dokumenta.'
    );
    if (!res.ok) return { ok: false, error: res.error };
    setState({ otherWarehouseDocs: state.otherWarehouseDocs.filter((d) => d.id !== docId) });
    return { ok: true };
  },

  // ===== POS =====
  issuePosReceipt: async (receipt) => {
    if (state.backendMode === 'API') {
      try {
        await apiClient.createPosReceipt(receipt);
        await state.refreshBootstrapData();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: extractError(err, 'Greška pri izdavanju POS računa.') };
      }
    }
    return executeIssuePosReceipt(state, setState, receipt);
  },

  refundPosReceipt: async (originalReceiptId) => {
    if (state.backendMode === 'API') {
      try {
        await apiClient.refundPosReceipt(originalReceiptId);
        await state.refreshBootstrapData();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: extractError(err, 'Greška pri reklamaciji/stornu POS računa.') };
      }
    }
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

  fiscalizePosReceipt: async (receiptId, fiscalReceiptNumber) => {
    if (state.backendMode === 'API') {
      try {
        await apiClient.fiscalizePosReceipt(receiptId, fiscalReceiptNumber);
        await state.refreshBootstrapData();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: extractError(err, 'Greška pri fiskalizaciji POS računa.') };
      }
    }
    setState({
      posReceipts: state.posReceipts.map((r) =>
        r.id === receiptId
          ? { ...r, fiscalNumber: fiscalReceiptNumber, isFiscalized: true }
          : r
      ),
    });
    return { ok: true };
  },

  holdPosReceipt: (held) => setState({ heldReceipts: [held, ...state.heldReceipts] }),
  removeHeldReceipt: (heldId) =>
    setState({ heldReceipts: state.heldReceipts.filter((h) => h.id !== heldId) }),
};

export function getAppStoreState(): AppStoreState {
  return state;
}
export function useAppStore(): AppStoreState;
export function useAppStore<T>(selector: (s: AppStoreState) => T): T;
export function useAppStore<T>(selector?: (s: AppStoreState) => T): T | AppStoreState {
  const snap = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state
  );
  return selector ? selector(snap) : snap;
}
