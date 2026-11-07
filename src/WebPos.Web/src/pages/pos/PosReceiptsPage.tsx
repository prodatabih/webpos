import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Eye, RotateCcw, ShoppingCart } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { t } from '../../i18n';
import { formatMoney2, formatQty } from '../../lib/money';
import { formatDateTimeBs } from '../../lib/utils';
import type { PaymentMethod, PosReceipt } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge, DocumentStatusBadge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { showToast } from '../../components/ui/Toast';

export function PosReceiptsPage() {
  const navigate = useNavigate();
  const activeStoreId = useAppStore((s) => s.activeStoreId);
  const posReceipts = useAppStore((s) => s.posReceipts);
  const items = useAppStore((s) => s.items);
  const partners = useAppStore((s) => s.partners);
  const refundPosReceipt = useAppStore((s) => s.refundPosReceipt);
  const [selectedReceipt, setSelectedReceipt] = useState<PosReceipt | null>(null);

  const storeReceipts = useMemo(
    () => posReceipts.filter((r) => r.storeId === activeStoreId),
    [posReceipts, activeStoreId]
  );

  const formatPaymentMethod = (method: PaymentMethod) => {
    if (method === 'CASH') return t('pos.payCash');
    if (method === 'CARD') return t('pos.payCard');
    if (method === 'WIRE') return t('pos.payWire');
    return t('pos.payCombined');
  };

  const handleRefund = (receipt: PosReceipt) => {
    const res = refundPosReceipt(receipt.id);
    if (res.ok) {
      showToast({
        title: t('messages.documentReversed'),
        description: `${t('pos.originalFiscalNumber')}: ${receipt.fiscalNumber}`,
        variant: 'success',
      });
      setSelectedReceipt(null);
    } else if (res.error) {
      showToast({ title: res.error, variant: 'error' });
    }
  };

  const columns = useMemo<ColumnDef<PosReceipt>[]>(
    () => [
      {
        accessorKey: 'receiptNumber',
        header: t('warehouse.docNumber'),
        cell: ({ row }) => <span className="font-mono font-semibold text-foreground">{row.original.receiptNumber}</span>,
      },
      {
        accessorKey: 'fiscalNumber',
        header: t('pos.originalFiscalNumber'),
        cell: ({ row }) => (
          <div className="flex flex-col font-mono text-xs">
            <span>{row.original.fiscalNumber}</span>
            {row.original.referenceFiscalNumber && (
              <span className="text-[11px] text-destructive">← {row.original.referenceFiscalNumber}</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'issuedAt',
        header: t('common.date'),
        cell: ({ row }) => formatDateTimeBs(row.original.issuedAt),
      },
      {
        accessorKey: 'receiptType',
        header: t('common.description'),
        cell: ({ row }) => (
          <Badge variant={row.original.receiptType === 'REFUND' ? 'destructive' : 'default'}>
            {row.original.receiptType === 'REFUND' ? t('status.REFUND') : t('status.SALE')}
          </Badge>
        ),
      },
      {
        accessorKey: 'paymentMethod',
        header: t('pos.paymentMethod'),
        cell: ({ row }) => formatPaymentMethod(row.original.paymentMethod),
      },
      {
        accessorKey: 'totalNetExclVat',
        header: t('pos.baseExclVat'),
        cell: ({ row }) => <span className="font-mono">{formatMoney2(row.original.totalNetExclVat, true)}</span>,
      },
      {
        accessorKey: 'totalVatAmount',
        header: t('pos.vatAmount'),
        cell: ({ row }) => <span className="font-mono">{formatMoney2(row.original.totalVatAmount, true)}</span>,
      },
      {
        accessorKey: 'totalGrossAmount',
        header: t('common.total'),
        cell: ({ row }) => <span className="font-mono font-semibold">{formatMoney2(row.original.totalGrossAmount, true)}</span>,
      },
      {
        accessorKey: 'status',
        header: t('common.status'),
        cell: ({ row }) => <DocumentStatusBadge status={row.original.status} />,
      },
      {
        id: 'actions',
        header: t('common.actions'),
        cell: ({ row }) => {
          const r = row.original;
          const canRefund = r.receiptType === 'SALE' && r.status === 'POSTED';
          return (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" onClick={() => setSelectedReceipt(r)}>
                <Eye className="h-3.5 w-3.5" />
                <span>{t('common.view')}</span>
              </Button>
              {canRefund && (
                <Button variant="destructive" size="sm" onClick={() => handleRefund(r)}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{t('status.REFUND')}</span>
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t('nav.posReceipts')}
        breadcrumbs={[{ label: t('nav.groupPos') }, { label: t('nav.posReceipts') }]}
        primaryAction={
          <Button variant="primary" size="sm" onClick={() => navigate('/pos')}>
            <ShoppingCart className="h-4 w-4" />
            <span>{t('nav.posRegister')}</span>
          </Button>
        }
      />

      <div className="p-6">
        <DataTable data={storeReceipts} columns={columns} exportFileName="pos-receipts" onRowClick={setSelectedReceipt} />
      </div>

      <Dialog
        open={Boolean(selectedReceipt)}
        onOpenChange={(open) => !open && setSelectedReceipt(null)}
        title={selectedReceipt ? `${selectedReceipt.receiptNumber} (${selectedReceipt.fiscalNumber})` : ''}
        description={selectedReceipt ? formatDateTimeBs(selectedReceipt.issuedAt) : undefined}
        size="lg"
        footer={
          selectedReceipt && (
            <>
              {selectedReceipt.receiptType === 'SALE' && selectedReceipt.status === 'POSTED' && (
                <Button variant="destructive" onClick={() => handleRefund(selectedReceipt)}>
                  <RotateCcw className="h-4 w-4" />
                  <span>{t('pos.refundReceipt')}</span>
                </Button>
              )}
              <Button variant="outline" onClick={() => setSelectedReceipt(null)}>{t('common.close')}</Button>
            </>
          )
        }
      >
        {selectedReceipt && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/30 p-3 sm:grid-cols-4">
              <div>
                <div className="text-muted-foreground">{t('app.operator')}</div>
                <div className="font-semibold">{selectedReceipt.cashierName}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t('pos.paymentMethod')}</div>
                <div className="font-semibold">{formatPaymentMethod(selectedReceipt.paymentMethod)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t('pos.b2bBuyer')}</div>
                <div className="font-semibold">{partners.find((p) => p.id === selectedReceipt.partnerId)?.name ?? '-'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t('pos.originalFiscalNumber')}</div>
                <div className="font-mono font-semibold">{selectedReceipt.referenceFiscalNumber ?? selectedReceipt.fiscalNumber}</div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/60 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-semibold">{t('common.name')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('common.quantity')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('warehouse.retailPriceWithVat')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('pos.discountPercent')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('common.total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {selectedReceipt.lines.map((line) => {
                    const item = items.find((i) => i.id === line.itemId);
                    return (
                      <tr key={line.id}>
                        <td className="px-3 py-2">
                          <div className="font-medium">{item?.name ?? line.itemId}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">{line.scannedBarcode}</div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{formatQty(line.quantity, 3)}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatMoney2(line.retailUnitPriceWithVat, true)}</td>
                        <td className="px-3 py-2 text-right font-mono">{line.discountPercent}%</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold">{formatMoney2(line.lineTotalWithVat, true)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
export default PosReceiptsPage;
