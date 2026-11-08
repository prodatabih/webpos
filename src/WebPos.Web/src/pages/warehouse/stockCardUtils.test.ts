import { describe, expect, it } from 'vitest';
import { buildStockCardMovements } from './stockCardUtils';
import type { CalculationDocument, PosReceipt } from '../../types/domain';

describe('stockCardUtils', () => {
  it('correctly tracks chronological receipt, sale, and running balance', () => {
    const calc: CalculationDocument = {
      id: 'calc-1',
      companyId: 'comp-1',
      fiscalYearId: 'fy-2026',
      storeId: 'store-1',
      docNumber: 'KALK-001',
      docDate: '2026-11-01',
      postingDate: '2026-11-01',
      partnerId: 'part-1',
      supplierInvoiceNumber: 'FAK-123',
      supplierInvoiceDate: '2026-11-01',
      status: 'POSTED',
      notes: '',
      lines: [
        {
          id: 'l-1',
          itemId: 'it-1',
          quantity: '50.0000',
          supplierUnitPrice: '3.0000',
          discountPercent: '0.00',
          netSupplierUnitPrice: '3.0000',
          dependentCostPerUnit: '0.0000',
          purchaseUnitPrice: '3.0000',
          purchaseTotalValue: '150.0000',
          marginPercent: '30.00',
          marginUnitAmount: '0.9000',
          marginTotalAmount: '45.0000',
          sellingUnitPriceExclVat: '3.9000',
          sellingTotalValueExclVat: '195.0000',
          vatRatePercent: '17.00',
          embeddedVatUnitAmount: '0.6630',
          embeddedVatTotalAmount: '33.1500',
          retailUnitPriceWithVat: '4.56',
          retailTotalValueWithVat: '228.00',
        },
      ],
      totalPurchaseValue: '150.0000',
      totalMarginAmount: '45.0000',
      totalSellingValueExclVat: '195.0000',
      totalEmbeddedVatAmount: '33.1500',
      totalRetailValueWithVat: '228.00',
      createdBy: 'admin',
      createdAt: '2026-11-01T08:00:00Z',
    };

    const receipt: PosReceipt = {
      id: 'rcp-1',
      companyId: 'comp-1',
      fiscalYearId: 'fy-2026',
      storeId: 'store-1',
      terminalId: 'term-1',
      receiptNumber: 'R-001',
      fiscalNumber: 'BF-100',
      receiptType: 'SALE',
      paymentMethod: 'CASH',
      cashReceivedAmount: '45.60',
      cardAmount: '0.00',
      wireAmount: '0.00',
      changeAmount: '0.00',
      subtotalGrossBeforeDiscount: '45.60',
      totalDiscountAmount: '0.00',
      totalNetExclVat: '38.97',
      totalVatAmount: '6.63',
      totalGrossAmount: '45.60',
      totalCostOfGoodsSold: '30.00',
      realizedMarginAmount: '8.97',
      lines: [
        {
          id: 'rl-1',
          itemId: 'it-1',
          scannedBarcode: '387111',
          quantity: '10.0000',
          purchaseUnitPrice: '3.0000',
          retailUnitPriceWithVat: '4.56',
          discountPercent: '0.00',
          vatRatePercent: '17.00',
          lineTotalWithVat: '45.60',
          lineNetExclVat: '38.97',
          lineVatAmount: '6.63',
        },
      ],
      cashierName: 'kasir1',
      issuedAt: '2026-11-02T12:00:00Z',
      status: 'POSTED',
    };

    const movements = buildStockCardMovements({
      storeId: 'store-1',
      itemId: 'it-1',
      calculations: [calc],
      priceLevelings: [],
      transfers: [],
      inventoryCounts: [],
      otherWarehouseDocs: [],
      posReceipts: [receipt],
      defaultPrice: '4.56',
    });

    expect(movements.length).toBe(2);
    // Calculation in: 50, balance: 50
    expect(movements[0]?.inQty).toBe('50.0000');
    expect(movements[0]?.balanceQty).toBe('50.0000');
    // Sale out: 10, balance: 40
    expect(movements[1]?.outQty).toBe('10.0000');
    expect(movements[1]?.balanceQty).toBe('40.0000');
    expect(movements[1]?.totalValue).toBe('182.40');
  });
});
