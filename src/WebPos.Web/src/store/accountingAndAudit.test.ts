import { describe, expect, it } from 'vitest';
import { calculateCalculationLine, calculatePosReceiptTotals } from '../lib/money';
import { getAppStoreState } from './useAppStore';
import type { CalculationDocument, PosReceipt } from '../types/domain';

describe('Accounting, KEP Ledger, Period Locking, and Audit Trail Verification', () => {
  it('posts calculation with automatic price leveling on existing stock and records KEP & Audit entries', () => {
    const store = getAppStoreState();
    const beforePriceState = store.storeItemPrices.find(
      (p) => p.storeId === 'store-1' && p.itemId === 'item-1'
    );
    expect(beforePriceState?.currentStockQty).toBe('148.0000');
    expect(beforePriceState?.retailUnitPriceWithVat).toBe('9.50');

    const calcLine = calculateCalculationLine({
      quantity: '50',
      supplierUnitPrice: '7.6000',
      discountPercent: '0',
      dependentCostPerUnit: '0.1000',
      targetRetailPriceWithVat: '9.80',
      vatRatePercent: '17',
    });

    expect(calcLine.purchaseUnitPrice).toBe('7.7000');
    expect(calcLine.sellingUnitPriceExclVat).toBe('8.3761');
    expect(calcLine.retailUnitPriceWithVat).toBe('9.80');
    expect(calcLine.retailTotalValueWithVat).toBe('490.00');

    const draftCalc: CalculationDocument = {
      id: 'calc-test-auto-niv',
      companyId: 'comp-1',
      fiscalYearId: 'fy-2026',
      storeId: 'store-1',
      docNumber: 'KALK-PJ01-2026-0099',
      docDate: '2026-11-08',
      partnerId: 'part-2',
      supplierInvoiceNumber: 'FAK-2026-99',
      supplierInvoiceDate: '2026-11-08',
      status: 'DRAFT',
      notes: 'Test kalkulacije sa promjenom MPC',
      lines: [
        {
          id: 'calcline-test-99',
          itemId: 'item-1',
          ...calcLine,
        },
      ],
      totalPurchaseValue: calcLine.purchaseTotalValue,
      totalMarginAmount: calcLine.marginTotalAmount,
      totalSellingValueExclVat: calcLine.sellingTotalValueExclVat,
      totalEmbeddedVatAmount: calcLine.embeddedVatTotalAmount,
      totalRetailValueWithVat: calcLine.retailTotalValueWithVat,
      createdBy: 'tenant.admin',
      createdAt: '2026-11-08T10:00:00Z',
    };

    const saveRes = getAppStoreState().saveCalculationDraft(draftCalc);
    expect(saveRes.ok).toBe(true);

    const postRes = getAppStoreState().postCalculation('calc-test-auto-niv');
    expect(postRes.ok).toBe(true);
    expect(postRes.autoLevelingDocNumber).toBe('NIV-AUTO-KALK-PJ01-2026-0099');

    const afterStore = getAppStoreState();
    const updatedItemPrice = afterStore.storeItemPrices.find(
      (p) => p.storeId === 'store-1' && p.itemId === 'item-1'
    );
    expect(updatedItemPrice?.currentStockQty).toBe('198.0000');
    expect(updatedItemPrice?.purchaseUnitPrice).toBe('7.7000');
    expect(updatedItemPrice?.retailUnitPriceWithVat).toBe('9.80');

    const autoNiv = afterStore.priceLevelings.find(
      (n) => n.docNumber === 'NIV-AUTO-KALK-PJ01-2026-0099'
    );
    expect(autoNiv).toBeDefined();
    expect(autoNiv?.totalRetailDifference).toBe('44.40');
    expect(autoNiv?.totalVatDifference).toBe('6.45');
    expect(autoNiv?.totalMarginDifference).toBe('37.95');

    const kepCalcEntry = afterStore.kepLedgerEntries.find(
      (k) => k.documentNumber === 'KALK-PJ01-2026-0099'
    );
    expect(kepCalcEntry?.debitRetailAmount).toBe('490.00');
    expect(kepCalcEntry?.creditRetailAmount).toBe('0.00');

    const auditEntry = afterStore.auditLog.find(
      (a) => a.entityId === 'calc-test-auto-niv' && a.action === 'POST'
    );
    expect(auditEntry).toBeDefined();
    expect(auditEntry?.previousState).toBe('DRAFT');
    expect(auditEntry?.newState).toBe('POSTED');
  });

  it('enforces immutability of POSTED documents and supports reversal with negative KEP storno', () => {
    const store = getAppStoreState();
    const postedDoc = store.calculations.find((c) => c.id === 'calc-test-auto-niv');
    expect(postedDoc?.status).toBe('POSTED');

    const modifyAttempt = store.saveCalculationDraft({
      ...postedDoc!,
      notes: 'Pokušaj nedozvoljene izmjene',
    });
    expect(modifyAttempt.ok).toBe(false);

    const revRes = store.reverseCalculation('calc-test-auto-niv', 'Pogrešan unos količine');
    expect(revRes.ok).toBe(true);

    const afterRev = getAppStoreState();
    const reversedDoc = afterRev.calculations.find((c) => c.id === 'calc-test-auto-niv');
    expect(reversedDoc?.status).toBe('REVERSED');

    const stornoKep = afterRev.kepLedgerEntries.find(
      (k) => k.documentNumber === 'STORNO-KALK-PJ01-2026-0099'
    );
    expect(stornoKep?.debitRetailAmount).toBe('-490.00');

    const revAudit = afterRev.auditLog.find(
      (a) => a.entityId === 'calc-test-auto-niv' && a.action === 'REVERSE'
    );
    expect(revAudit?.previousState).toBe('POSTED');
    expect(revAudit?.newState).toBe('REVERSED');
  });

  it('blocks posting in a locked fiscal period and logs period lock/unlock in auditLog', () => {
    const store = getAppStoreState();
    expect(store.isDateInLockedPeriod('2026-10-15')).toBe(true);
    expect(store.isDateInLockedPeriod('2026-11-15')).toBe(false);

    store.toggleFiscalPeriodLock('fp-2026-11');
    expect(getAppStoreState().isDateInLockedPeriod('2026-11-15')).toBe(true);

    const lockedDraft: CalculationDocument = {
      id: 'calc-locked-test',
      companyId: 'comp-1',
      fiscalYearId: 'fy-2026',
      storeId: 'store-1',
      docNumber: 'KALK-PJ01-2026-LOCKED',
      docDate: '2026-11-15',
      partnerId: 'part-1',
      supplierInvoiceNumber: 'F-LOCK',
      supplierInvoiceDate: '2026-11-15',
      status: 'DRAFT',
      notes: '',
      lines: [],
      totalPurchaseValue: '0.00',
      totalMarginAmount: '0.00',
      totalSellingValueExclVat: '0.00',
      totalEmbeddedVatAmount: '0.00',
      totalRetailValueWithVat: '0.00',
      createdBy: 'tenant.admin',
      createdAt: '2026-11-15T10:00:00Z',
    };
    getAppStoreState().saveCalculationDraft(lockedDraft);
    const blockedPost = getAppStoreState().postCalculation('calc-locked-test');
    expect(blockedPost.ok).toBe(false);

    getAppStoreState().toggleFiscalPeriodLock('fp-2026-11');
    expect(getAppStoreState().isDateInLockedPeriod('2026-11-15')).toBe(false);
  });

  it('deducts BOM components on POS composite sale (ON_SALE_BACKFLUSH) and restores on refund', () => {
    const beforeFlour = getAppStoreState().storeItemPrices.find(
      (p) => p.storeId === 'store-1' && p.itemId === 'item-2'
    );
    expect(beforeFlour?.currentStockQty).toBe('210.0000');

    const totals = calculatePosReceiptTotals([
      {
        quantity: '10',
        retailUnitPriceWithVat: '1.20',
        discountPercent: '0',
        vatRatePercent: '17',
        purchaseUnitPrice: '0.6500',
      },
    ]);

    const saleReceipt: PosReceipt = {
      id: 'rcp-test-bom',
      companyId: 'comp-1',
      fiscalYearId: 'fy-2026',
      storeId: 'store-1',
      terminalId: 'term-1',
      receiptNumber: 'PJ01-K1-2026-001005',
      fiscalNumber: 'BF-148921',
      receiptType: 'SALE',
      paymentMethod: 'CASH',
      cashReceivedAmount: '12.00',
      cardAmount: '0.00',
      wireAmount: '0.00',
      changeAmount: '0.00',
      subtotalGrossBeforeDiscount: totals.subtotalGrossBeforeDiscount,
      totalDiscountAmount: totals.totalDiscountAmount,
      totalNetExclVat: totals.totalNetExclVat,
      totalVatAmount: totals.totalVatAmount,
      totalGrossAmount: totals.totalGrossAmount,
      totalCostOfGoodsSold: totals.totalCostOfGoodsSold,
      realizedMarginAmount: totals.realizedMarginAmount,
      lines: [
        {
          id: 'rcpline-bom-1',
          itemId: 'item-5',
          scannedBarcode: '3871234000053',
          quantity: '10.0000',
          purchaseUnitPrice: '0.6500',
          retailUnitPriceWithVat: '1.20',
          discountPercent: '0.00',
          vatRatePercent: '17.00',
          lineTotalWithVat: '12.00',
          lineNetExclVat: '10.26',
          lineVatAmount: '1.74',
        },
      ],
      cashierName: 'radnik.dva',
      issuedAt: '2026-11-08T12:00:00Z',
      status: 'POSTED',
    };

    const issueRes = getAppStoreState().issuePosReceipt(saleReceipt);
    expect(issueRes.ok).toBe(true);

    const afterSaleFlour = getAppStoreState().storeItemPrices.find(
      (p) => p.storeId === 'store-1' && p.itemId === 'item-2'
    );
    expect(afterSaleFlour?.currentStockQty).toBe('208.9800');

    const refundRes = getAppStoreState().refundPosReceipt('rcp-test-bom');
    expect(refundRes.ok).toBe(true);

    const afterRefundFlour = getAppStoreState().storeItemPrices.find(
      (p) => p.storeId === 'store-1' && p.itemId === 'item-2'
    );
    expect(afterRefundFlour?.currentStockQty).toBe('210.0000');
  });
});
