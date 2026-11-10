import Decimal from 'decimal.js';
import { d, round2 } from '../../lib/money';
import { generateUuidV7 } from '../../lib/utils';
import type {
  Item,
  StoreItemPrice,
  TransferDocument,
  TransferLine,
  VatRate,
} from '../../types/domain';

export function buildTransferLine(params: {
  id?: string;
  itemId: string;
  quantity: string;
  sourceStoreId: string;
  targetStoreId: string;
  items: Item[];
  storePrices: StoreItemPrice[];
  vatRates: VatRate[];
  customTargetRetailPrice?: string;
}): TransferLine {
  const item = params.items.find((i) => i.id === params.itemId);
  const srcPrice = params.storePrices.find(
    (p) => p.storeId === params.sourceStoreId && p.itemId === params.itemId
  );
  const tgtPrice = params.storePrices.find(
    (p) => p.storeId === params.targetStoreId && p.itemId === params.itemId
  );
  const vatRate =
    params.vatRates.find((v) => v.id === item?.vatRateId)?.ratePercent ?? '17.00';

  const qty = d(params.quantity || '1.0000');
  const purchUnit = srcPrice?.purchaseUnitPrice ?? '5.0000';
  const srcMpc = srcPrice?.retailUnitPriceWithVat ?? '7.00';
  const tgtMpc = params.customTargetRetailPrice ?? (tgtPrice?.retailUnitPriceWithVat ?? srcMpc);

  return {
    id: params.id ?? generateUuidV7(),
    itemId: params.itemId,
    quantity: params.quantity || '1.0000',
    purchaseUnitPrice: purchUnit,
    purchaseTotalValue: round2(qty.mul(d(purchUnit))),
    sourceRetailUnitPrice: srcMpc,
    sourceRetailTotalValue: round2(qty.mul(d(srcMpc))),
    targetRetailUnitPrice: tgtMpc,
    targetRetailTotalValue: round2(qty.mul(d(tgtMpc))),
    vatRatePercent: vatRate,
  };
}

export function buildBlankTransferLine(): TransferLine {
  return {
    id: generateUuidV7(),
    itemId: '',
    quantity: '1.0000',
    purchaseUnitPrice: '0.0000',
    purchaseTotalValue: '0.00',
    sourceRetailUnitPrice: '0.00',
    sourceRetailTotalValue: '0.00',
    targetRetailUnitPrice: '0.00',
    targetRetailTotalValue: '0.00',
    vatRatePercent: '17.00',
  };
}

export function recomputeTransferDocTotals(
  doc: TransferDocument,
  nextLines: TransferLine[]
): TransferDocument {
  const totalPurchase = round2(
    nextLines.reduce((acc, l) => acc.plus(d(l.purchaseTotalValue || '0')), new Decimal(0))
  );
  const totalSourceRetail = round2(
    nextLines.reduce((acc, l) => acc.plus(d(l.sourceRetailTotalValue || '0')), new Decimal(0))
  );
  const totalTargetRetail = round2(
    nextLines.reduce((acc, l) => acc.plus(d(l.targetRetailTotalValue || '0')), new Decimal(0))
  );

  return {
    ...doc,
    lines: nextLines,
    totalPurchaseValue: totalPurchase,
    totalSourceRetailValue: totalSourceRetail,
    totalTargetRetailValue: totalTargetRetail,
  };
}
