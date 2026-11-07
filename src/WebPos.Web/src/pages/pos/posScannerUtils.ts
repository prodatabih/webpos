import Decimal from 'decimal.js';
import {
  calculatePosReceiptTotals,
  d,
  round2,
  round4,
  type PosReceiptTotalsResult,
} from '../../lib/money';
import { generateUuidV7 } from '../../lib/utils';
import type {
  Item,
  ItemBarcode,
  PaymentMethod,
  PosReceipt,
  PosTerminal,
  StoreItemPrice,
  VatRate,
} from '../../types/domain';

export interface PosCartLine {
  id: string;
  itemId: string;
  scannedBarcode: string;
  quantity: string;
  discountPercent: string;
}

export interface ResolvedScanResult {
  item: Item;
  scannedBarcode: string;
  quantityToAdd: string;
}

export function resolveScanInput(
  rawInput: string,
  defaultMultiplier: string,
  items: Item[],
  itemBarcodes: ItemBarcode[]
): ResolvedScanResult | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  let explicitQty = d(defaultMultiplier).gt(0) ? d(defaultMultiplier) : new Decimal(1);
  let codePart = trimmed;

  const starMatch = /^(\d+(?:[.,]\d+)?)\*(.+)$/.exec(trimmed);
  if (starMatch && starMatch[1] && starMatch[2]) {
    const parsedMult = d(starMatch[1].replace(',', '.'));
    if (parsedMult.gt(0)) {
      explicitQty = parsedMult;
      codePart = starMatch[2].trim();
    }
  }

  if (codePart.startsWith('27') && codePart.length >= 12 && /^\d+$/.test(codePart)) {
    const embeddedSku = codePart.slice(2, 7);
    const weightGramsStr = codePart.slice(7, 12);
    const weightKg = d(weightGramsStr).div(1000);
    const matchedWeighItem = items.find(
      (it) =>
        it.isActive &&
        (it.sku.padStart(5, '0') === embeddedSku || it.sku === String(Number(embeddedSku)))
    );
    if (matchedWeighItem && weightKg.gt(0)) {
      return {
        item: matchedWeighItem,
        scannedBarcode: codePart,
        quantityToAdd: round4(weightKg.mul(explicitQty)),
      };
    }
  }

  const packBarcode = itemBarcodes.find((b) => b.barcode.toLowerCase() === codePart.toLowerCase());
  if (packBarcode) {
    const parentItem = items.find((it) => it.id === packBarcode.itemId && it.isActive);
    if (parentItem) {
      const packMult = d(packBarcode.packMultiplier).gt(0)
        ? d(packBarcode.packMultiplier)
        : new Decimal(1);
      return {
        item: parentItem,
        scannedBarcode: packBarcode.barcode,
        quantityToAdd: round4(explicitQty.mul(packMult)),
      };
    }
  }

  const exactItem = items.find(
    (it) =>
      it.isActive &&
      (it.primaryBarcode.toLowerCase() === codePart.toLowerCase() ||
        it.sku.toLowerCase() === codePart.toLowerCase())
  );
  if (exactItem) {
    return {
      item: exactItem,
      scannedBarcode: exactItem.primaryBarcode,
      quantityToAdd: round4(explicitQty),
    };
  }

  const nameMatch = items.find(
    (it) =>
      it.isActive &&
      (it.name.toLowerCase().includes(codePart.toLowerCase()) ||
        it.shortName.toLowerCase().includes(codePart.toLowerCase()))
  );
  if (nameMatch) {
    return {
      item: nameMatch,
      scannedBarcode: nameMatch.primaryBarcode,
      quantityToAdd: round4(explicitQty),
    };
  }

  return null;
}

export function computeCartTotalsAndVat(
  lines: PosCartLine[],
  items: Item[],
  storePrices: StoreItemPrice[],
  vatRates: VatRate[],
  activeStoreId: string
) {
  const lineInputs = lines.map((line) => {
    const item = items.find((it) => it.id === line.itemId);
    const priceRec = storePrices.find((p) => p.storeId === activeStoreId && p.itemId === line.itemId);
    const vatRate = vatRates.find((v) => v.id === item?.vatRateId);
    return {
      quantity: line.quantity,
      retailUnitPriceWithVat:
        priceRec?.promoRetailPriceWithVat ?? priceRec?.retailUnitPriceWithVat ?? '0.00',
      discountPercent: line.discountPercent,
      vatRatePercent: vatRate?.ratePercent ?? '17.00',
      purchaseUnitPrice: priceRec?.purchaseUnitPrice ?? '0.0000',
    };
  });
  const totals = calculatePosReceiptTotals(lineInputs);
  const groups = new Map<string, { base: Decimal; vat: Decimal }>();
  lines.forEach((line, idx) => {
    const item = items.find((it) => it.id === line.itemId);
    const rateStr = vatRates.find((v) => v.id === item?.vatRateId)?.ratePercent ?? '17.00';
    const res = totals.lineResults[idx];
    if (!res) return;
    const cur = groups.get(rateStr) ?? { base: new Decimal(0), vat: new Decimal(0) };
    groups.set(rateStr, {
      base: cur.base.plus(d(res.lineNetExclVat)),
      vat: cur.vat.plus(d(res.lineVatAmount)),
    });
  });
  const vatBreakdown = Array.from(groups.entries()).map(([ratePercent, vals]) => ({
    ratePercent,
    baseAmount: round2(vals.base),
    vatAmount: round2(vals.vat),
  }));
  return { totals, vatBreakdown };
}

export function buildPosReceiptFromCart(params: {
  companyId: string;
  fiscalYearId: string;
  storeId: string;
  terminalId: string;
  activeTerminal?: PosTerminal;
  partnerId?: string;
  paymentMethod: PaymentMethod;
  cashReceived: string;
  cardAmount: string;
  wireAmount: string;
  cashierName: string;
  lines: PosCartLine[];
  totals: PosReceiptTotalsResult;
  items: Item[];
  storePrices: StoreItemPrice[];
  vatRates: VatRate[];
}): PosReceipt {
  const seq = (params.activeTerminal?.lastSequenceNumber ?? 100) + 1;
  const prefix = params.activeTerminal?.fiscalPrefix ?? 'POS1';
  const gross = d(params.totals.totalGrossAmount);
  const cashVal =
    params.paymentMethod === 'CASH'
      ? Decimal.max(gross, d(params.cashReceived))
      : params.paymentMethod === 'COMBINED'
        ? d(params.cashReceived)
        : new Decimal(0);
  const cardVal =
    params.paymentMethod === 'CARD'
      ? gross
      : params.paymentMethod === 'COMBINED'
        ? d(params.cardAmount)
        : new Decimal(0);
  const wireVal =
    params.paymentMethod === 'WIRE'
      ? gross
      : params.paymentMethod === 'COMBINED'
        ? d(params.wireAmount)
        : new Decimal(0);
  const changeVal = Decimal.max(new Decimal(0), cashVal.plus(cardVal).plus(wireVal).minus(gross));

  return {
    id: generateUuidV7(),
    companyId: params.companyId,
    fiscalYearId: params.fiscalYearId,
    storeId: params.storeId,
    terminalId: params.terminalId,
    receiptNumber: `${prefix}-${seq}`,
    fiscalNumber: `BF-${seq}`,
    receiptType: 'SALE',
    partnerId: params.partnerId || undefined,
    paymentMethod: params.paymentMethod,
    cashReceivedAmount: round2(cashVal),
    cardAmount: round2(cardVal),
    wireAmount: round2(wireVal),
    changeAmount: round2(changeVal),
    subtotalGrossBeforeDiscount: params.totals.subtotalGrossBeforeDiscount,
    totalDiscountAmount: params.totals.totalDiscountAmount,
    totalNetExclVat: params.totals.totalNetExclVat,
    totalVatAmount: params.totals.totalVatAmount,
    totalGrossAmount: params.totals.totalGrossAmount,
    totalCostOfGoodsSold: params.totals.totalCostOfGoodsSold,
    realizedMarginAmount: params.totals.realizedMarginAmount,
    cashierName: params.cashierName,
    issuedAt: new Date().toISOString(),
    status: 'POSTED',
    lines: params.lines.map((line, idx) => {
      const item = params.items.find((it) => it.id === line.itemId);
      const priceRec = params.storePrices.find(
        (p) => p.storeId === params.storeId && p.itemId === line.itemId
      );
      const vatRate = params.vatRates.find((v) => v.id === item?.vatRateId);
      const lr = params.totals.lineResults[idx];
      return {
        id: generateUuidV7(),
        itemId: line.itemId,
        scannedBarcode: line.scannedBarcode,
        quantity: line.quantity,
        purchaseUnitPrice: priceRec?.purchaseUnitPrice ?? '0.0000',
        retailUnitPriceWithVat:
          priceRec?.promoRetailPriceWithVat ?? priceRec?.retailUnitPriceWithVat ?? '0.00',
        discountPercent: line.discountPercent,
        vatRatePercent: vatRate?.ratePercent ?? '17.00',
        lineTotalWithVat: lr?.lineTotalWithVat ?? '0.00',
        lineNetExclVat: lr?.lineNetExclVat ?? '0.00',
        lineVatAmount: lr?.lineVatAmount ?? '0.00',
      };
    }),
  };
}
