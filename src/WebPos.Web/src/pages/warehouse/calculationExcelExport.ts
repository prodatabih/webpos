import { exportToExcelSpreadsheet } from '../../lib/excelExport';
import type { CalculationDocument, Item, StoreType } from '../../types/domain';

export function exportCalculationToExcel(
  doc: CalculationDocument,
  items: Item[],
  storeType: StoreType = 'RETAIL'
): void {
  const isRaw = storeType === 'RAW_MATERIAL' || storeType === 'PRODUCTION';
  const isWholesale = storeType === 'WHOLESALE';

  const baseCols = [
    { header: 'R.br', key: 'idx', type: 'number' as const },
    { header: 'Šifra', key: 'sku' },
    { header: 'Naziv artikla', key: 'name' },
    { header: 'JM', key: 'uom' },
    { header: 'Količina', key: 'quantity', type: 'number' as const, numDecimals: 2 as const },
    { header: 'Fakturna cijena', key: 'supplierUnitPrice', type: 'number' as const, numDecimals: 4 as const },
    { header: 'Rabat %', key: 'discountPercent', type: 'number' as const, numDecimals: 2 as const },
    { header: 'Neto fakturna', key: 'netSupplierUnitPrice', type: 'number' as const, numDecimals: 4 as const },
    { header: 'ZTR po kom', key: 'dependentCostPerUnit', type: 'number' as const, numDecimals: 4 as const },
    { header: 'Nabavna cijena', key: 'purchaseUnitPrice', type: 'number' as const, numDecimals: 4 as const },
    { header: 'Ukupno nabavna', key: 'purchaseTotalValue', type: 'number' as const, numDecimals: 2 as const },
  ];

  const extraCols = isRaw
    ? []
    : isWholesale
    ? [
        { header: 'Marža %', key: 'marginPercent', type: 'number' as const, numDecimals: 2 as const },
        { header: 'Iznos marže', key: 'marginTotalAmount', type: 'number' as const, numDecimals: 2 as const },
        { header: 'VPC b.PDV', key: 'sellingUnitPriceExclVat', type: 'number' as const, numDecimals: 4 as const },
        { header: 'Ukupno VPC', key: 'sellingTotalValueExclVat', type: 'number' as const, numDecimals: 2 as const },
      ]
    : [
        { header: 'Marža %', key: 'marginPercent', type: 'number' as const, numDecimals: 2 as const },
        { header: 'Iznos marže', key: 'marginTotalAmount', type: 'number' as const, numDecimals: 2 as const },
        { header: 'Prodajna b.PDV', key: 'sellingTotalValueExclVat', type: 'number' as const, numDecimals: 2 as const },
        { header: 'PDV %', key: 'vatRatePercent', type: 'number' as const, numDecimals: 2 as const },
        { header: 'MPC sa PDV', key: 'retailUnitPriceWithVat', type: 'number' as const, numDecimals: 2 as const },
        { header: 'Ukupno MPC', key: 'retailTotalValueWithVat', type: 'number' as const, numDecimals: 2 as const },
      ];

  const summaryRow: Record<string, string | number> = {
    name: 'UKUPNO',
    purchaseTotalValue: doc.totalPurchaseValue,
  };
  if (!isRaw) {
    summaryRow.marginTotalAmount = doc.totalMarginAmount;
    summaryRow.sellingTotalValueExclVat = doc.totalSellingValueExclVat;
    if (!isWholesale) {
      summaryRow.retailTotalValueWithVat = doc.totalRetailValueWithVat;
    }
  }

  exportToExcelSpreadsheet({
    fileName: `kalkulacija_${doc.docNumber}`,
    sheetName: 'Kalkulacija',
    columns: [...baseCols, ...extraCols],
    rows: doc.lines.map((l, idx) => {
      const item = items.find((i) => i.id === l.itemId);
      return {
        idx: idx + 1,
        sku: item?.sku ?? '',
        name: item?.name ?? '',
        uom: item?.uom ?? 'KOM',
        quantity: l.quantity,
        supplierUnitPrice: l.supplierUnitPrice,
        discountPercent: l.discountPercent,
        netSupplierUnitPrice: l.netSupplierUnitPrice,
        dependentCostPerUnit: l.dependentCostPerUnit,
        purchaseUnitPrice: l.purchaseUnitPrice,
        purchaseTotalValue: l.purchaseTotalValue,
        marginPercent: l.marginPercent,
        marginTotalAmount: l.marginTotalAmount,
        sellingUnitPriceExclVat: l.sellingUnitPriceExclVat,
        sellingTotalValueExclVat: l.sellingTotalValueExclVat,
        vatRatePercent: l.vatRatePercent,
        retailUnitPriceWithVat: l.retailUnitPriceWithVat,
        retailTotalValueWithVat: l.retailTotalValueWithVat,
      };
    }),
    summaryRow,
  });
}
