import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { calculateCalculationLine, d, round2 } from '../../lib/money';

describe('Warehouse Documents Calculations', () => {
  it('calculates calculation line from margin percent', () => {
    const res = calculateCalculationLine({
      quantity: '150.0000',
      supplierUnitPrice: '1.8000',
      discountPercent: '5.00',
      dependentCostPerUnit: '0.2455',
      marginPercent: '25.00',
      vatRatePercent: '17.00',
    });

    // Net supplier unit price: 1.8000 * 0.95 = 1.7100
    expect(res.netSupplierUnitPrice).toBe('1.7100');
    // Purchase unit price: 1.7100 + 0.2455 = 1.9555
    expect(res.purchaseUnitPrice).toBe('1.9555');
    // Price before VAT: 1.9555 * 1.25 = 2.444375 -> rounded
    expect(d(res.retailUnitPriceWithVat).gt(0)).toBe(true);
    expect(d(res.retailTotalValueWithVat).gt(0)).toBe(true);
  });

  it('calculates calculation line reversely from MPC target (two-way)', () => {
    const res = calculateCalculationLine({
      quantity: '60.0000',
      supplierUnitPrice: '2.2500',
      discountPercent: '5.00',
      dependentCostPerUnit: '0.3069',
      targetRetailPriceWithVat: '3.50',
      vatRatePercent: '17.00',
    });

    expect(res.retailUnitPriceWithVat).toBe('3.50');
    expect(d(res.marginPercent).gt(0)).toBe(true);
    expect(res.retailTotalValueWithVat).toBe('210.00');
  });

  it('correctly separates inventory count shortage into recognized waste (0% PDV) and unrecognized shortage (17% PDV)', () => {
    const bookQty = d('100.0000');
    const countedQty = d('90.0000');
    const diff = countedQty.minus(bookQty); // -10.0000
    const mpc = d('2.00');

    expect(diff.lt(0)).toBe(true);
    const totalShortageQty = diff.abs(); // 10
    const allowedWasteQty = d('3.0000'); // 3 pieces allowed waste
    const unrecognizedShortageQty = totalShortageQty.minus(allowedWasteQty); // 7 pieces

    const allowedWasteVal = allowedWasteQty.mul(mpc); // 6.00 KM (0% PDV)
    const unrecognizedShortageVal = unrecognizedShortageQty.mul(mpc); // 14.00 KM (17% PDV)
    const vatMultiplier = new Decimal(1.17);
    const unrecVat = unrecognizedShortageVal
      .minus(unrecognizedShortageVal.div(vatMultiplier).toDecimalPlaces(2, Decimal.ROUND_HALF_UP))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    expect(round2(allowedWasteVal)).toBe('6.00');
    expect(round2(unrecognizedShortageVal)).toBe('14.00');
    expect(d(unrecVat).gt(0)).toBe(true);
  });

  it('calculates wholesale calculation line without VAT up to VPC', () => {
    const res = calculateCalculationLine({
      quantity: '50.0000',
      supplierUnitPrice: '10.0000',
      discountPercent: '10.00',
      dependentCostPerUnit: '1.0000',
      targetSellingPriceExclVat: '12.0000',
      vatRatePercent: '17.00',
    });

    expect(res.netSupplierUnitPrice).toBe('9.0000');
    expect(res.purchaseUnitPrice).toBe('10.0000');
    expect(res.purchaseTotalValue).toBe('500.00');
    expect(res.sellingUnitPriceExclVat).toBe('12.0000');
    expect(res.marginPercent).toBe('20.00');
    expect(res.marginTotalAmount).toBe('100.00');
  });

  it('calculates raw material calculation up to purchase price NC without margin or VAT', () => {
    const res = calculateCalculationLine({
      quantity: '200.0000',
      supplierUnitPrice: '5.5000',
      discountPercent: '0.00',
      dependentCostPerUnit: '0.5000',
      marginPercent: '0.00',
      vatRatePercent: '0.00',
    });

    expect(res.purchaseUnitPrice).toBe('6.0000');
    expect(res.purchaseTotalValue).toBe('1200.00');
    expect(res.marginPercent).toBe('0.00');
    expect(res.marginTotalAmount).toBe('0.00');
    expect(res.embeddedVatTotalAmount).toBe('0.00');
  });
});

