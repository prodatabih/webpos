import { d, round2 } from '../lib/money';
import { t } from '../i18n';
import type { ActionResult, AppStoreState } from './useAppStore';
import {
  adjustStoreStockAndPrice,
  appendKepEntry,
  checkDateLocked,
  createAuditEntry,
} from './storeHelpers';

export function executePostInventoryCount(
  state: AppStoreState,
  setState: (patch: Partial<AppStoreState>) => void,
  docId: string
): ActionResult {
  const doc = state.inventoryCounts.find((ic) => ic.id === docId);
  if (!doc || doc.status !== 'DRAFT') return { ok: false, error: t('messages.postedImmutableError') };
  if (checkDateLocked(doc.companyId, doc.docDate, state.fiscalYears, state.fiscalPeriods)) {
    return { ok: false, error: t('messages.periodLockedError') };
  }
  let nextPrices = [...state.storeItemPrices];
  for (const line of doc.lines) {
    nextPrices = adjustStoreStockAndPrice(nextPrices, {
      storeId: doc.storeId,
      itemId: line.itemId,
      qtyDelta: d(line.differenceQuantity),
    });
  }
  const nextKep = appendKepEntry(state.kepLedgerEntries, {
    companyId: doc.companyId,
    fiscalYearId: doc.fiscalYearId,
    storeId: doc.storeId,
    entryDate: doc.docDate,
    documentId: doc.id,
    documentNumber: doc.docNumber,
    documentType: 'INVENTORY_COUNT',
    description: `${t('nav.inventoryCount')} ${doc.docNumber}`,
    debitRetailAmount: doc.totalSurplusRetailValue,
    creditRetailAmount: doc.totalShortageRetailValue,
  });
  setState({
    inventoryCounts: state.inventoryCounts.map((ic) =>
      ic.id === docId
        ? {
            ...ic,
            status: 'POSTED',
            postingDate: doc.docDate,
            totalAllowedWasteValue: doc.totalAllowedWasteValue ?? '0.00',
            totalUnrecognizedShortageValue: doc.totalUnrecognizedShortageValue ?? doc.totalShortageRetailValue,
            totalUnrecognizedShortageVat: doc.totalUnrecognizedShortageVat ?? '0.00',
          }
        : ic
    ),
    storeItemPrices: nextPrices,
    kepLedgerEntries: nextKep,
    auditLog: [
      createAuditEntry({
        userName: state.currentUserName,
        entityType: 'InventoryCountDocument',
        entityId: doc.id,
        entityCode: doc.docNumber,
        action: 'POST',
        summary: `${t('messages.documentPosted')} (${doc.docNumber}) [Višak: ${doc.totalSurplusRetailValue} KM | Kalo 0%: ${doc.totalAllowedWasteValue ?? '0.00'} KM | Manjak 17%: ${doc.totalUnrecognizedShortageValue ?? doc.totalShortageRetailValue} KM, PDV: ${doc.totalUnrecognizedShortageVat ?? '0.00'} KM]`,
        previousState: 'DRAFT',
        newState: 'POSTED',
      }),
      ...state.auditLog,
    ],
  });
  return { ok: true };
}

export function executeReverseInventoryCount(
  state: AppStoreState,
  setState: (patch: Partial<AppStoreState>) => void,
  docId: string,
  reason?: string
): ActionResult {
  const doc = state.inventoryCounts.find((ic) => ic.id === docId);
  if (!doc || doc.status !== 'POSTED') return { ok: false, error: t('common.errorTitle') };
  if (checkDateLocked(doc.companyId, doc.docDate, state.fiscalYears, state.fiscalPeriods)) {
    return { ok: false, error: t('messages.periodLockedError') };
  }
  let nextPrices = [...state.storeItemPrices];
  for (const line of doc.lines) {
    nextPrices = adjustStoreStockAndPrice(nextPrices, {
      storeId: doc.storeId,
      itemId: line.itemId,
      qtyDelta: d(line.differenceQuantity).negated(),
    });
  }
  const nextKep = appendKepEntry(state.kepLedgerEntries, {
    companyId: doc.companyId,
    fiscalYearId: doc.fiscalYearId,
    storeId: doc.storeId,
    entryDate: new Date().toISOString().slice(0, 10),
    documentId: doc.id,
    documentNumber: `STORNO-${doc.docNumber}`,
    documentType: 'INVENTORY_COUNT_REVERSAL',
    description: `${t('status.REVERSED')}: ${doc.docNumber} ${reason ?? ''}`.trim(),
    debitRetailAmount: round2(d(doc.totalSurplusRetailValue).negated()),
    creditRetailAmount: round2(d(doc.totalShortageRetailValue).negated()),
  });
  setState({
    inventoryCounts: state.inventoryCounts.map((ic) =>
      ic.id === docId ? { ...ic, status: 'REVERSED' } : ic
    ),
    storeItemPrices: nextPrices,
    kepLedgerEntries: nextKep,
    auditLog: [
      createAuditEntry({
        userName: state.currentUserName,
        entityType: 'InventoryCountDocument',
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

export function executePostOtherWarehouseDoc(
  state: AppStoreState,
  setState: (patch: Partial<AppStoreState>) => void,
  docId: string
): ActionResult {
  const doc = state.otherWarehouseDocs.find((ow) => ow.id === docId);
  if (!doc || doc.status !== 'DRAFT') return { ok: false, error: t('messages.postedImmutableError') };
  if (checkDateLocked(doc.companyId, doc.docDate, state.fiscalYears, state.fiscalPeriods)) {
    return { ok: false, error: t('messages.periodLockedError') };
  }
  const isReceipt = doc.subtype === 'INTERNAL_RECEIPT' || doc.subtype === 'INTERNAL_PRODUCTION';
  let nextPrices = [...state.storeItemPrices];
  for (const line of doc.lines) {
    nextPrices = adjustStoreStockAndPrice(nextPrices, {
      storeId: doc.storeId,
      itemId: line.itemId,
      qtyDelta: isReceipt ? d(line.quantity) : d(line.quantity).negated(),
    });
  }
  const nextKep = appendKepEntry(state.kepLedgerEntries, {
    companyId: doc.companyId,
    fiscalYearId: doc.fiscalYearId,
    storeId: doc.storeId,
    entryDate: doc.docDate,
    documentId: doc.id,
    documentNumber: doc.docNumber,
    documentType: doc.subtype,
    description: `${t('nav.otherWarehouseDocs')} ${doc.docNumber}`,
    debitRetailAmount: isReceipt ? doc.totalRetailValueWithVat : '0.00',
    creditRetailAmount: isReceipt ? '0.00' : doc.totalRetailValueWithVat,
  });
  setState({
    otherWarehouseDocs: state.otherWarehouseDocs.map((ow) =>
      ow.id === docId ? { ...ow, status: 'POSTED', postingDate: doc.docDate } : ow
    ),
    storeItemPrices: nextPrices,
    kepLedgerEntries: nextKep,
    auditLog: [
      createAuditEntry({
        userName: state.currentUserName,
        entityType: 'OtherWarehouseDocument',
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

export function executeReverseOtherWarehouseDoc(
  state: AppStoreState,
  setState: (patch: Partial<AppStoreState>) => void,
  docId: string,
  reason?: string
): ActionResult {
  const doc = state.otherWarehouseDocs.find((ow) => ow.id === docId);
  if (!doc || doc.status !== 'POSTED') return { ok: false, error: t('common.errorTitle') };
  if (checkDateLocked(doc.companyId, doc.docDate, state.fiscalYears, state.fiscalPeriods)) {
    return { ok: false, error: t('messages.periodLockedError') };
  }
  const isReceipt = doc.subtype === 'INTERNAL_RECEIPT' || doc.subtype === 'INTERNAL_PRODUCTION';
  let nextPrices = [...state.storeItemPrices];
  for (const line of doc.lines) {
    nextPrices = adjustStoreStockAndPrice(nextPrices, {
      storeId: doc.storeId,
      itemId: line.itemId,
      qtyDelta: isReceipt ? d(line.quantity).negated() : d(line.quantity),
    });
  }
  const nextKep = appendKepEntry(state.kepLedgerEntries, {
    companyId: doc.companyId,
    fiscalYearId: doc.fiscalYearId,
    storeId: doc.storeId,
    entryDate: new Date().toISOString().slice(0, 10),
    documentId: doc.id,
    documentNumber: `STORNO-${doc.docNumber}`,
    documentType: `${doc.subtype}_REVERSAL`,
    description: `${t('status.REVERSED')}: ${doc.docNumber} ${reason ?? ''}`.trim(),
    debitRetailAmount: isReceipt ? round2(d(doc.totalRetailValueWithVat).negated()) : '0.00',
    creditRetailAmount: isReceipt ? '0.00' : round2(d(doc.totalRetailValueWithVat).negated()),
  });
  setState({
    otherWarehouseDocs: state.otherWarehouseDocs.map((ow) =>
      ow.id === docId ? { ...ow, status: 'REVERSED' } : ow
    ),
    storeItemPrices: nextPrices,
    kepLedgerEntries: nextKep,
    auditLog: [
      createAuditEntry({
        userName: state.currentUserName,
        entityType: 'OtherWarehouseDocument',
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
