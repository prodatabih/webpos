import Decimal from 'decimal.js';
import { d, round2, round4 } from '../lib/money';
import { generateUuidV7 } from '../lib/utils';
import type {
  AuditLogEntry,
  FiscalPeriod,
  FiscalYear,
  Item,
  ItemBomLine,
  KepLedgerEntry,
  StoreItemPrice,
} from '../types/domain';

export function checkDateLocked(
  companyId: string,
  dateStr: string,
  fiscalYears: FiscalYear[],
  fiscalPeriods: FiscalPeriod[]
): boolean {
  const yearNum = Number(dateStr.slice(0, 4));
  const fy = fiscalYears.find((y) => y.companyId === companyId && y.year === yearNum);
  if (fy?.isLocked) return true;
  const period = fiscalPeriods.find(
    (p) => p.companyId === companyId && dateStr >= p.startDate && dateStr <= p.endDate
  );
  return Boolean(period?.isLocked);
}

export function appendKepEntry(
  entries: KepLedgerEntry[],
  params: {
    companyId: string;
    fiscalYearId: string;
    storeId: string;
    entryDate: string;
    documentId: string;
    documentNumber: string;
    documentType: string;
    description: string;
    debitRetailAmount: string;
    creditRetailAmount: string;
  }
): KepLedgerEntry[] {
  const storeEntries = entries.filter(
    (e) => e.storeId === params.storeId && e.fiscalYearId === params.fiscalYearId
  );
  const lastEntry = storeEntries[storeEntries.length - 1];
  const prevBalance = d(lastEntry?.runningBalanceAmount ?? '0.00');
  const nextBalance = prevBalance
    .plus(d(params.debitRetailAmount))
    .minus(d(params.creditRetailAmount));

  const newEntry: KepLedgerEntry = {
    id: generateUuidV7(),
    companyId: params.companyId,
    fiscalYearId: params.fiscalYearId,
    storeId: params.storeId,
    entryNumber: storeEntries.length + 1,
    entryDate: params.entryDate,
    documentId: params.documentId,
    documentNumber: params.documentNumber,
    documentType: params.documentType,
    description: params.description,
    debitRetailAmount: round2(params.debitRetailAmount),
    creditRetailAmount: round2(params.creditRetailAmount),
    runningBalanceAmount: round2(nextBalance),
  };

  return [...entries, newEntry];
}

export function createAuditEntry(params: {
  userName: string;
  entityType: string;
  entityId: string;
  entityCode: string;
  action: AuditLogEntry['action'];
  summary: string;
  previousState?: string;
  newState?: string;
}): AuditLogEntry {
  return {
    id: generateUuidV7(),
    timestamp: new Date().toISOString(),
    userId: 'usr-active',
    userName: params.userName,
    entityType: params.entityType,
    entityId: params.entityId,
    entityCode: params.entityCode,
    action: params.action,
    summary: params.summary,
    previousState: params.previousState,
    newState: params.newState,
  };
}

export function adjustStoreStockAndPrice(
  prices: StoreItemPrice[],
  params: {
    storeId: string;
    itemId: string;
    qtyDelta: Decimal;
    newPurchasePrice?: string;
    newWholesalePrice?: string;
    newRetailPrice?: string;
    needsLabelPrint?: boolean;
  }
): StoreItemPrice[] {
  const idx = prices.findIndex(
    (p) => p.storeId === params.storeId && p.itemId === params.itemId
  );
  const nowIso = new Date().toISOString();

  if (idx === -1) {
    const created: StoreItemPrice = {
      id: generateUuidV7(),
      storeId: params.storeId,
      itemId: params.itemId,
      purchaseUnitPrice: round4(params.newPurchasePrice ?? '0'),
      wholesaleUnitPriceExclVat: round4(params.newWholesalePrice ?? '0'),
      retailUnitPriceWithVat: round2(params.newRetailPrice ?? '0'),
      lowestPrice30Days: round2(params.newRetailPrice ?? '0'),
      currentStockQty: round4(params.qtyDelta),
      minStockQty: '10.0000',
      shelfLocation: 'A-01-01',
      needsLabelPrint: Boolean(params.needsLabelPrint),
      updatedAt: nowIso,
    };
    return [...prices, created];
  }

  return prices.map((existing, i) => {
    if (i !== idx) return existing;
    const nextQty = d(existing.currentStockQty).plus(params.qtyDelta);
    return {
      ...existing,
      purchaseUnitPrice:
        params.newPurchasePrice !== undefined
          ? round4(params.newPurchasePrice)
          : existing.purchaseUnitPrice,
      wholesaleUnitPriceExclVat:
        params.newWholesalePrice !== undefined
          ? round4(params.newWholesalePrice)
          : existing.wholesaleUnitPriceExclVat,
      retailUnitPriceWithVat:
        params.newRetailPrice !== undefined
          ? round2(params.newRetailPrice)
          : existing.retailUnitPriceWithVat,
      currentStockQty: round4(nextQty),
      needsLabelPrint:
        params.needsLabelPrint !== undefined
          ? params.needsLabelPrint
          : existing.needsLabelPrint,
      updatedAt: nowIso,
    };
  });
}

export function applyPosSaleStockDeduction(
  prices: StoreItemPrice[],
  storeId: string,
  soldItemId: string,
  soldQty: Decimal,
  items: Item[],
  bomLines: ItemBomLine[]
): StoreItemPrice[] {
  const item = items.find((it) => it.id === soldItemId);
  if (!item || item.itemType === 'SERVICE') {
    return prices;
  }

  let nextPrices = adjustStoreStockAndPrice(prices, {
    storeId,
    itemId: soldItemId,
    qtyDelta: soldQty.negated(),
  });

  if (item.itemType === 'COMPOSITE' && item.normativeMode === 'ON_SALE_BACKFLUSH') {
    const components = bomLines.filter((b) => b.parentItemId === item.id);
    for (const comp of components) {
      const wasteFactor = new Decimal(1).plus(d(comp.wastePercent).div(100));
      const compDeduction = soldQty.mul(d(comp.quantity)).mul(wasteFactor);
      nextPrices = adjustStoreStockAndPrice(nextPrices, {
        storeId,
        itemId: comp.componentItemId,
        qtyDelta: compDeduction.negated(),
      });
    }
  }

  return nextPrices;
}
