import Decimal from 'decimal.js';
import { d, round2, round4 } from '../../lib/money';
import type {
  Item,
  PaymentMethod,
  PosReceipt,
  PosTerminal,
  StoreLocation,
  VatRate,
} from '../../types/domain';

export interface ItemTurnoverRow {
  itemId: string;
  sku: string;
  name: string;
  uom: string;
  categoryName: string;
  quantity: string;
  cogsTotal: string;
  marginTotal: string;
  netExclVat: string;
  vatAmount: string;
  grossWithVat: string;
}

export interface PaymentMethodTurnoverRow {
  method: PaymentMethod;
  receiptsCount: number;
  totalGross: string;
  totalNet: string;
  totalVat: string;
}

export interface TerminalTurnoverRow {
  terminalId: string;
  terminalCode: string;
  terminalName: string;
  storeCode: string;
  receiptsCount: number;
  cashAmount: string;
  cardAmount: string;
  wireAmount: string;
  totalGross: string;
}

export interface StoreTurnoverRow {
  storeId: string;
  storeCode: string;
  storeName: string;
  storeType: string;
  receiptsCount: number;
  totalNet: string;
  totalVat: string;
  totalGross: string;
}

export interface CashierTurnoverRow {
  cashierName: string;
  receiptsCount: number;
  cashAmount: string;
  cardAmount: string;
  wireAmount: string;
  totalGross: string;
}

export interface VatRateRecapRow {
  rateCode: string;
  ratePercent: string;
  netBase: string;
  vatAmount: string;
  grossTotal: string;
}

export interface DailyTurnoverSummary {
  receiptsCount: number;
  totalGross: string;
  totalNet: string;
  totalVat: string;
  totalCogs: string;
  totalMargin: string;
  totalCash: string;
  totalCard: string;
  totalWire: string;
}

export function filterReceiptsByPeriod(
  receipts: PosReceipt[],
  companyId: string,
  dateFrom: string,
  dateTo: string
): PosReceipt[] {
  return receipts.filter((r) => {
    if (r.companyId !== companyId) return false;
    if (r.status !== 'POSTED') return false;
    const dateStr = r.issuedAt.slice(0, 10);
    if (dateFrom && dateStr < dateFrom) return false;
    if (dateTo && dateStr > dateTo) return false;
    return true;
  });
}

export function calculateSummary(receipts: PosReceipt[]): DailyTurnoverSummary {
  let gross = new Decimal(0);
  let net = new Decimal(0);
  let vat = new Decimal(0);
  let cogs = new Decimal(0);
  let margin = new Decimal(0);
  let cash = new Decimal(0);
  let card = new Decimal(0);
  let wire = new Decimal(0);

  receipts.forEach((r) => {
    const sign = r.receiptType === 'REFUND' ? -1 : 1;
    gross = gross.plus(d(r.totalGrossAmount).times(sign));
    net = net.plus(d(r.totalNetExclVat).times(sign));
    vat = vat.plus(d(r.totalVatAmount).times(sign));
    cogs = cogs.plus(d(r.totalCostOfGoodsSold).times(sign));
    margin = margin.plus(d(r.realizedMarginAmount).times(sign));
    cash = cash.plus(d(r.cashReceivedAmount || 0).times(sign));
    card = card.plus(d(r.cardAmount || 0).times(sign));
    wire = wire.plus(d(r.wireAmount || 0).times(sign));
  });

  return {
    receiptsCount: receipts.length,
    totalGross: round2(gross),
    totalNet: round2(net),
    totalVat: round2(vat),
    totalCogs: round2(cogs),
    totalMargin: round2(margin),
    totalCash: round2(cash),
    totalCard: round2(card),
    totalWire: round2(wire),
  };
}

export function aggregateByItems(receipts: PosReceipt[], items: Item[]): ItemTurnoverRow[] {
  const map = new Map<string, { qty: Decimal; cogs: Decimal; margin: Decimal; net: Decimal; vat: Decimal; gross: Decimal }>();

  receipts.forEach((r) => {
    const sign = r.receiptType === 'REFUND' ? -1 : 1;
    r.lines.forEach((line) => {
      const cur = map.get(line.itemId) ?? {
        qty: new Decimal(0),
        cogs: new Decimal(0),
        margin: new Decimal(0),
        net: new Decimal(0),
        vat: new Decimal(0),
        gross: new Decimal(0),
      };
      const lineQty = d(line.quantity).times(sign);
      const lineGross = d(line.lineTotalWithVat).times(sign);
      const lineNet = d(line.lineNetExclVat).times(sign);
      const lineVat = d(line.lineVatAmount).times(sign);
      const lineCogs = d(line.purchaseUnitPrice).times(lineQty);
      const lineMargin = lineNet.minus(lineCogs);

      cur.qty = cur.qty.plus(lineQty);
      cur.gross = cur.gross.plus(lineGross);
      cur.net = cur.net.plus(lineNet);
      cur.vat = cur.vat.plus(lineVat);
      cur.cogs = cur.cogs.plus(lineCogs);
      cur.margin = cur.margin.plus(lineMargin);
      map.set(line.itemId, cur);
    });
  });

  return Array.from(map.entries()).map(([itemId, agg]) => {
    const it = items.find((x) => x.id === itemId);
    return {
      itemId,
      sku: it?.sku ?? itemId,
      name: it?.name ?? itemId,
      uom: it?.uom ?? 'kom',
      categoryName: it?.categoryName ?? '-',
      quantity: round4(agg.qty),
      cogsTotal: round2(agg.cogs),
      marginTotal: round2(agg.margin),
      netExclVat: round2(agg.net),
      vatAmount: round2(agg.vat),
      grossWithVat: round2(agg.gross),
    };
  });
}

export function aggregateByPaymentMethods(receipts: PosReceipt[]): PaymentMethodTurnoverRow[] {
  const methods: PaymentMethod[] = ['CASH', 'CARD', 'WIRE', 'COMBINED'];
  return methods.map((m) => {
    const matching = receipts.filter((r) => r.paymentMethod === m);
    let gross = new Decimal(0);
    let net = new Decimal(0);
    let vat = new Decimal(0);
    matching.forEach((r) => {
      const sign = r.receiptType === 'REFUND' ? -1 : 1;
      gross = gross.plus(d(r.totalGrossAmount).times(sign));
      net = net.plus(d(r.totalNetExclVat).times(sign));
      vat = vat.plus(d(r.totalVatAmount).times(sign));
    });
    return {
      method: m,
      receiptsCount: matching.length,
      totalGross: round2(gross),
      totalNet: round2(net),
      totalVat: round2(vat),
    };
  });
}

export function aggregateByTerminals(
  receipts: PosReceipt[],
  terminals: PosTerminal[],
  stores: StoreLocation[]
): TerminalTurnoverRow[] {
  const map = new Map<string, { count: number; cash: Decimal; card: Decimal; wire: Decimal; gross: Decimal }>();

  receipts.forEach((r) => {
    const cur = map.get(r.terminalId) ?? {
      count: 0,
      cash: new Decimal(0),
      card: new Decimal(0),
      wire: new Decimal(0),
      gross: new Decimal(0),
    };
    const sign = r.receiptType === 'REFUND' ? -1 : 1;
    cur.count += 1;
    cur.cash = cur.cash.plus(d(r.cashReceivedAmount || 0).times(sign));
    cur.card = cur.card.plus(d(r.cardAmount || 0).times(sign));
    cur.wire = cur.wire.plus(d(r.wireAmount || 0).times(sign));
    cur.gross = cur.gross.plus(d(r.totalGrossAmount).times(sign));
    map.set(r.terminalId, cur);
  });

  return Array.from(map.entries()).map(([termId, agg]) => {
    const term = terminals.find((t) => t.id === termId);
    const store = stores.find((s) => s.id === term?.storeId);
    return {
      terminalId: termId,
      terminalCode: term?.code ?? termId,
      terminalName: term?.name ?? '-',
      storeCode: store?.code ?? '-',
      receiptsCount: agg.count,
      cashAmount: round2(agg.cash),
      cardAmount: round2(agg.card),
      wireAmount: round2(agg.wire),
      totalGross: round2(agg.gross),
    };
  });
}

export function aggregateByStores(receipts: PosReceipt[], stores: StoreLocation[]): StoreTurnoverRow[] {
  const map = new Map<string, { count: number; net: Decimal; vat: Decimal; gross: Decimal }>();

  receipts.forEach((r) => {
    const cur = map.get(r.storeId) ?? {
      count: 0,
      net: new Decimal(0),
      vat: new Decimal(0),
      gross: new Decimal(0),
    };
    const sign = r.receiptType === 'REFUND' ? -1 : 1;
    cur.count += 1;
    cur.net = cur.net.plus(d(r.totalNetExclVat).times(sign));
    cur.vat = cur.vat.plus(d(r.totalVatAmount).times(sign));
    cur.gross = cur.gross.plus(d(r.totalGrossAmount).times(sign));
    map.set(r.storeId, cur);
  });

  return Array.from(map.entries()).map(([storeId, agg]) => {
    const store = stores.find((s) => s.id === storeId);
    return {
      storeId,
      storeCode: store?.code ?? storeId,
      storeName: store?.name ?? '-',
      storeType: store?.storeType ?? 'RETAIL',
      receiptsCount: agg.count,
      totalNet: round2(agg.net),
      totalVat: round2(agg.vat),
      totalGross: round2(agg.gross),
    };
  });
}

export function aggregateByCashiers(receipts: PosReceipt[]): CashierTurnoverRow[] {
  const map = new Map<string, { count: number; cash: Decimal; card: Decimal; wire: Decimal; gross: Decimal }>();

  receipts.forEach((r) => {
    const name = r.cashierName || 'Nepoznat';
    const cur = map.get(name) ?? {
      count: 0,
      cash: new Decimal(0),
      card: new Decimal(0),
      wire: new Decimal(0),
      gross: new Decimal(0),
    };
    const sign = r.receiptType === 'REFUND' ? -1 : 1;
    cur.count += 1;
    cur.cash = cur.cash.plus(d(r.cashReceivedAmount || 0).times(sign));
    cur.card = cur.card.plus(d(r.cardAmount || 0).times(sign));
    cur.wire = cur.wire.plus(d(r.wireAmount || 0).times(sign));
    cur.gross = cur.gross.plus(d(r.totalGrossAmount).times(sign));
    map.set(name, cur);
  });

  return Array.from(map.entries()).map(([cashierName, agg]) => ({
    cashierName,
    receiptsCount: agg.count,
    cashAmount: round2(agg.cash),
    cardAmount: round2(agg.card),
    wireAmount: round2(agg.wire),
    totalGross: round2(agg.gross),
  }));
}

export function aggregateVatRecap(receipts: PosReceipt[], vatRates: VatRate[]): VatRateRecapRow[] {
  const map = new Map<string, { net: Decimal; vat: Decimal; gross: Decimal }>();

  receipts.forEach((r) => {
    const sign = r.receiptType === 'REFUND' ? -1 : 1;
    r.lines.forEach((line) => {
      const ratePct = line.vatRatePercent;
      const cur = map.get(ratePct) ?? {
        net: new Decimal(0),
        vat: new Decimal(0),
        gross: new Decimal(0),
      };
      cur.net = cur.net.plus(d(line.lineNetExclVat).times(sign));
      cur.vat = cur.vat.plus(d(line.lineVatAmount).times(sign));
      cur.gross = cur.gross.plus(d(line.lineTotalWithVat).times(sign));
      map.set(ratePct, cur);
    });
  });

  return Array.from(map.entries()).map(([ratePercent, agg]) => {
    const vr = vatRates.find((v) => round2(v.ratePercent) === round2(ratePercent));
    return {
      rateCode: vr?.code ?? (ratePercent === '0.00' ? 'K' : 'E'),
      ratePercent,
      netBase: round2(agg.net),
      vatAmount: round2(agg.vat),
      grossTotal: round2(agg.gross),
    };
  });
}
