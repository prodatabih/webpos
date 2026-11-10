import Decimal from 'decimal.js';
import { d, round2 } from '../../lib/money';
import { generateUuidV7 } from '../../lib/utils';
import type { PriceLevelingDocument, PriceLevelingLine } from '../../types/domain';

export function buildLevelingLine(params: {
  id?: string;
  itemId: string;
  stockQuantity: string;
  oldRetailPriceWithVat: string;
  newRetailPriceWithVat: string;
  vatRatePercent: string;
}): PriceLevelingLine {
  const qty = d(params.stockQuantity || '0');
  const oldPrice = d(params.oldRetailPriceWithVat || '0');
  const newPrice = d(params.newRetailPriceWithVat || '0');
  const vatRate = d(params.vatRatePercent || '17.00');
  const vatDivisor = new Decimal(1).plus(vatRate.div(100));

  const oldTotDec = qty.mul(oldPrice);
  const newTotDec = qty.mul(newPrice);
  const diffTotDec = newTotDec.minus(oldTotDec);
  const vatDiffDec = diffTotDec.minus(diffTotDec.div(vatDivisor));
  const marginDiffDec = diffTotDec.minus(vatDiffDec);

  return {
    id: params.id ?? generateUuidV7(),
    itemId: params.itemId,
    stockQuantity: params.stockQuantity || '0.0000',
    oldRetailPriceWithVat: round2(oldPrice),
    newRetailPriceWithVat: round2(newPrice),
    vatRatePercent: round2(vatRate),
    oldTotalRetailValue: round2(oldTotDec),
    newTotalRetailValue: round2(newTotDec),
    totalRetailDifference: round2(diffTotDec),
    embeddedVatDifference: round2(vatDiffDec),
    marginDifference: round2(marginDiffDec),
  };
}

export function buildBlankLevelingLine(): PriceLevelingLine {
  return {
    id: generateUuidV7(),
    itemId: '',
    stockQuantity: '0.0000',
    oldRetailPriceWithVat: '0.00',
    newRetailPriceWithVat: '0.00',
    vatRatePercent: '17.00',
    oldTotalRetailValue: '0.00',
    newTotalRetailValue: '0.00',
    totalRetailDifference: '0.00',
    embeddedVatDifference: '0.00',
    marginDifference: '0.00',
  };
}

export function recomputeLevelingDocTotals(
  doc: PriceLevelingDocument,
  nextLines: PriceLevelingLine[]
): PriceLevelingDocument {
  const totalRetailDiff = round2(
    nextLines.reduce((acc, l) => acc.plus(d(l.totalRetailDifference || '0')), new Decimal(0))
  );
  const totalVatDiff = round2(
    nextLines.reduce((acc, l) => acc.plus(d(l.embeddedVatDifference || '0')), new Decimal(0))
  );
  const totalMarginDiff = round2(
    nextLines.reduce((acc, l) => acc.plus(d(l.marginDifference || '0')), new Decimal(0))
  );

  return {
    ...doc,
    lines: nextLines,
    totalRetailDifference: totalRetailDiff,
    totalVatDifference: totalVatDiff,
    totalMarginDifference: totalMarginDiff,
  };
}
