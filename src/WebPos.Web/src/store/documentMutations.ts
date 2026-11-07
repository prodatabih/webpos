import Decimal from 'decimal.js';
import { d, round2 } from '../lib/money';
import { generateUuidV7 } from '../lib/utils';
import { t } from '../i18n';
import type { PriceLevelingDocument, PriceLevelingLine } from '../types/domain';
import type { ActionResult, AppStoreState } from './useAppStore';
import {
  adjustStoreStockAndPrice,
  appendKepEntry,
  applyPosSaleStockDeduction,
  checkDateLocked,
  createAuditEntry,
} from './storeHelpers';

export function executePostCalculation(
  state: AppStoreState,
  setState: (patch: Partial<AppStoreState>) => void,
  docId: string
): ActionResult {
  const doc = state.calculations.find((c) => c.id === docId);
  if (!doc) return { ok: false, error: t('common.errorTitle') };
  if (doc.status !== 'DRAFT') return { ok: false, error: t('messages.postedImmutableError') };
  if (checkDateLocked(doc.companyId, doc.docDate, state.fiscalYears, state.fiscalPeriods)) {
    return { ok: false, error: t('messages.periodLockedError') };
  }

  let nextPrices = [...state.storeItemPrices];
  const autoLevelLines: PriceLevelingLine[] = [];

  for (const line of doc.lines) {
    const existing = nextPrices.find((p) => p.storeId === doc.storeId && p.itemId === line.itemId);
    if (
      existing &&
      d(existing.currentStockQty).gt(0) &&
      !d(existing.retailUnitPriceWithVat).eq(d(line.retailUnitPriceWithVat))
    ) {
      const stockQty = d(existing.currentStockQty);
      const oldTot = stockQty.mul(d(existing.retailUnitPriceWithVat)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const newTot = stockQty.mul(d(line.retailUnitPriceWithVat)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const diffTot = newTot.minus(oldTot);
      const vatMult = new Decimal(1).plus(d(line.vatRatePercent).div(100));
      const vatDiff = diffTot.minus(diffTot.div(vatMult).toDecimalPlaces(2, Decimal.ROUND_HALF_UP));

      autoLevelLines.push({
        id: generateUuidV7(),
        itemId: line.itemId,
        stockQuantity: existing.currentStockQty,
        oldRetailPriceWithVat: existing.retailUnitPriceWithVat,
        newRetailPriceWithVat: line.retailUnitPriceWithVat,
        vatRatePercent: line.vatRatePercent,
        oldTotalRetailValue: round2(oldTot),
        newTotalRetailValue: round2(newTot),
        totalRetailDifference: round2(diffTot),
        embeddedVatDifference: round2(vatDiff),
        marginDifference: round2(diffTot.minus(vatDiff)),
      });
    }

    nextPrices = adjustStoreStockAndPrice(nextPrices, {
      storeId: doc.storeId,
      itemId: line.itemId,
      qtyDelta: d(line.quantity),
      newPurchasePrice: line.purchaseUnitPrice,
      newWholesalePrice: line.sellingUnitPriceExclVat,
      newRetailPrice: line.retailUnitPriceWithVat,
      needsLabelPrint: true,
    });
  }

  let nextLevelings = [...state.priceLevelings];
  let nextKep = [...state.kepLedgerEntries];
  let autoLevelingDocNumber: string | undefined;

  if (autoLevelLines.length > 0) {
    const totDiff = autoLevelLines.reduce((acc, l) => acc.plus(d(l.totalRetailDifference)), new Decimal(0));
    const totVat = autoLevelLines.reduce((acc, l) => acc.plus(d(l.embeddedVatDifference)), new Decimal(0));
    const totMarg = autoLevelLines.reduce((acc, l) => acc.plus(d(l.marginDifference)), new Decimal(0));
    autoLevelingDocNumber = `NIV-AUTO-${doc.docNumber}`;
    const autoDoc: PriceLevelingDocument = {
      id: generateUuidV7(),
      companyId: doc.companyId,
      fiscalYearId: doc.fiscalYearId,
      storeId: doc.storeId,
      docNumber: autoLevelingDocNumber,
      docDate: doc.docDate,
      postingDate: doc.docDate,
      status: 'POSTED',
      reason: `${t('warehouse.autoLevelingCreated')} (${doc.docNumber})`,
      lines: autoLevelLines,
      totalRetailDifference: round2(totDiff),
      totalVatDifference: round2(totVat),
      totalMarginDifference: round2(totMarg),
      createdBy: state.currentUserName,
      createdAt: new Date().toISOString(),
    };
    nextLevelings = [autoDoc, ...nextLevelings];
    nextKep = appendKepEntry(nextKep, {
      companyId: doc.companyId,
      fiscalYearId: doc.fiscalYearId,
      storeId: doc.storeId,
      entryDate: doc.docDate,
      documentId: autoDoc.id,
      documentNumber: autoDoc.docNumber,
      documentType: 'PRICE_LEVELING',
      description: autoDoc.reason,
      debitRetailAmount: round2(totDiff),
      creditRetailAmount: '0.00',
    });
  }

  nextKep = appendKepEntry(nextKep, {
    companyId: doc.companyId,
    fiscalYearId: doc.fiscalYearId,
    storeId: doc.storeId,
    entryDate: doc.docDate,
    documentId: doc.id,
    documentNumber: doc.docNumber,
    documentType: 'CALCULATION',
    description: `${t('nav.calculations')} ${doc.docNumber}`,
    debitRetailAmount: doc.totalRetailValueWithVat,
    creditRetailAmount: '0.00',
  });

  setState({
    calculations: state.calculations.map((c) =>
      c.id === docId ? { ...c, status: 'POSTED', postingDate: doc.docDate } : c
    ),
    storeItemPrices: nextPrices,
    priceLevelings: nextLevelings,
    kepLedgerEntries: nextKep,
    auditLog: [
      createAuditEntry({
        userName: state.currentUserName,
        entityType: 'CalculationDocument',
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

  return { ok: true, autoLevelingDocNumber };
}

export function executeReverseCalculation(
  state: AppStoreState,
  setState: (patch: Partial<AppStoreState>) => void,
  docId: string,
  reason?: string
): ActionResult {
  const doc = state.calculations.find((c) => c.id === docId);
  if (!doc || doc.status !== 'POSTED') return { ok: false, error: t('common.errorTitle') };
  if (checkDateLocked(doc.companyId, doc.docDate, state.fiscalYears, state.fiscalPeriods)) {
    return { ok: false, error: t('messages.periodLockedError') };
  }
  let nextPrices = [...state.storeItemPrices];
  for (const line of doc.lines) {
    nextPrices = adjustStoreStockAndPrice(nextPrices, {
      storeId: doc.storeId,
      itemId: line.itemId,
      qtyDelta: d(line.quantity).negated(),
    });
  }
  const nextKep = appendKepEntry(state.kepLedgerEntries, {
    companyId: doc.companyId,
    fiscalYearId: doc.fiscalYearId,
    storeId: doc.storeId,
    entryDate: new Date().toISOString().slice(0, 10),
    documentId: doc.id,
    documentNumber: `STORNO-${doc.docNumber}`,
    documentType: 'CALCULATION_REVERSAL',
    description: `${t('status.REVERSED')}: ${doc.docNumber} ${reason ?? ''}`.trim(),
    debitRetailAmount: round2(d(doc.totalRetailValueWithVat).negated()),
    creditRetailAmount: '0.00',
  });
  setState({
    calculations: state.calculations.map((c) => (c.id === docId ? { ...c, status: 'REVERSED' } : c)),
    storeItemPrices: nextPrices,
    kepLedgerEntries: nextKep,
    auditLog: [
      createAuditEntry({
        userName: state.currentUserName,
        entityType: 'CalculationDocument',
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

export function executeIssuePosReceipt(
  state: AppStoreState,
  setState: (patch: Partial<AppStoreState>) => void,
  receipt: AppStoreState['posReceipts'][number]
): ActionResult {
  let nextPrices = [...state.storeItemPrices];
  const sign = receipt.receiptType === 'REFUND' ? new Decimal(-1) : new Decimal(1);
  for (const line of receipt.lines) {
    nextPrices = applyPosSaleStockDeduction(
      nextPrices,
      receipt.storeId,
      line.itemId,
      d(line.quantity).mul(sign),
      state.items,
      state.itemBomLines
    );
  }
  const creditAmount =
    receipt.receiptType === 'REFUND'
      ? round2(d(receipt.totalGrossAmount).negated())
      : receipt.totalGrossAmount;
  const nextKep = appendKepEntry(state.kepLedgerEntries, {
    companyId: receipt.companyId,
    fiscalYearId: receipt.fiscalYearId,
    storeId: receipt.storeId,
    entryDate: receipt.issuedAt.slice(0, 10),
    documentId: receipt.id,
    documentNumber: receipt.receiptNumber,
    documentType: 'POS_RECEIPT',
    description: `${t('nav.posRegister')} ${receipt.receiptNumber} (${receipt.fiscalNumber})`,
    debitRetailAmount: '0.00',
    creditRetailAmount: creditAmount,
  });
  setState({
    posReceipts: [receipt, ...state.posReceipts],
    storeItemPrices: nextPrices,
    kepLedgerEntries: nextKep,
    posTerminals: state.posTerminals.map((term) =>
      term.id === receipt.terminalId ? { ...term, lastSequenceNumber: term.lastSequenceNumber + 1 } : term
    ),
    auditLog: [
      createAuditEntry({
        userName: state.currentUserName,
        entityType: 'PosReceipt',
        entityId: receipt.id,
        entityCode: receipt.receiptNumber,
        action: 'POST',
        summary: `${t('messages.receiptIssued')} (${receipt.receiptNumber})`,
        previousState: 'DRAFT',
        newState: 'POSTED',
      }),
      ...state.auditLog,
    ],
  });
  return { ok: true };
}
