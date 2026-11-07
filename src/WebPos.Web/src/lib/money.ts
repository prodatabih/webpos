import Decimal from 'decimal.js';

Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});

export type DecimalInput = string | number | Decimal;

export function d(value: DecimalInput | null | undefined): Decimal {
  if (value === null || value === undefined || value === '') {
    return new Decimal(0);
  }
  try {
    return new Decimal(value);
  } catch {
    return new Decimal(0);
  }
}

export function round2(value: DecimalInput): string {
  return d(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export function round4(value: DecimalInput): string {
  return d(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
}

function formatBosnianDecimals(fixedValue: string): string {
  const isNegative = fixedValue.startsWith('-');
  const clean = isNegative ? fixedValue.slice(1) : fixedValue;
  const parts = clean.split('.');
  const intPart = parts[0] ?? '0';
  const decPart = parts[1] ?? '';
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const formatted = decPart.length > 0 ? `${withThousands},${decPart}` : withThousands;
  return isNegative ? `-${formatted}` : formatted;
}

export function formatMoney(value: DecimalInput, withCurrency = false): string {
  const fixed = round2(value);
  const formatted = formatBosnianDecimals(fixed);
  return withCurrency ? `${formatted} KM` : formatted;
}

export function formatMoney2(value: DecimalInput, withCurrency = false): string {
  return formatMoney(value, withCurrency);
}

export function formatPrice4(value: DecimalInput, withCurrency = false): string {
  const fixed = round4(value);
  const formatted = formatBosnianDecimals(fixed);
  return withCurrency ? `${formatted} KM` : formatted;
}

export function formatQty(value: DecimalInput, decimals: 2 | 3 | 4 = 2): string {
  const fixed = d(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toFixed(decimals);
  return formatBosnianDecimals(fixed);
}

export interface CalculationLineInput {
  quantity: DecimalInput;
  supplierUnitPrice: DecimalInput;
  discountPercent: DecimalInput;
  dependentCostPerUnit: DecimalInput;
  marginPercent?: DecimalInput;
  targetRetailPriceWithVat?: DecimalInput;
  vatRatePercent: DecimalInput;
}

export interface CalculationLineResult {
  quantity: string;
  supplierUnitPrice: string;
  discountPercent: string;
  netSupplierUnitPrice: string;
  dependentCostPerUnit: string;
  purchaseUnitPrice: string;
  purchaseTotalValue: string;
  marginPercent: string;
  marginUnitAmount: string;
  marginTotalAmount: string;
  sellingUnitPriceExclVat: string;
  sellingTotalValueExclVat: string;
  vatRatePercent: string;
  embeddedVatUnitAmount: string;
  embeddedVatTotalAmount: string;
  retailUnitPriceWithVat: string;
  retailTotalValueWithVat: string;
}

export function calculateCalculationLine(input: CalculationLineInput): CalculationLineResult {
  const qty = d(input.quantity);
  const supPrice = d(input.supplierUnitPrice);
  const discPct = d(input.discountPercent);
  const depCost = d(input.dependentCostPerUnit);
  const vatRate = d(input.vatRatePercent);
  const vatMultiplier = new Decimal(1).plus(vatRate.div(100));

  const discountFactor = new Decimal(1).minus(discPct.div(100));
  const netSupplierUnit = supPrice.mul(discountFactor).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  const purchaseUnit = netSupplierUnit.plus(depCost).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  const purchaseTotal = purchaseUnit.mul(qty).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  let retailUnitWithVat: Decimal;
  let marginPct: Decimal;

  if (
    input.targetRetailPriceWithVat !== undefined &&
    d(input.targetRetailPriceWithVat).gt(0)
  ) {
    retailUnitWithVat = d(input.targetRetailPriceWithVat).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const sellingExclUnit = retailUnitWithVat.div(vatMultiplier);
    if (purchaseUnit.gt(0)) {
      marginPct = sellingExclUnit.minus(purchaseUnit).div(purchaseUnit).mul(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    } else {
      marginPct = new Decimal(0);
    }
  } else {
    marginPct = d(input.marginPercent ?? 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const prelimExcl = purchaseUnit.mul(new Decimal(1).plus(marginPct.div(100)));
    retailUnitWithVat = prelimExcl.mul(vatMultiplier).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  const retailTotalWithVat = retailUnitWithVat.mul(qty).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const sellingUnitExcl = retailUnitWithVat.div(vatMultiplier).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  const embeddedVatTotal = retailTotalWithVat
    .minus(retailTotalWithVat.div(vatMultiplier).toDecimalPlaces(2, Decimal.ROUND_HALF_UP))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const sellingTotalExcl = retailTotalWithVat.minus(embeddedVatTotal).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const marginTotal = sellingTotalExcl.minus(purchaseTotal).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const marginUnit = sellingUnitExcl.minus(purchaseUnit).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  const embeddedVatUnit = retailUnitWithVat.minus(sellingUnitExcl).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

  return {
    quantity: round4(qty),
    supplierUnitPrice: round4(supPrice),
    discountPercent: round2(discPct),
    netSupplierUnitPrice: round4(netSupplierUnit),
    dependentCostPerUnit: round4(depCost),
    purchaseUnitPrice: round4(purchaseUnit),
    purchaseTotalValue: round2(purchaseTotal),
    marginPercent: round2(marginPct),
    marginUnitAmount: round4(marginUnit),
    marginTotalAmount: round2(marginTotal),
    sellingUnitPriceExclVat: round4(sellingUnitExcl),
    sellingTotalValueExclVat: round2(sellingTotalExcl),
    vatRatePercent: round2(vatRate),
    embeddedVatUnitAmount: round4(embeddedVatUnit),
    embeddedVatTotalAmount: round2(embeddedVatTotal),
    retailUnitPriceWithVat: round2(retailUnitWithVat),
    retailTotalValueWithVat: round2(retailTotalWithVat),
  };
}

export interface PosReceiptLineInput {
  quantity: DecimalInput;
  retailUnitPriceWithVat: DecimalInput;
  discountPercent: DecimalInput;
  vatRatePercent: DecimalInput;
  purchaseUnitPrice?: DecimalInput;
}

export interface PosReceiptTotalsResult {
  subtotalGrossBeforeDiscount: string;
  totalDiscountAmount: string;
  totalNetExclVat: string;
  totalVatAmount: string;
  totalGrossAmount: string;
  totalCostOfGoodsSold: string;
  realizedMarginAmount: string;
  lineResults: Array<{
    lineGrossBeforeDiscount: string;
    lineDiscountAmount: string;
    lineTotalWithVat: string;
    lineNetExclVat: string;
    lineVatAmount: string;
    unitPriceExclVat: string;
  }>;
}

export function calculatePosReceiptTotals(lines: PosReceiptLineInput[]): PosReceiptTotalsResult {
  let subtotalGrossBeforeDiscount = new Decimal(0);
  let totalDiscountAmount = new Decimal(0);
  let totalNetExclVat = new Decimal(0);
  let totalVatAmount = new Decimal(0);
  let totalGrossAmount = new Decimal(0);
  let totalCostOfGoodsSold = new Decimal(0);

  const lineResults = lines.map((line) => {
    const qty = d(line.quantity);
    const unitWithVat = d(line.retailUnitPriceWithVat).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const discPct = d(line.discountPercent);
    const vatRate = d(line.vatRatePercent);
    const vatMultiplier = new Decimal(1).plus(vatRate.div(100));

    const grossBeforeDisc = qty.mul(unitWithVat).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const discAmt = grossBeforeDisc.mul(discPct.div(100)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const lineGross = grossBeforeDisc.minus(discAmt).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const lineNet = lineGross.div(vatMultiplier).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const lineVat = lineGross.minus(lineNet).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const unitExcl = unitWithVat.div(vatMultiplier).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    const lineCogs = d(line.purchaseUnitPrice ?? 0).mul(qty).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    subtotalGrossBeforeDiscount = subtotalGrossBeforeDiscount.plus(grossBeforeDisc);
    totalDiscountAmount = totalDiscountAmount.plus(discAmt);
    totalNetExclVat = totalNetExclVat.plus(lineNet);
    totalVatAmount = totalVatAmount.plus(lineVat);
    totalGrossAmount = totalGrossAmount.plus(lineGross);
    totalCostOfGoodsSold = totalCostOfGoodsSold.plus(lineCogs);

    return {
      lineGrossBeforeDiscount: round2(grossBeforeDisc),
      lineDiscountAmount: round2(discAmt),
      lineTotalWithVat: round2(lineGross),
      lineNetExclVat: round2(lineNet),
      lineVatAmount: round2(lineVat),
      unitPriceExclVat: round4(unitExcl),
    };
  });

  const realizedMarginAmount = totalNetExclVat.minus(totalCostOfGoodsSold).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    subtotalGrossBeforeDiscount: round2(subtotalGrossBeforeDiscount),
    totalDiscountAmount: round2(totalDiscountAmount),
    totalNetExclVat: round2(totalNetExclVat),
    totalVatAmount: round2(totalVatAmount),
    totalGrossAmount: round2(totalGrossAmount),
    totalCostOfGoodsSold: round2(totalCostOfGoodsSold),
    realizedMarginAmount: round2(realizedMarginAmount),
    lineResults,
  };
}
