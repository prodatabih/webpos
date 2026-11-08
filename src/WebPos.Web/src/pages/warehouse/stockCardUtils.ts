import Decimal from 'decimal.js';
import { d, round2, round4 } from '../../lib/money';
import type {
  CalculationDocument,
  InventoryCountDocument,
  OtherWarehouseDocument,
  PosReceipt,
  PriceLevelingDocument,
  TransferDocument,
} from '../../types/domain';

export interface StockMovement {
  id: string;
  date: string;
  docType: string;
  docNumber: string;
  description: string;
  inQty: string;
  outQty: string;
  balanceQty: string;
  unitPrice: string;
  totalValue: string;
}

export function buildStockCardMovements({
  storeId,
  itemId,
  calculations,
  priceLevelings,
  transfers,
  inventoryCounts,
  otherWarehouseDocs,
  posReceipts,
  defaultPrice = '0.00',
}: {
  storeId: string;
  itemId: string;
  calculations: CalculationDocument[];
  priceLevelings: PriceLevelingDocument[];
  transfers: TransferDocument[];
  inventoryCounts: InventoryCountDocument[];
  otherWarehouseDocs: OtherWarehouseDocument[];
  posReceipts: PosReceipt[];
  defaultPrice?: string;
}): StockMovement[] {
  const rawList: Array<{
    date: string;
    docType: string;
    docNumber: string;
    description: string;
    in: Decimal;
    out: Decimal;
    price: Decimal;
  }> = [];

  // 1. Calculations
  calculations
    .filter((c) => c.storeId === storeId && c.status === 'POSTED')
    .forEach((c) => {
      c.lines
        .filter((l) => l.itemId === itemId)
        .forEach((l) => {
          rawList.push({
            date: c.postingDate || c.docDate,
            docType: 'Ulazna kalkulacija (Primka)',
            docNumber: c.docNumber,
            description: c.supplierInvoiceNumber ? `Faktura: ${c.supplierInvoiceNumber}` : 'Prijem robe',
            in: d(l.quantity),
            out: new Decimal(0),
            price: d(l.retailUnitPriceWithVat || defaultPrice),
          });
        });
    });

  // 2. Transfers In / Out
  transfers
    .filter((t) => t.status === 'POSTED')
    .forEach((t) => {
      t.lines
        .filter((l) => l.itemId === itemId)
        .forEach((l) => {
          if (t.targetStoreId === storeId) {
            rawList.push({
              date: t.postingDate || t.docDate,
              docType: 'Međuskladišnica (Ulaz)',
              docNumber: t.docNumber,
              description: `Prijem iz objekta`,
              in: d(l.quantity),
              out: new Decimal(0),
              price: d(l.targetRetailUnitPrice || defaultPrice),
            });
          } else if (t.sourceStoreId === storeId) {
            rawList.push({
              date: t.postingDate || t.docDate,
              docType: 'Međuskladišnica (Izlaz)',
              docNumber: t.docNumber,
              description: `Otprema u objekat`,
              in: new Decimal(0),
              out: d(l.quantity),
              price: d(l.sourceRetailUnitPrice || defaultPrice),
            });
          }
        });
    });

  // 3. Other warehouse docs
  otherWarehouseDocs
    .filter((doc) => doc.storeId === storeId && doc.status === 'POSTED')
    .forEach((doc) => {
      doc.lines
        .filter((l) => l.itemId === itemId)
        .forEach((l) => {
          const isReceipt = doc.subtype === 'INTERNAL_RECEIPT' || doc.subtype === 'INTERNAL_PRODUCTION';
          rawList.push({
            date: doc.postingDate || doc.docDate,
            docType: `Interni dokument (${doc.subtype})`,
            docNumber: doc.docNumber,
            description: doc.notes || '-',
            in: isReceipt ? d(l.quantity) : new Decimal(0),
            out: isReceipt ? new Decimal(0) : d(l.quantity),
            price: d(l.retailUnitPriceWithVat || defaultPrice),
          });
        });
    });

  // 4. Inventory counts (surplus / shortage)
  inventoryCounts
    .filter((inv) => inv.storeId === storeId && inv.status === 'POSTED')
    .forEach((inv) => {
      inv.lines
        .filter((l) => l.itemId === itemId)
        .forEach((l) => {
          const diff = d(l.differenceQuantity);
          if (diff.gt(0)) {
            rawList.push({
              date: inv.postingDate || inv.docDate,
              docType: 'Popis (Inventurni višak)',
              docNumber: inv.docNumber,
              description: 'Zapisnik o višku',
              in: diff,
              out: new Decimal(0),
              price: d(l.retailUnitPriceWithVat || defaultPrice),
            });
          } else if (diff.lt(0)) {
            rawList.push({
              date: inv.postingDate || inv.docDate,
              docType: 'Popis (Inventurni manjak)',
              docNumber: inv.docNumber,
              description: 'Zapisnik o manjku',
              in: new Decimal(0),
              out: diff.abs(),
              price: d(l.retailUnitPriceWithVat || defaultPrice),
            });
          }
        });
    });

  // 5. Price levelings (price update)
  priceLevelings
    .filter((p) => p.storeId === storeId && p.status === 'POSTED')
    .forEach((p) => {
      p.lines
        .filter((l) => l.itemId === itemId)
        .forEach((l) => {
          rawList.push({
            date: p.postingDate || p.docDate,
            docType: 'Nivelacija cijena',
            docNumber: p.docNumber,
            description: `Izmjena cijene: ${l.oldRetailPriceWithVat} -> ${l.newRetailPriceWithVat}`,
            in: new Decimal(0),
            out: new Decimal(0),
            price: d(l.newRetailPriceWithVat),
          });
        });
    });

  // 6. POS Receipts
  posReceipts
    .filter((r) => r.storeId === storeId && r.status === 'POSTED')
    .forEach((r) => {
      r.lines
        .filter((l) => l.itemId === itemId)
        .forEach((l) => {
          const isRefund = r.receiptType === 'REFUND';
          rawList.push({
            date: r.issuedAt,
            docType: isRefund ? 'Storno POS račun' : 'Maloprodajni POS račun',
            docNumber: r.receiptNumber,
            description: `Fiskalni račun: ${r.fiscalNumber}`,
            in: isRefund ? d(l.quantity) : new Decimal(0),
            out: isRefund ? new Decimal(0) : d(l.quantity),
            price: d(l.retailUnitPriceWithVat || defaultPrice),
          });
        });
    });

  // Sort chronologically
  rawList.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  let runningBalance = new Decimal(0);
  let latestPrice = d(defaultPrice);

  return rawList.map((item, idx) => {
    runningBalance = runningBalance.plus(item.in).minus(item.out);
    if (item.price.gt(0)) {
      latestPrice = item.price;
    }
    const val = runningBalance.times(latestPrice);
    return {
      id: `mov-${idx + 1}`,
      date: item.date,
      docType: item.docType,
      docNumber: item.docNumber,
      description: item.description,
      inQty: round4(item.in),
      outQty: round4(item.out),
      balanceQty: round4(runningBalance),
      unitPrice: round2(latestPrice),
      totalValue: round2(val),
    };
  });
}
