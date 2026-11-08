import Decimal from 'decimal.js';
import { d, round2, round4 } from '../../lib/money';
import { exportToExcelSpreadsheet } from '../../lib/excelExport';
import type { InventoryCountDocument, InventoryCountLine, Item } from '../../types/domain';

export function buildCountLine(params: {
  id: string;
  itemId: string;
  bookQuantity: string;
  countedQuantity: string;
  purchaseUnitPrice: string;
  retailUnitPriceWithVat: string;
  vatRatePercent: string;
  allowedWasteQuantity?: string;
}): InventoryCountLine {
  const book = d(params.bookQuantity);
  const counted = d(params.countedQuantity);
  const diff = counted.minus(book);
  const retailPrice = d(params.retailUnitPriceWithVat).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const surplusVal = diff.gt(0) ? diff.mul(retailPrice) : new Decimal(0);
  const totalShortageQty = diff.lt(0) ? diff.abs() : new Decimal(0);
  const shortageVal = totalShortageQty.mul(retailPrice);

  const allowedQty = Decimal.min(totalShortageQty, Decimal.max(0, d(params.allowedWasteQuantity ?? '0')));
  const allowedVal = allowedQty.mul(retailPrice);
  const unrecQty = totalShortageQty.minus(allowedQty);
  const unrecVal = unrecQty.mul(retailPrice);
  const vatRate = d(params.vatRatePercent);
  const unrecVat = unrecVal.minus(unrecVal.div(new Decimal(1).plus(vatRate.div(100)))).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    id: params.id,
    itemId: params.itemId,
    bookQuantity: round4(book),
    countedQuantity: round4(counted),
    differenceQuantity: round4(diff),
    purchaseUnitPrice: params.purchaseUnitPrice,
    retailUnitPriceWithVat: round2(retailPrice),
    vatRatePercent: params.vatRatePercent,
    surplusRetailValue: round2(surplusVal),
    shortageRetailValue: round2(shortageVal),
    allowedWasteQuantity: round4(allowedQty),
    allowedWasteRetailValue: round2(allowedVal),
    unrecognizedShortageQuantity: round4(unrecQty),
    unrecognizedShortageRetailValue: round2(unrecVal),
    unrecognizedShortageVat: round2(unrecVat),
  };
}

export function recomputeInventoryCountTotals(
  doc: InventoryCountDocument,
  nextLines: InventoryCountLine[]
): InventoryCountDocument {
  return {
    ...doc,
    lines: nextLines,
    totalSurplusRetailValue: round2(nextLines.reduce((a, l) => a.plus(d(l.surplusRetailValue)), new Decimal(0))),
    totalShortageRetailValue: round2(nextLines.reduce((a, l) => a.plus(d(l.shortageRetailValue)), new Decimal(0))),
    totalAllowedWasteValue: round2(nextLines.reduce((a, l) => a.plus(d(l.allowedWasteRetailValue ?? '0')), new Decimal(0))),
    totalUnrecognizedShortageValue: round2(nextLines.reduce((a, l) => a.plus(d(l.unrecognizedShortageRetailValue ?? '0')), new Decimal(0))),
    totalUnrecognizedShortageVat: round2(nextLines.reduce((a, l) => a.plus(d(l.unrecognizedShortageVat ?? '0')), new Decimal(0))),
  };
}

export function exportInventoryCountToExcel(doc: InventoryCountDocument, items: Item[]): void {
  exportToExcelSpreadsheet({
    fileName: `popis_${doc.docNumber}`,
    sheetName: 'Inventura',
    columns: [
      { header: 'R.br', key: 'idx', type: 'number' },
      { header: 'Šifra', key: 'sku' },
      { header: 'Naziv artikla', key: 'name' },
      { header: 'JM', key: 'uom' },
      { header: 'Knjigovodstveno', key: 'bookQuantity', type: 'number', numDecimals: 2 },
      { header: 'Popisano', key: 'countedQuantity', type: 'number', numDecimals: 2 },
      { header: 'Razlika', key: 'differenceQuantity', type: 'number', numDecimals: 2 },
      { header: 'MPC sa PDV', key: 'retailUnitPriceWithVat', type: 'number', numDecimals: 2 },
      { header: 'Višak MPC', key: 'surplusRetailValue', type: 'number', numDecimals: 2 },
      { header: 'Priznati kalo (0%)', key: 'allowedWasteRetailValue', type: 'number', numDecimals: 2 },
      { header: 'Nepriznati manjak', key: 'unrecognizedShortageRetailValue', type: 'number', numDecimals: 2 },
      { header: 'PDV na manjak (17%)', key: 'unrecognizedShortageVat', type: 'number', numDecimals: 2 },
    ],
    rows: doc.lines.map((l, idx) => {
      const item = items.find((i) => i.id === l.itemId);
      return {
        idx: idx + 1,
        sku: item?.sku ?? '',
        name: item?.name ?? '',
        uom: item?.uom ?? 'KOM',
        bookQuantity: l.bookQuantity,
        countedQuantity: l.countedQuantity,
        differenceQuantity: l.differenceQuantity,
        retailUnitPriceWithVat: l.retailUnitPriceWithVat,
        surplusRetailValue: l.surplusRetailValue,
        allowedWasteRetailValue: l.allowedWasteRetailValue ?? '0.00',
        unrecognizedShortageRetailValue: l.unrecognizedShortageRetailValue ?? l.shortageRetailValue,
        unrecognizedShortageVat: l.unrecognizedShortageVat ?? '0.00',
      };
    }),
    summaryRow: {
      name: 'UKUPNO',
      surplusRetailValue: doc.totalSurplusRetailValue,
      allowedWasteRetailValue: doc.totalAllowedWasteValue ?? '0.00',
      unrecognizedShortageRetailValue: doc.totalUnrecognizedShortageValue ?? doc.totalShortageRetailValue,
      unrecognizedShortageVat: doc.totalUnrecognizedShortageVat ?? '0.00',
    },
  });
}
