import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { FileText, Printer, RotateCcw, Send, ShoppingCart } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { t } from '../../i18n';
import { formatMoney2 } from '../../lib/money';
import { formatDateTimeBs } from '../../lib/utils';
import { EMPTY_COMPANY_FALLBACK, EMPTY_STORE_FALLBACK } from '../../lib/emptyOrgFallbacks';
import type { PosReceipt } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge, DocumentStatusBadge } from '../../components/ui/Badge';
import { showToast } from '../../components/ui/Toast';
import { PosTaxInvoiceModal } from './PosTaxInvoiceModal';
import { PosReprintReceiptModal } from './PosReprintReceiptModal';

export function PosReceiptsPage() {
  const navigate = useNavigate();
  const { activeStoreId, activeCompanyId, posReceipts, items, partners, companies, storeLocations, refundPosReceipt } = useAppStore();

  const [receiptFilter, setReceiptFilter] = useState('');
  const [fiscalFilter, setFiscalFilter] = useState('');
  const [cashierFilter, setCashierFilter] = useState('');
  const [partnerFilter, setPartnerFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [invoiceReceipt, setInvoiceReceipt] = useState<PosReceipt | null>(null);
  const [reprintReceipt, setReprintReceipt] = useState<PosReceipt | null>(null);

  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? companies[0] ?? EMPTY_COMPANY_FALLBACK;
  const currentStore = storeLocations.find((s) => s.id === activeStoreId) ?? storeLocations[0] ?? EMPTY_STORE_FALLBACK;

  const filteredReceipts = useMemo(() => {
    return posReceipts
      .filter((r) => r.storeId === activeStoreId)
      .filter((r) => (receiptFilter ? r.receiptNumber.toLowerCase().includes(receiptFilter.toLowerCase()) : true))
      .filter((r) => (fiscalFilter ? r.fiscalNumber.toLowerCase().includes(fiscalFilter.toLowerCase()) : true))
      .filter((r) => (cashierFilter ? r.cashierName.toLowerCase().includes(cashierFilter.toLowerCase()) : true))
      .filter((r) => (partnerFilter === 'ALL' ? true : r.partnerId === partnerFilter))
      .filter((r) => {
        const dStr = r.issuedAt.slice(0, 10);
        if (dateFrom && dStr < dateFrom) return false;
        if (dateTo && dStr > dateTo) return false;
        return true;
      });
  }, [posReceipts, activeStoreId, receiptFilter, fiscalFilter, cashierFilter, partnerFilter, dateFrom, dateTo]);

  const handleRefund = (receipt: PosReceipt) => {
    const res = refundPosReceipt(receipt.id);
    if (res.ok) {
      showToast({ title: t('messages.documentReversed'), description: `${t('pos.originalFiscalNumber')}: ${receipt.fiscalNumber}`, variant: 'success' });
    } else if (res.error) {
      showToast({ title: res.error, variant: 'error' });
    }
  };

  const handleFiscalize = (receipt: PosReceipt) => {
    showToast({
      title: t('pos.fiscalizeSuccess'),
      description: `${receipt.receiptNumber} (${receipt.fiscalNumber})`,
      variant: 'success',
    });
  };

  const columns = useMemo<ColumnDef<PosReceipt>[]>(
    () => [
      {
        accessorKey: 'receiptNumber',
        header: t('warehouse.docNumber'),
        cell: ({ row }) => <span className="font-mono font-semibold">{row.original.receiptNumber}</span>,
      },
      {
        accessorKey: 'fiscalNumber',
        header: t('pos.originalFiscalNumber'),
        cell: ({ row }) => (
          <div className="flex flex-col font-mono text-xs">
            <span className="font-medium text-foreground">{row.original.fiscalNumber}</span>
            {row.original.referenceFiscalNumber && <span className="text-[10px] text-destructive">← {row.original.referenceFiscalNumber}</span>}
          </div>
        ),
      },
      {
        accessorKey: 'issuedAt',
        header: t('common.date'),
        cell: ({ row }) => formatDateTimeBs(row.original.issuedAt),
      },
      {
        accessorKey: 'cashierName',
        header: t('app.operator'),
        cell: ({ row }) => <span className="text-xs">{row.original.cashierName}</span>,
      },
      {
        accessorKey: 'partnerId',
        header: t('pos.b2bBuyer'),
        cell: ({ row }) => {
          const pt = partners.find((p) => p.id === row.original.partnerId);
          return <span className="text-xs font-medium">{pt?.name ?? '-'}</span>;
        },
      },
      {
        accessorKey: 'receiptType',
        header: t('common.status'),
        cell: ({ row }) => (
          <Badge variant={row.original.receiptType === 'REFUND' ? 'destructive' : 'default'}>
            {row.original.receiptType === 'REFUND' ? t('status.REFUND') : t('status.SALE')}
          </Badge>
        ),
      },
      {
        accessorKey: 'totalGrossAmount',
        header: t('common.total'),
        cell: ({ row }) => <div className="text-right font-mono font-bold text-primary">{formatMoney2(row.original.totalGrossAmount, true)}</div>,
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
          return (
            <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" onClick={() => setReprintReceipt(r)} title={t('pos.reprintReceipt')}>
                <Printer className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleFiscalize(r)} title={t('pos.fiscalize')}>
                <Send className="h-3.5 w-3.5 text-primary" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setInvoiceReceipt(r)} title={t('pos.taxInvoice')}>
                <FileText className="h-3.5 w-3.5 text-success" />
              </Button>
              {r.receiptType === 'SALE' && r.status === 'POSTED' && (
                <Button variant="destructive" size="sm" onClick={() => handleRefund(r)} title={t('status.REFUND')}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [partners]
  );

  return (
    <div className="flex flex-col min-h-full">
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

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 p-3.5 rounded-lg border border-border bg-card text-xs">
          <input
            type="text"
            placeholder={t('pos.searchByReceipt')}
            value={receiptFilter}
            onChange={(e) => setReceiptFilter(e.target.value)}
            className="h-8 rounded border border-input bg-card px-2.5 font-mono text-foreground"
          />
          <input
            type="text"
            placeholder={t('pos.searchByFiscal')}
            value={fiscalFilter}
            onChange={(e) => setFiscalFilter(e.target.value)}
            className="h-8 rounded border border-input bg-card px-2.5 font-mono text-foreground"
          />
          <input
            type="text"
            placeholder={t('app.operator')}
            value={cashierFilter}
            onChange={(e) => setCashierFilter(e.target.value)}
            className="h-8 rounded border border-input bg-card px-2.5 text-foreground"
          />
          <select
            value={partnerFilter}
            onChange={(e) => setPartnerFilter(e.target.value)}
            className="h-8 rounded border border-input bg-card px-2 text-foreground font-medium"
          >
            <option value="ALL">{t('pos.b2bBuyer')} ({t('common.all')})</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 rounded border border-input bg-card px-2 font-mono text-foreground"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 rounded border border-input bg-card px-2 font-mono text-foreground"
          />
        </div>

        <DataTable
          data={filteredReceipts}
          columns={columns}
          exportFileName="pos-fiskalni-racuni"
          onRowClick={(r) => setReprintReceipt(r)}
        />
      </div>

      {invoiceReceipt && (
        <PosTaxInvoiceModal
          open={Boolean(invoiceReceipt)}
          onClose={() => setInvoiceReceipt(null)}
          receipt={invoiceReceipt}
          company={activeCompany}
          partner={partners.find((p) => p.id === invoiceReceipt.partnerId)}
          items={items}
        />
      )}

      {reprintReceipt && (
        <PosReprintReceiptModal
          open={Boolean(reprintReceipt)}
          onClose={() => setReprintReceipt(null)}
          receipt={reprintReceipt}
          company={activeCompany}
          store={currentStore}
          items={items}
        />
      )}
    </div>
  );
}
export default PosReceiptsPage;
