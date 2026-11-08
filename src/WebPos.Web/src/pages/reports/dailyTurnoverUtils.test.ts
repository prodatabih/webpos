import { describe, expect, it } from 'vitest';
import {
  aggregateByItems,
  aggregateByPaymentMethods,
  aggregateVatRecap,
  calculateSummary,
  filterReceiptsByPeriod,
} from './dailyTurnoverUtils';
import type { Item, PosReceipt, VatRate } from '../../types/domain';

const mockItems: Item[] = [
  {
    id: 'it-1',
    companyId: 'comp-1',
    sku: 'MLI-00001',
    primaryBarcode: '387111',
    name: 'Mlijeko 1L',
    shortName: 'Mlijeko',
    itemType: 'GOODS',
    normativeMode: 'NONE',
    uom: 'kom',
    netContentQty: '1.0000',
    netContentUom: 'l',
    vatRateId: 'vat-e17',
    categoryName: 'Mliječni proizvodi',
    countryOfOrigin: 'BiH',
    isWeighable: false,
    isActive: true,
  },
  {
    id: 'it-2',
    companyId: 'comp-1',
    sku: 'PEK-00001',
    primaryBarcode: '387222',
    name: 'Hljeb 500g',
    shortName: 'Hljeb',
    itemType: 'GOODS',
    normativeMode: 'NONE',
    uom: 'kom',
    netContentQty: '0.5000',
    netContentUom: 'kg',
    vatRateId: 'vat-e17',
    categoryName: 'Pekarski proizvodi',
    countryOfOrigin: 'BiH',
    isWeighable: false,
    isActive: true,
  },
];

const mockVatRates: VatRate[] = [
  { id: 'vat-e17', companyId: 'comp-1', code: 'E', name: '17%', ratePercent: '17.00', validFrom: '2006-01-01', isActive: true },
];

const mockReceipts: PosReceipt[] = [
  {
    id: 'rcp-1',
    companyId: 'comp-1',
    fiscalYearId: 'fy-2026',
    storeId: 'store-1',
    terminalId: 'term-1',
    receiptNumber: 'R-001',
    fiscalNumber: 'BF-100',
    receiptType: 'SALE',
    paymentMethod: 'CASH',
    cashReceivedAmount: '10.00',
    cardAmount: '0.00',
    wireAmount: '0.00',
    changeAmount: '0.00',
    subtotalGrossBeforeDiscount: '10.00',
    totalDiscountAmount: '0.00',
    totalNetExclVat: '8.55',
    totalVatAmount: '1.45',
    totalGrossAmount: '10.00',
    totalCostOfGoodsSold: '6.00',
    realizedMarginAmount: '2.55',
    lines: [
      {
        id: 'l-1',
        itemId: 'it-1',
        scannedBarcode: '387111',
        quantity: '2.0000',
        purchaseUnitPrice: '3.0000',
        retailUnitPriceWithVat: '5.00',
        discountPercent: '0.00',
        vatRatePercent: '17.00',
        lineTotalWithVat: '10.00',
        lineNetExclVat: '8.55',
        lineVatAmount: '1.45',
      },
    ],
    cashierName: 'kasir1',
    issuedAt: '2026-11-05T10:00:00Z',
    status: 'POSTED',
  },
  {
    id: 'rcp-2',
    companyId: 'comp-1',
    fiscalYearId: 'fy-2026',
    storeId: 'store-1',
    terminalId: 'term-1',
    receiptNumber: 'R-002',
    fiscalNumber: 'BF-101',
    receiptType: 'REFUND',
    paymentMethod: 'CASH',
    cashReceivedAmount: '5.00',
    cardAmount: '0.00',
    wireAmount: '0.00',
    changeAmount: '0.00',
    subtotalGrossBeforeDiscount: '5.00',
    totalDiscountAmount: '0.00',
    totalNetExclVat: '4.27',
    totalVatAmount: '0.73',
    totalGrossAmount: '5.00',
    totalCostOfGoodsSold: '3.00',
    realizedMarginAmount: '1.27',
    lines: [
      {
        id: 'l-2',
        itemId: 'it-1',
        scannedBarcode: '387111',
        quantity: '1.0000',
        purchaseUnitPrice: '3.0000',
        retailUnitPriceWithVat: '5.00',
        discountPercent: '0.00',
        vatRatePercent: '17.00',
        lineTotalWithVat: '5.00',
        lineNetExclVat: '4.27',
        lineVatAmount: '0.73',
      },
    ],
    cashierName: 'kasir1',
    issuedAt: '2026-11-05T11:00:00Z',
    status: 'POSTED',
  },
];

describe('dailyTurnoverUtils', () => {
  it('filters receipts by date period', () => {
    const filtered = filterReceiptsByPeriod(mockReceipts, 'comp-1', '2026-11-01', '2026-11-06');
    expect(filtered.length).toBe(2);

    const outOfRange = filterReceiptsByPeriod(mockReceipts, 'comp-1', '2026-11-06', '2026-11-10');
    expect(outOfRange.length).toBe(0);
  });

  it('calculates financial summary correctly considering refunds as negative', () => {
    const summary = calculateSummary(mockReceipts);
    expect(summary.receiptsCount).toBe(2);
    // Sale 10 - Refund 5 = 5.00 gross
    expect(summary.totalGross).toBe('5.00');
    expect(summary.totalNet).toBe('4.28');
    expect(summary.totalVat).toBe('0.72');
    expect(summary.totalCogs).toBe('3.00');
    expect(summary.totalMargin).toBe('1.28');
  });

  it('aggregates correctly by items', () => {
    const itemsAgg = aggregateByItems(mockReceipts, mockItems);
    expect(itemsAgg.length).toBe(1);
    const mli = itemsAgg[0]!;
    expect(mli.sku).toBe('MLI-00001');
    expect(mli.quantity).toBe('1.0000');
    expect(mli.grossWithVat).toBe('5.00');
    expect(mli.cogsTotal).toBe('3.00');
  });

  it('aggregates payment methods and VAT recap', () => {
    const payAgg = aggregateByPaymentMethods(mockReceipts);
    const cash = payAgg.find((p) => p.method === 'CASH')!;
    expect(cash.receiptsCount).toBe(2);
    expect(cash.totalGross).toBe('5.00');

    const vatRecap = aggregateVatRecap(mockReceipts, mockVatRates);
    expect(vatRecap.length).toBe(1);
    expect(vatRecap[0]?.grossTotal).toBe('5.00');
  });
});
