import Decimal from 'decimal.js';
import { calculateCalculationLine, d, round2, round4 } from '../../lib/money';
import type { CalculationDocument, CalculationLine, StoreType } from '../../types/domain';

export type CalculationLineField =
  | 'quantity'
  | 'supplierUnitPrice'
  | 'discountPercent'
  | 'marginPercent'
  | 'retailUnitPriceWithVat'
  | 'sellingUnitPriceExclVat';

export function recomputeCalculationWithZtr(
  doc: CalculationDocument,
  baseLines: CalculationLine[],
  ztrVal: string,
  method: 'VALUE' | 'QUANTITY',
  freight: string,
  customs: string,
  handling: string,
  other: string,
  storeType: StoreType = 'RETAIL',
  overrideLineId?: string,
  overrideField?: CalculationLineField,
  overrideVal?: string
): CalculationDocument {
  const isRaw = storeType === 'RAW_MATERIAL' || storeType === 'PRODUCTION';
  const isWholesale = storeType === 'WHOLESALE';
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
      sellingUnitPriceExclVat: overrideField === 'sellingUnitPriceExclVat' && overrideVal !== undefined ? overrideVal : l.sellingUnitPriceExclVat,
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

    if (isRaw) {
      const calc = calculateCalculationLine({
        quantity: l.quantity,
        supplierUnitPrice: l.supplierUnitPrice,
        discountPercent: l.discountPercent,
        dependentCostPerUnit: round4(unitZtr),
        marginPercent: '0.00',
        vatRatePercent: '0.00',
      });
      return {
        ...l,
        ...calc,
        marginPercent: '0.00',
        marginUnitAmount: '0.0000',
        marginTotalAmount: '0.00',
        vatRatePercent: '0.00',
        embeddedVatUnitAmount: '0.0000',
        embeddedVatTotalAmount: '0.00',
        sellingUnitPriceExclVat: calc.purchaseUnitPrice,
        sellingTotalValueExclVat: calc.purchaseTotalValue,
        retailUnitPriceWithVat: calc.purchaseUnitPrice,
        retailTotalValueWithVat: calc.purchaseTotalValue,
      };
    }

    const isTargetSelling = overrideLineId === l.id && overrideField === 'sellingUnitPriceExclVat';
    const isTargetRetail = overrideLineId === l.id && overrideField === 'retailUnitPriceWithVat';
    const isTargetMargin = overrideLineId === l.id && overrideField === 'marginPercent';

    const calc = calculateCalculationLine({
      quantity: l.quantity,
      supplierUnitPrice: l.supplierUnitPrice,
      discountPercent: l.discountPercent,
      dependentCostPerUnit: round4(unitZtr),
      marginPercent: isTargetSelling || isTargetRetail ? undefined : l.marginPercent,
      targetSellingPriceExclVat: isTargetSelling ? overrideVal : isWholesale && !isTargetMargin ? l.sellingUnitPriceExclVat : undefined,
      targetRetailPriceWithVat: isTargetRetail ? overrideVal : !isWholesale && !isTargetMargin ? l.retailUnitPriceWithVat : undefined,
      vatRatePercent: l.vatRatePercent,
    });

    if (isWholesale) {
      return {
        ...l,
        ...calc,
        embeddedVatUnitAmount: '0.0000',
        embeddedVatTotalAmount: '0.00',
        retailUnitPriceWithVat: calc.sellingUnitPriceExclVat,
        retailTotalValueWithVat: calc.sellingTotalValueExclVat,
      };
    }

    return { ...l, ...calc };
  });

  const totPurch = round2(nextLines.reduce((a, l) => a.plus(d(l.purchaseTotalValue)), new Decimal(0)));
  const totMarg = isRaw ? '0.00' : round2(nextLines.reduce((a, l) => a.plus(d(l.marginTotalAmount)), new Decimal(0)));
  const totSellExcl = isRaw ? totPurch : round2(nextLines.reduce((a, l) => a.plus(d(l.sellingTotalValueExclVat)), new Decimal(0)));
  const totVat = isRaw || isWholesale ? '0.00' : round2(nextLines.reduce((a, l) => a.plus(d(l.embeddedVatTotalAmount)), new Decimal(0)));
  const totRetail = isRaw ? totPurch : isWholesale ? totSellExcl : round2(nextLines.reduce((a, l) => a.plus(d(l.retailTotalValueWithVat)), new Decimal(0)));

  return {
    ...doc,
    ztrFreight: freight,
    ztrCustoms: customs,
    ztrHandling: handling,
    ztrOther: other,
    ztrAllocationMethod: method,
    lines: nextLines,
    totalPurchaseValue: totPurch,
    totalMarginAmount: totMarg,
    totalSellingValueExclVat: totSellExcl,
    totalEmbeddedVatAmount: totVat,
    totalRetailValueWithVat: totRetail,
  };
}
