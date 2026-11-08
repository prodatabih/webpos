import { exportToExcelSpreadsheet } from '../../lib/excelExport';
import type { CalculationDocument, Item } from '../../types/domain';

export function exportCalculationToExcel(doc: CalculationDocument, items: Item[]): void {
  exportToExcelSpreadsheet({
    fileName: `kalkulacija_${doc.docNumber}`,
    sheetName: 'Kalkulacija',
    columns: [
      { header: 'R.br', key: 'idx', type: 'number' },
      { header: 'Šifra', key: 'sku' },
      { header: 'Naziv artikla', key: 'name' },
      { header: 'JM', key: 'uom' },
      { header: 'Količina', key: 'quantity', type: 'number', numDecimals: 2 },
      { header: 'Fakturna cijena', key: 'supplierUnitPrice', type: 'number', numDecimals: 4 },
      { header: 'Rabat %', key: 'discountPercent', type: 'number', numDecimals: 2 },
      { header: 'Neto fakturna', key: 'netSupplierUnitPrice', type: 'number', numDecimals: 4 },
      { header: 'ZTR po kom', key: 'dependentCostPerUnit', type: 'number', numDecimals: 4 },
      { header: 'Nabavna cijena', key: 'purchaseUnitPrice', type: 'number', numDecimals: 4 },
      { header: 'Ukupno nabavna', key: 'purchaseTotalValue', type: 'number', numDecimals: 2 },
      { header: 'Marža %', key: 'marginPercent', type: 'number', numDecimals: 2 },
      { header: 'Iznos marže', key: 'marginTotalAmount', type: 'number', numDecimals: 2 },
      { header: 'Prodajna b.PDV', key: 'sellingTotalValueExclVat', type: 'number', numDecimals: 2 },
      { header: 'PDV %', key: 'vatRatePercent', type: 'number', numDecimals: 2 },
      { header: 'MPC sa PDV', key: 'retailUnitPriceWithVat', type: 'number', numDecimals: 2 },
      { header: 'Ukupno MPC', key: 'retailTotalValueWithVat', type: 'number', numDecimals: 2 },
    ],
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
        sellingTotalValueExclVat: l.sellingTotalValueExclVat,
        vatRatePercent: l.vatRatePercent,
        retailUnitPriceWithVat: l.retailUnitPriceWithVat,
        retailTotalValueWithVat: l.retailTotalValueWithVat,
      };
    }),
    summaryRow: {
      name: 'UKUPNO',
      purchaseTotalValue: doc.totalPurchaseValue,
      marginTotalAmount: doc.totalMarginAmount,
      sellingTotalValueExclVat: doc.totalSellingValueExclVat,
      retailTotalValueWithVat: doc.totalRetailValueWithVat,
    },
  });
}
