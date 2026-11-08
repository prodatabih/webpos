import Decimal from 'decimal.js';
import { calculateCalculationLine, d, round2, round4 } from '../../lib/money';
import type { CalculationDocument, CalculationLine } from '../../types/domain';

export function recomputeCalculationWithZtr(
  doc: CalculationDocument,
  baseLines: CalculationLine[],
  ztrVal: string,
  method: 'VALUE' | 'QUANTITY',
  freight: string,
  customs: string,
  handling: string,
  other: string,
  overrideLineId?: string,
  overrideField?: 'quantity' | 'supplierUnitPrice' | 'discountPercent' | 'marginPercent' | 'retailUnitPriceWithVat',
  overrideVal?: string
): CalculationDocument {
  const totalZtrDec = d(ztrVal);
  const prepared = baseLines.map((l) => {
    if (l.id !== overrideLineId) return l;
    return {
      ...l,
      quantity: overrideField === 'quantity' && overrideVal !== undefined ? overrideVal : l.quantity,
      supplierUnitPrice: overrideField === 'supplierUnitPrice' && overrideVal !== undefined ? overrideVal : l.supplierUnitPrice,
      discountPercent: overrideField === 'discountPercent' && overrideVal !== undefined ? overrideVal : l.discountPercent,
      marginPercent: overrideField === 'marginPercent' && overrideVal !== undefined ? overrideVal : l.marginPercent,
      retailUnitPriceWithVat: overrideField === 'retailUnitPriceWithVat' && overrideVal !== undefined ? overrideVal : l.retailUnitPriceWithVat,
    };
  });

  const totalNetInv = prepared.reduce((acc, l) => {
    const net = d(l.supplierUnitPrice).mul(new Decimal(1).minus(d(l.discountPercent).div(100)));
    return acc.plus(net.mul(d(l.quantity)));
  }, new Decimal(0));
  const totalQty = prepared.reduce((acc, l) => acc.plus(d(l.quantity)), new Decimal(0));

  const nextLines = prepared.map((l) => {
    let unitZtr = new Decimal(0);
    if (totalZtrDec.gt(0)) {
      if (method === 'VALUE' && totalNetInv.gt(0)) {
        const lineNet = d(l.supplierUnitPrice).mul(new Decimal(1).minus(d(l.discountPercent).div(100))).mul(d(l.quantity));
        unitZtr = d(l.quantity).gt(0) ? lineNet.div(totalNetInv).mul(totalZtrDec).div(d(l.quantity)) : new Decimal(0);
      } else if (method === 'QUANTITY' && totalQty.gt(0)) {
        unitZtr = totalZtrDec.div(totalQty);
      }
    }
    const calc = calculateCalculationLine({
      quantity: l.quantity,
      supplierUnitPrice: l.supplierUnitPrice,
      discountPercent: l.discountPercent,
      dependentCostPerUnit: round4(unitZtr),
      marginPercent: overrideLineId === l.id && overrideField === 'retailUnitPriceWithVat' ? undefined : l.marginPercent,
      targetRetailPriceWithVat:
        overrideLineId === l.id && overrideField === 'retailUnitPriceWithVat'
          ? overrideVal
          : overrideLineId === l.id && overrideField === 'marginPercent'
          ? undefined
          : l.retailUnitPriceWithVat,
      vatRatePercent: l.vatRatePercent,
    });
    return { ...l, ...calc };
  });

  return {
    ...doc,
    ztrFreight: freight,
    ztrCustoms: customs,
    ztrHandling: handling,
    ztrOther: other,
    ztrAllocationMethod: method,
    lines: nextLines,
    totalPurchaseValue: round2(nextLines.reduce((a, l) => a.plus(d(l.purchaseTotalValue)), new Decimal(0))),
    totalMarginAmount: round2(nextLines.reduce((a, l) => a.plus(d(l.marginTotalAmount)), new Decimal(0))),
    totalSellingValueExclVat: round2(nextLines.reduce((a, l) => a.plus(d(l.sellingTotalValueExclVat)), new Decimal(0))),
    totalEmbeddedVatAmount: round2(nextLines.reduce((a, l) => a.plus(d(l.embeddedVatTotalAmount)), new Decimal(0))),
    totalRetailValueWithVat: round2(nextLines.reduce((a, l) => a.plus(d(l.retailTotalValueWithVat)), new Decimal(0))),
  };
}
