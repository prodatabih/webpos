import Decimal from 'decimal.js';
import { d, round2 } from '../lib/money';
import { t } from '../i18n';
import type { ActionResult, AppStoreState } from './useAppStore';
import {
  adjustStoreStockAndPrice,
  appendKepEntry,
  checkDateLocked,
  createAuditEntry,
} from './storeHelpers';

export function executePostPriceLeveling(
  state: AppStoreState,
  setState: (patch: Partial<AppStoreState>) => void,
  docId: string
): ActionResult {
  const doc = state.priceLevelings.find((p) => p.id === docId);
  if (!doc || doc.status !== 'DRAFT') return { ok: false, error: t('messages.postedImmutableError') };
  if (checkDateLocked(doc.companyId, doc.docDate, state.fiscalYears, state.fiscalPeriods)) {
    return { ok: false, error: t('messages.periodLockedError') };
  }
  let nextPrices = [...state.storeItemPrices];
  for (const line of doc.lines) {
    nextPrices = adjustStoreStockAndPrice(nextPrices, {
      storeId: doc.storeId,
      itemId: line.itemId,
      qtyDelta: new Decimal(0),
      newRetailPrice: line.newRetailPriceWithVat,
      needsLabelPrint: true,
    });
  }
  const nextKep = appendKepEntry(state.kepLedgerEntries, {
    companyId: doc.companyId,
    fiscalYearId: doc.fiscalYearId,
    storeId: doc.storeId,
    entryDate: doc.docDate,
    documentId: doc.id,
    documentNumber: doc.docNumber,
    documentType: 'PRICE_LEVELING',
    description: `${t('nav.priceLeveling')} ${doc.docNumber}`,
    debitRetailAmount: doc.totalRetailDifference,
    creditRetailAmount: '0.00',
  });
  setState({
    priceLevelings: state.priceLevelings.map((p) =>
      p.id === docId ? { ...p, status: 'POSTED', postingDate: doc.docDate } : p
    ),
    storeItemPrices: nextPrices,
    kepLedgerEntries: nextKep,
    auditLog: [
      createAuditEntry({
        userName: state.currentUserName,
        entityType: 'PriceLevelingDocument',
        entityId: doc.id,
        entityCode: doc.docNumber,
        action: 'POST',
        summary: `${t('messages.documentPosted')} (${doc.docNumber})`,
        previousState: 'DRAFT',
        newState: 'POSTED',
      }),
      ...state.auditLog,
    ],
  });
  return { ok: true };
}

export function executeReversePriceLeveling(
  state: AppStoreState,
  setState: (patch: Partial<AppStoreState>) => void,
  docId: string,
  reason?: string
): ActionResult {
  const doc = state.priceLevelings.find((p) => p.id === docId);
  if (!doc || doc.status !== 'POSTED') return { ok: false, error: t('common.errorTitle') };
  if (checkDateLocked(doc.companyId, doc.docDate, state.fiscalYears, state.fiscalPeriods)) {
    return { ok: false, error: t('messages.periodLockedError') };
  }
  let nextPrices = [...state.storeItemPrices];
  for (const line of doc.lines) {
    nextPrices = adjustStoreStockAndPrice(nextPrices, {
      storeId: doc.storeId,
      itemId: line.itemId,
      qtyDelta: new Decimal(0),
      newRetailPrice: line.oldRetailPriceWithVat,
      needsLabelPrint: true,
    });
  }
  const nextKep = appendKepEntry(state.kepLedgerEntries, {
    companyId: doc.companyId,
    fiscalYearId: doc.fiscalYearId,
    storeId: doc.storeId,
    entryDate: new Date().toISOString().slice(0, 10),
    documentId: doc.id,
    documentNumber: `STORNO-${doc.docNumber}`,
    documentType: 'PRICE_LEVELING_REVERSAL',
    description: `${t('status.REVERSED')}: ${doc.docNumber} ${reason ?? ''}`.trim(),
    debitRetailAmount: round2(d(doc.totalRetailDifference).negated()),
    creditRetailAmount: '0.00',
  });
  setState({
    priceLevelings: state.priceLevelings.map((p) => (p.id === docId ? { ...p, status: 'REVERSED' } : p)),
    storeItemPrices: nextPrices,
    kepLedgerEntries: nextKep,
    auditLog: [
      createAuditEntry({
        userName: state.currentUserName,
        entityType: 'PriceLevelingDocument',
        entityId: doc.id,
        entityCode: doc.docNumber,
        action: 'REVERSE',
        summary: `${t('messages.documentReversed')}: ${doc.docNumber}`,
        previousState: 'POSTED',
        newState: 'REVERSED',
      }),
      ...state.auditLog,
    ],
  });
  return { ok: true };
}

export function executePostTransfer(
  state: AppStoreState,
  setState: (patch: Partial<AppStoreState>) => void,
  docId: string
): ActionResult {
  const doc = state.transfers.find((tr) => tr.id === docId);
  if (!doc || doc.status !== 'DRAFT') return { ok: false, error: t('messages.postedImmutableError') };
  if (checkDateLocked(doc.companyId, doc.docDate, state.fiscalYears, state.fiscalPeriods)) {
    return { ok: false, error: t('messages.periodLockedError') };
  }
  let nextPrices = [...state.storeItemPrices];
  for (const line of doc.lines) {
    nextPrices = adjustStoreStockAndPrice(nextPrices, {
      storeId: doc.sourceStoreId,
      itemId: line.itemId,
      qtyDelta: d(line.quantity).negated(),
    });
    nextPrices = adjustStoreStockAndPrice(nextPrices, {
      storeId: doc.targetStoreId,
      itemId: line.itemId,
      qtyDelta: d(line.quantity),
      newPurchasePrice: line.purchaseUnitPrice,
      newRetailPrice: line.targetRetailUnitPrice,
    });
  }
  let nextKep = appendKepEntry(state.kepLedgerEntries, {
    companyId: doc.companyId,
    fiscalYearId: doc.fiscalYearId,
    storeId: doc.sourceStoreId,
    entryDate: doc.docDate,
    documentId: doc.id,
    documentNumber: doc.docNumber,
    documentType: 'TRANSFER_OUT',
    description: `${t('nav.transfers')} (-): ${doc.docNumber}`,
    debitRetailAmount: '0.00',
    creditRetailAmount: doc.totalSourceRetailValue,
  });
  nextKep = appendKepEntry(nextKep, {
    companyId: doc.companyId,
    fiscalYearId: doc.fiscalYearId,
    storeId: doc.targetStoreId,
    entryDate: doc.docDate,
    documentId: doc.id,
    documentNumber: doc.docNumber,
    documentType: 'TRANSFER_IN',
    description: `${t('nav.transfers')} (+): ${doc.docNumber}`,
    debitRetailAmount: doc.totalTargetRetailValue,
    creditRetailAmount: '0.00',
  });
  setState({
    transfers: state.transfers.map((tr) =>
      tr.id === docId ? { ...tr, status: 'POSTED', postingDate: doc.docDate } : tr
    ),
    storeItemPrices: nextPrices,
    kepLedgerEntries: nextKep,
    auditLog: [
      createAuditEntry({
        userName: state.currentUserName,
        entityType: 'TransferDocument',
        entityId: doc.id,
        entityCode: doc.docNumber,
        action: 'POST',
        summary: `${t('messages.documentPosted')} (${doc.docNumber})`,
        previousState: 'DRAFT',
        newState: 'POSTED',
      }),
      ...state.auditLog,
    ],
  });
  return { ok: true };
}

export function executeReverseTransfer(
  state: AppStoreState,
  setState: (patch: Partial<AppStoreState>) => void,
  docId: string,
  reason?: string
): ActionResult {
  const doc = state.transfers.find((tr) => tr.id === docId);
  if (!doc || doc.status !== 'POSTED') return { ok: false, error: t('common.errorTitle') };
  if (checkDateLocked(doc.companyId, doc.docDate, state.fiscalYears, state.fiscalPeriods)) {
    return { ok: false, error: t('messages.periodLockedError') };
  }
  let nextPrices = [...state.storeItemPrices];
  for (const line of doc.lines) {
    nextPrices = adjustStoreStockAndPrice(nextPrices, { storeId: doc.sourceStoreId, itemId: line.itemId, qtyDelta: d(line.quantity) });
    nextPrices = adjustStoreStockAndPrice(nextPrices, { storeId: doc.targetStoreId, itemId: line.itemId, qtyDelta: d(line.quantity).negated() });
  }
  const today = new Date().toISOString().slice(0, 10);
  let nextKep = appendKepEntry(state.kepLedgerEntries, {
    companyId: doc.companyId,
    fiscalYearId: doc.fiscalYearId,
    storeId: doc.sourceStoreId,
    entryDate: today,
    documentId: doc.id,
    documentNumber: `STORNO-${doc.docNumber}`,
    documentType: 'TRANSFER_REVERSAL',
    description: `${t('status.REVERSED')}: ${doc.docNumber} ${reason ?? ''}`.trim(),
    debitRetailAmount: '0.00',
    creditRetailAmount: round2(d(doc.totalSourceRetailValue).negated()),
  });
  nextKep = appendKepEntry(nextKep, {
    companyId: doc.companyId,
    fiscalYearId: doc.fiscalYearId,
    storeId: doc.targetStoreId,
    entryDate: today,
    documentId: doc.id,
    documentNumber: `STORNO-${doc.docNumber}`,
    documentType: 'TRANSFER_REVERSAL',
    description: `${t('status.REVERSED')}: ${doc.docNumber} ${reason ?? ''}`.trim(),
    debitRetailAmount: round2(d(doc.totalTargetRetailValue).negated()),
    creditRetailAmount: '0.00',
  });
  setState({
    transfers: state.transfers.map((tr) => (tr.id === docId ? { ...tr, status: 'REVERSED' } : tr)),
    storeItemPrices: nextPrices,
    kepLedgerEntries: nextKep,
    auditLog: [
      createAuditEntry({
        userName: state.currentUserName,
        entityType: 'TransferDocument',
        entityId: doc.id,
        entityCode: doc.docNumber,
        action: 'REVERSE',
        summary: `${t('messages.documentReversed')}: ${doc.docNumber}`,
        previousState: 'POSTED',
        newState: 'REVERSED',
      }),
      ...state.auditLog,
    ],
  });
  return { ok: true };
}
