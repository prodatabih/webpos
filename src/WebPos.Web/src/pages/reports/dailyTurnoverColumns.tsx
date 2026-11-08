import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { t } from '../../i18n';
import { formatMoney2, formatQty } from '../../lib/money';
import { formatDateTimeBs } from '../../lib/utils';
import type { PosReceipt } from '../../types/domain';
import { Badge, DocumentStatusBadge } from '../../components/ui/Badge';
import type {
  CashierTurnoverRow,
  ItemTurnoverRow,
  PaymentMethodTurnoverRow,
  StoreTurnoverRow,
  TerminalTurnoverRow,
} from './dailyTurnoverUtils';

export function useTurnoverColumns() {
  const itemColumns = useMemo<ColumnDef<ItemTurnoverRow>[]>(
    () => [
      { accessorKey: 'sku', header: t('master.sku'), cell: ({ row }) => <span className="font-mono font-semibold">{row.original.sku}</span> },
      { accessorKey: 'name', header: t('common.name'), cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-[11px] text-muted-foreground">{row.original.categoryName}</span>
        </div>
      )},
      { accessorKey: 'uom', header: t('common.uom'), cell: ({ row }) => <Badge variant="outline">{row.original.uom}</Badge> },
      { accessorKey: 'quantity', header: t('reports.soldQuantity'), cell: ({ row }) => <div className="text-right font-mono font-semibold">{formatQty(row.original.quantity, 2)}</div> },
      { accessorKey: 'cogsTotal', header: t('reports.purchaseTotal'), cell: ({ row }) => <div className="text-right font-mono">{formatMoney2(row.original.cogsTotal, true)}</div> },
      { accessorKey: 'marginTotal', header: t('reports.realizedMargin'), cell: ({ row }) => <div className="text-right font-mono text-success">{formatMoney2(row.original.marginTotal, true)}</div> },
      { accessorKey: 'netExclVat', header: t('reports.sellingTotalExclVat'), cell: ({ row }) => <div className="text-right font-mono">{formatMoney2(row.original.netExclVat, true)}</div> },
      { accessorKey: 'vatAmount', header: t('reports.vatTotal'), cell: ({ row }) => <div className="text-right font-mono">{formatMoney2(row.original.vatAmount, true)}</div> },
      { accessorKey: 'grossWithVat', header: t('reports.retailTotal'), cell: ({ row }) => <div className="text-right font-mono font-bold text-primary">{formatMoney2(row.original.grossWithVat, true)}</div> },
    ],
    []
  );

  const paymentColumns = useMemo<ColumnDef<PaymentMethodTurnoverRow>[]>(
    () => [
      { accessorKey: 'method', header: t('pos.paymentMethod'), cell: ({ row }) => <span className="font-medium">{row.original.method}</span> },
      { accessorKey: 'receiptsCount', header: t('reports.receiptsCount'), cell: ({ row }) => <div className="text-right font-mono">{row.original.receiptsCount}</div> },
      { accessorKey: 'totalNet', header: t('reports.sellingTotalExclVat'), cell: ({ row }) => <div className="text-right font-mono">{formatMoney2(row.original.totalNet, true)}</div> },
      { accessorKey: 'totalVat', header: t('reports.vatTotal'), cell: ({ row }) => <div className="text-right font-mono">{formatMoney2(row.original.totalVat, true)}</div> },
      { accessorKey: 'totalGross', header: t('reports.retailTotal'), cell: ({ row }) => <div className="text-right font-mono font-bold text-primary">{formatMoney2(row.original.totalGross, true)}</div> },
    ],
    []
  );

  const receiptColumns = useMemo<ColumnDef<PosReceipt>[]>(
    () => [
      { accessorKey: 'receiptNumber', header: t('warehouse.docNumber'), cell: ({ row }) => <span className="font-mono font-semibold">{row.original.receiptNumber}</span> },
      { accessorKey: 'fiscalNumber', header: t('pos.originalFiscalNumber'), cell: ({ row }) => <span className="font-mono">{row.original.fiscalNumber}</span> },
      { accessorKey: 'issuedAt', header: t('common.date'), cell: ({ row }) => formatDateTimeBs(row.original.issuedAt) },
      { accessorKey: 'cashierName', header: t('reports.byCashiers'), cell: ({ row }) => <span>{row.original.cashierName}</span> },
      { accessorKey: 'paymentMethod', header: t('pos.paymentMethod'), cell: ({ row }) => <Badge variant="outline">{row.original.paymentMethod}</Badge> },
      { accessorKey: 'totalNetExclVat', header: t('reports.sellingTotalExclVat'), cell: ({ row }) => <div className="text-right font-mono">{formatMoney2(row.original.totalNetExclVat, true)}</div> },
      { accessorKey: 'totalVatAmount', header: t('reports.vatTotal'), cell: ({ row }) => <div className="text-right font-mono">{formatMoney2(row.original.totalVatAmount, true)}</div> },
      { accessorKey: 'totalGrossAmount', header: t('reports.retailTotal'), cell: ({ row }) => <div className="text-right font-mono font-bold">{formatMoney2(row.original.totalGrossAmount, true)}</div> },
      { accessorKey: 'status', header: t('common.status'), cell: ({ row }) => <DocumentStatusBadge status={row.original.status} /> },
    ],
    []
  );

  const terminalColumns = useMemo<ColumnDef<TerminalTurnoverRow>[]>(
    () => [
      { accessorKey: 'terminalCode', header: t('app.terminal'), cell: ({ row }) => <span className="font-mono font-bold">{row.original.terminalCode}</span> },
      { accessorKey: 'terminalName', header: t('common.name'), cell: ({ row }) => <span>{row.original.terminalName}</span> },
      { accessorKey: 'storeCode', header: t('reports.byStores'), cell: ({ row }) => <Badge variant="outline">{row.original.storeCode}</Badge> },
      { accessorKey: 'receiptsCount', header: t('reports.receiptsCount'), cell: ({ row }) => <div className="text-right font-mono">{row.original.receiptsCount}</div> },
      { accessorKey: 'cashAmount', header: t('pos.payCash'), cell: ({ row }) => <div className="text-right font-mono">{formatMoney2(row.original.cashAmount, true)}</div> },
      { accessorKey: 'cardAmount', header: t('pos.payCard'), cell: ({ row }) => <div className="text-right font-mono">{formatMoney2(row.original.cardAmount, true)}</div> },
      { accessorKey: 'totalGross', header: t('reports.retailTotal'), cell: ({ row }) => <div className="text-right font-mono font-bold text-primary">{formatMoney2(row.original.totalGross, true)}</div> },
    ],
    []
  );

  const storeColumns = useMemo<ColumnDef<StoreTurnoverRow>[]>(
    () => [
      { accessorKey: 'storeCode', header: t('common.code'), cell: ({ row }) => <span className="font-mono font-bold">{row.original.storeCode}</span> },
      { accessorKey: 'storeName', header: t('common.name'), cell: ({ row }) => <span>{row.original.storeName}</span> },
      { accessorKey: 'storeType', header: t('master.itemType'), cell: ({ row }) => <Badge variant="outline">{row.original.storeType}</Badge> },
      { accessorKey: 'receiptsCount', header: t('reports.receiptsCount'), cell: ({ row }) => <div className="text-right font-mono">{row.original.receiptsCount}</div> },
      { accessorKey: 'totalNet', header: t('reports.sellingTotalExclVat'), cell: ({ row }) => <div className="text-right font-mono">{formatMoney2(row.original.totalNet, true)}</div> },
      { accessorKey: 'totalVat', header: t('reports.vatTotal'), cell: ({ row }) => <div className="text-right font-mono">{formatMoney2(row.original.totalVat, true)}</div> },
      { accessorKey: 'totalGross', header: t('reports.retailTotal'), cell: ({ row }) => <div className="text-right font-mono font-bold text-primary">{formatMoney2(row.original.totalGross, true)}</div> },
    ],
    []
  );

  const cashierColumns = useMemo<ColumnDef<CashierTurnoverRow>[]>(
    () => [
      { accessorKey: 'cashierName', header: t('reports.byCashiers'), cell: ({ row }) => <span className="font-semibold">{row.original.cashierName}</span> },
      { accessorKey: 'receiptsCount', header: t('reports.receiptsCount'), cell: ({ row }) => <div className="text-right font-mono">{row.original.receiptsCount}</div> },
      { accessorKey: 'cashAmount', header: t('pos.payCash'), cell: ({ row }) => <div className="text-right font-mono">{formatMoney2(row.original.cashAmount, true)}</div> },
      { accessorKey: 'cardAmount', header: t('pos.payCard'), cell: ({ row }) => <div className="text-right font-mono">{formatMoney2(row.original.cardAmount, true)}</div> },
      { accessorKey: 'totalGross', header: t('reports.retailTotal'), cell: ({ row }) => <div className="text-right font-mono font-bold text-primary">{formatMoney2(row.original.totalGross, true)}</div> },
    ],
    []
  );

  return { itemColumns, paymentColumns, receiptColumns, terminalColumns, storeColumns, cashierColumns };
}
