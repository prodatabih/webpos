import { describe, expect, it } from 'vitest';
import {
  d,
  round2,
  round4,
  formatMoney,
  formatPrice4,
  formatQty,
  calculateCalculationLine,
  calculatePosReceiptTotals,
} from './money';

describe('money financial calculations with decimal.js', () => {
  it('avoids floating point errors (0.1 + 0.2 === 0.30)', () => {
    const sum = d('0.1').plus(d('0.2'));
    expect(round2(sum)).toBe('0.30');
    expect(round4(sum)).toBe('0.3000');
  });

  it('rounds purchase/ex-VAT prices to 4 decimals and retail/totals to 2 decimals with ROUND_HALF_UP', () => {
    expect(round4('12.34565')).toBe('12.3457');
    expect(round4('12.34564')).toBe('12.3456');
    expect(round2('12.345')).toBe('12.35');
    expect(round2('12.344')).toBe('12.34');
  });

  it('formats Bosnian currency and quantities accurately', () => {
    expect(formatMoney('1234567.89')).toBe('1.234.567,89');
    expect(formatMoney('1234.5', true)).toBe('1.234,50 KM');
    expect(formatPrice4('8.461538')).toBe('8,4615');
    expect(formatQty('15.5', 3)).toBe('15,500');
  });

  it('calculates retail calculation line with 17% VAT and 4-decimal unit prices', () => {
    const line = calculateCalculationLine({
      quantity: '100',
      supplierUnitPrice: '2.0000',
      discountPercent: '10',
      dependentCostPerUnit: '0.2000',
      targetRetailPriceWithVat: '2.95',
      vatRatePercent: '17',
    });

    expect(line.netSupplierUnitPrice).toBe('1.8000');
    expect(line.purchaseUnitPrice).toBe('2.0000');
    expect(line.purchaseTotalValue).toBe('200.00');
    expect(line.retailUnitPriceWithVat).toBe('2.95');
    expect(line.retailTotalValueWithVat).toBe('295.00');
    expect(line.sellingUnitPriceExclVat).toBe('2.5214');
    expect(line.embeddedVatTotalAmount).toBe('42.86');
    expect(line.sellingTotalValueExclVat).toBe('252.14');
    expect(line.marginTotalAmount).toBe('52.14');
  });

  it('calculates POS receipt totals and realized margin accurately', () => {
    const totals = calculatePosReceiptTotals([
      {
        quantity: '2',
        retailUnitPriceWithVat: '11.70',
        discountPercent: '0',
        vatRatePercent: '17',
        purchaseUnitPrice: '7.5000',
      },
      {
        quantity: '1',
        retailUnitPriceWithVat: '5.85',
        discountPercent: '10',
        vatRatePercent: '17',
        purchaseUnitPrice: '3.2000',
      },
    ]);

    expect(totals.subtotalGrossBeforeDiscount).toBe('29.25');
    expect(totals.totalDiscountAmount).toBe('0.59');
    expect(totals.totalGrossAmount).toBe('28.66');
    expect(totals.totalNetExclVat).toBe('24.50');
    expect(totals.totalVatAmount).toBe('4.16');
    expect(totals.totalCostOfGoodsSold).toBe('18.20');
    expect(totals.realizedMarginAmount).toBe('6.30');
  });
});
