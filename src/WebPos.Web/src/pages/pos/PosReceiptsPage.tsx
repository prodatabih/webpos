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
import { Dialog } from '../../components/ui/Dialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Input } from '../../components/ui/Input';
import { showToast } from '../../components/ui/Toast';
import { PosTaxInvoiceModal } from './PosTaxInvoiceModal';
import { PosReprintReceiptModal } from './PosReprintReceiptModal';

function isReceiptFiscalized(r: PosReceipt): boolean {
  if (r.isFiscalized === true) return true;
  if (r.isFiscalized === false) return false;
  return Boolean(r.fiscalNumber && r.fiscalNumber.trim().length > 0);
}

export function PosReceiptsPage() {
  const navigate = useNavigate();
  const {
    activeStoreId,
    activeCompanyId,
    posReceipts,
    items,
    partners,
    companies,
    storeLocations,
    refundPosReceipt,
    fiscalizePosReceipt,
  } = useAppStore();

  const [receiptFilter, setReceiptFilter] = useState('');
  const [fiscalFilter, setFiscalFilter] = useState('');
  const [cashierFilter, setCashierFilter] = useState('');
  const [partnerFilter, setPartnerFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [invoiceReceipt, setInvoiceReceipt] = useState<PosReceipt | null>(null);
  const [reprintReceipt, setReprintReceipt] = useState<PosReceipt | null>(null);

  const [fiscalizeTarget, setFiscalizeTarget] = useState<PosReceipt | null>(null);
  const [bfNumber, setBfNumber] = useState('');
  const [bfError, setBfError] = useState<string | null>(null);
  const [fiscalizing, setFiscalizing] = useState(false);

  const [refundTarget, setRefundTarget] = useState<PosReceipt | null>(null);

  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? companies[0] ?? EMPTY_COMPANY_FALLBACK;
  const currentStore = storeLocations.find((s) => s.id === activeStoreId) ?? storeLocations[0] ?? EMPTY_STORE_FALLBACK;

  const filteredReceipts = useMemo(() => {
    return posReceipts
      .filter((r) => (activeStoreId ? r.storeId === activeStoreId : !activeCompanyId || r.companyId === activeCompanyId))
      .filter((r) => (receiptFilter ? r.receiptNumber.toLowerCase().includes(receiptFilter.toLowerCase()) : true))
      .filter((r) => (fiscalFilter ? (r.fiscalNumber ?? '').toLowerCase().includes(fiscalFilter.toLowerCase()) : true))
      .filter((r) => (cashierFilter ? r.cashierName.toLowerCase().includes(cashierFilter.toLowerCase()) : true))
      .filter((r) => (partnerFilter === 'ALL' ? true : r.partnerId === partnerFilter))
      .filter((r) => {
        const dStr = r.issuedAt.slice(0, 10);
        if (dateFrom && dStr < dateFrom) return false;
        if (dateTo && dStr > dateTo) return false;
        return true;
      });
  }, [posReceipts, activeStoreId, activeCompanyId, receiptFilter, fiscalFilter, cashierFilter, partnerFilter, dateFrom, dateTo]);

  const openFiscalizeDialog = (receipt: PosReceipt) => {
    setFiscalizeTarget(receipt);
    setBfNumber(receipt.fiscalNumber ?? '');
    setBfError(null);
  };

  const handleConfirmFiscalize = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!fiscalizeTarget || fiscalizing) return;

    const trimmed = bfNumber.trim();
    if (!trimmed) {
      setBfError('Unesite broj fiskalnog računa (BF).');
      return;
    }

    setFiscalizing(true);
    setBfError(null);
    try {
      const res = await fiscalizePosReceipt(fiscalizeTarget.id, trimmed);
      if (res.ok) {
        showToast({
          title: t('pos.fiscalizeSuccess'),
          description: `${fiscalizeTarget.receiptNumber} (${trimmed})`,
          variant: 'success',
        });
        setFiscalizeTarget(null);
        setBfNumber('');
      } else {
        const errorMsg = res.error || 'Greška pri fiskalizaciji računa.';
        setBfError(errorMsg);
        showToast({
          title: 'Fiskalizacija nije uspjela',
          description: errorMsg,
          variant: 'error',
        });
      }
    } finally {
      setFiscalizing(false);
    }
  };

  const handleConfirmRefund = async () => {
    if (!refundTarget) return;
    const target = refundTarget;
    const res = await refundPosReceipt(target.id);
    if (res.ok) {
      showToast({
        title: t('messages.documentReversed'),
        description: target.fiscalNumber
          ? `${target.receiptNumber} (${t('pos.originalFiscalNumber')}: ${target.fiscalNumber})`
          : target.receiptNumber,
        variant: 'success',
      });
      setRefundTarget(null);
    } else {
      showToast({
        title: 'Storno računa nije uspio',
        description: res.error || 'Server nije potvrdio reklamaciju/storno računa.',
        variant: 'error',
      });
    }
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
            <span className="font-medium text-foreground">{row.original.fiscalNumber || '—'}</span>
            {row.original.referenceFiscalNumber && (
              <span className="text-[10px] text-destructive">← {row.original.referenceFiscalNumber}</span>
            )}
          </div>
        ),
      },
      {
        id: 'fiscalizationStatus',
        header: 'Fiskalizacija',
        accessorFn: (row) => (isReceiptFiscalized(row) ? 'Fiskalizovan' : 'Nefiskalizovan'),
        cell: ({ row }) =>
          isReceiptFiscalized(row.original) ? (
            <Badge variant="success">Fiskalizovan</Badge>
          ) : (
            <Badge variant="warning">Nefiskalizovan</Badge>
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
        header: 'Tip',
        cell: ({ row }) => (
          <Badge variant={row.original.receiptType === 'REFUND' ? 'destructive' : 'default'}>
            {row.original.receiptType === 'REFUND' ? t('status.REFUND') : t('status.SALE')}
          </Badge>
        ),
      },
      {
        accessorKey: 'totalGrossAmount',
        header: t('common.total'),
        cell: ({ row }) => (
          <div className="text-right font-mono font-bold text-primary">
            {formatMoney2(row.original.totalGrossAmount, true)}
          </div>
        ),
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
              <Button variant="ghost" size="sm" onClick={() => openFiscalizeDialog(r)} title={t('pos.fiscalize')}>
                <Send className="h-3.5 w-3.5 text-primary" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setInvoiceReceipt(r)} title={t('pos.taxInvoice')}>
                <FileText className="h-3.5 w-3.5 text-success" />
              </Button>
              {r.receiptType === 'SALE' && r.status === 'POSTED' && (
                <Button variant="destructive" size="sm" onClick={() => setRefundTarget(r)} title={t('status.REFUND')}>
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

      <Dialog
        open={Boolean(fiscalizeTarget)}
        onOpenChange={(open) => {
          if (!open && !fiscalizing) {
            setFiscalizeTarget(null);
            setBfError(null);
          }
        }}
        size="sm"
        title={
          fiscalizeTarget
            ? `Fiskalizacija računa — ${fiscalizeTarget.receiptNumber}`
            : 'Fiskalizacija računa'
        }
        description="Unesite broj fiskalnog računa (BF) iz fiskalnog uređaja kako biste evidentirali fiskalizaciju."
        footer={
          <>
            <Button
              variant="outline"
              disabled={fiscalizing}
              onClick={() => {
                setFiscalizeTarget(null);
                setBfError(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              isLoading={fiscalizing}
              onClick={() => void handleConfirmFiscalize()}
            >
              <Send className="h-3.5 w-3.5" />
              <span>Potvrdi fiskalizaciju</span>
            </Button>
          </>
        }
      >
        {fiscalizeTarget && (
          <form onSubmit={(e) => void handleConfirmFiscalize(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/30 p-3 text-xs">
              <div>
                <span className="text-muted-foreground">Datum i vrijeme:</span>
                <div className="mt-0.5 font-mono font-medium text-foreground">
                  {formatDateTimeBs(fiscalizeTarget.issuedAt)}
                </div>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground">Ukupan iznos:</span>
                <div className="mt-0.5 font-mono font-bold text-primary">
                  {formatMoney2(fiscalizeTarget.totalGrossAmount, true)}
                </div>
              </div>
            </div>

            <Input
              label="Broj fiskalnog računa (BF)"
              required
              autoFocus
              disabled={fiscalizing}
              placeholder="npr. BF-000123"
              value={bfNumber}
              onChange={(e) => {
                setBfNumber(e.target.value);
                if (bfError) setBfError(null);
              }}
              error={bfError ?? undefined}
              className="font-mono"
            />
          </form>
        )}
      </Dialog>

      <ConfirmDialog
        open={Boolean(refundTarget)}
        onOpenChange={(open) => {
          if (!open) setRefundTarget(null);
        }}
        title="Reklamacija / Storno fiskalnog računa"
        description={
          refundTarget
            ? `Da li ste sigurni da želite izvršiti reklamaciju (storno) računa ${refundTarget.receiptNumber}${
                refundTarget.fiscalNumber ? ` (${refundTarget.fiscalNumber})` : ''
              } u iznosu od ${formatMoney2(
                refundTarget.totalGrossAmount,
                true
              )}? Količine će biti vraćene na zalihu, a KEP evidencija će biti ažurirana.`
            : undefined
        }
        confirmLabel="Potvrdi storno"
        variant="destructive"
        onConfirm={handleConfirmRefund}
      />

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
