import { exportToExcelSpreadsheet } from '../../lib/excelExport';
import { round2, d } from '../../lib/money';
import type { Item, PriceLevelingDocument } from '../../types/domain';

export function exportPriceLevelingToExcel(doc: PriceLevelingDocument, items: Item[]): void {
  exportToExcelSpreadsheet({
    fileName: `nivelacija_${doc.docNumber}`,
    sheetName: 'Nivelacija',
    columns: [
      { header: 'R.br', key: 'idx', type: 'number' },
      { header: 'Šifra', key: 'sku' },
      { header: 'Naziv artikla', key: 'name' },
      { header: 'JM', key: 'uom' },
      { header: 'Zaliha', key: 'stockQuantity', type: 'number', numDecimals: 2 },
      { header: 'Stara MPC', key: 'oldRetailPriceWithVat', type: 'number', numDecimals: 2 },
      { header: 'Nova MPC', key: 'newRetailPriceWithVat', type: 'number', numDecimals: 2 },
      { header: 'Razlika u cijeni', key: 'unitDiff', type: 'number', numDecimals: 2 },
      { header: 'Efekat na zalihu', key: 'totalRetailDifference', type: 'number', numDecimals: 2 },
      { header: 'Efekat na PDV', key: 'embeddedVatDifference', type: 'number', numDecimals: 2 },
      { header: 'Efekat na maržu', key: 'marginDifference', type: 'number', numDecimals: 2 },
    ],
    rows: doc.lines.map((l, idx) => {
      const item = items.find((i) => i.id === l.itemId);
      return {
        idx: idx + 1,
        sku: item?.sku ?? '',
        name: item?.name ?? '',
        uom: item?.uom ?? 'KOM',
        stockQuantity: l.stockQuantity,
        oldRetailPriceWithVat: l.oldRetailPriceWithVat,
        newRetailPriceWithVat: l.newRetailPriceWithVat,
        unitDiff: round2(d(l.newRetailPriceWithVat).minus(d(l.oldRetailPriceWithVat))),
        totalRetailDifference: l.totalRetailDifference,
        embeddedVatDifference: l.embeddedVatDifference,
        marginDifference: l.marginDifference,
      };
    }),
    summaryRow: {
      name: 'UKUPNO',
      totalRetailDifference: doc.totalRetailDifference,
      embeddedVatDifference: doc.totalVatDifference,
      marginDifference: doc.totalMarginDifference,
    },
  });
}
