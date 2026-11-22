import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertCircle, BookOpen, Calendar, Download, Printer, Store, X } from 'lucide-react';
import Decimal from 'decimal.js';
import { t } from '../../i18n';
import { d, formatMoney2, round2 } from '../../lib/money';
import { formatDateBs } from '../../lib/utils';
import { EMPTY_COMPANY_FALLBACK, EMPTY_STORE_FALLBACK } from '../../lib/emptyOrgFallbacks';
import { exportToExcel } from '../../lib/exportExcel';
import { useAppStore } from '../../store/useAppStore';
import type { KepLedgerEntry } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { KepPrintModal, type KprEntry } from './KepPrintModal';

type LedgerTab = 'KEP' | 'KPR';

export function KepLedgerPage() {
  const {
    activeCompanyId,
    activeFiscalYearId,
    activeStoreId,
    storeLocations,
    companies,
    fiscalYears,
    kepLedgerEntries,
    posReceipts,
  } = useAppStore();

  const [selectedStoreId, setSelectedStoreId] = useState<string>(activeStoreId || 'ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeTab, setActiveTab] = useState<LedgerTab>('KEP');
  const [printModalOpen, setPrintModalOpen] = useState(false);

  useEffect(() => {
    setSelectedStoreId(activeStoreId || 'ALL');
  }, [activeStoreId]);

  const companyStores = useMemo(
    () => storeLocations.filter((s) => s.companyId === activeCompanyId),
    [storeLocations, activeCompanyId]
  );

  const effectiveStoreId = useMemo(() => {
    if (selectedStoreId === 'ALL') return 'ALL';
    if (companyStores.some((s) => s.id === selectedStoreId)) return selectedStoreId;
    return companyStores[0]?.id ?? 'ALL';
  }, [selectedStoreId, companyStores]);

  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? companies[0] ?? EMPTY_COMPANY_FALLBACK;
  const currentStore =
    effectiveStoreId === 'ALL'
      ? (companyStores.find((s) => s.id === activeStoreId) ?? companyStores[0] ?? EMPTY_STORE_FALLBACK)
      : (companyStores.find((s) => s.id === effectiveStoreId) ?? companyStores[0] ?? EMPTY_STORE_FALLBACK);
  const fiscalYearObj = fiscalYears.find((y) => y.id === activeFiscalYearId);

  const entries = useMemo(() => {
    const raw = kepLedgerEntries
      .filter(
        (e) =>
          e.companyId === activeCompanyId &&
          (!activeFiscalYearId || e.fiscalYearId === activeFiscalYearId) &&
          (effectiveStoreId === 'ALL' ? true : e.storeId === effectiveStoreId)
      )
      .sort((a, b) =>
        a.entryDate !== b.entryDate
          ? a.entryDate < b.entryDate
            ? -1
            : 1
          : a.entryNumber - b.entryNumber
      );

    let running = new Decimal(0);
    const withRunning = raw.map((item, idx) => {
      running = running.plus(d(item.debitRetailAmount)).minus(d(item.creditRetailAmount));
      return {
        ...item,
        entryNumber: idx + 1,
        runningBalanceAmount: running.toFixed(2),
      };
    });

    if (!dateFrom && !dateTo) return withRunning;
    return withRunning.filter((item) => {
      const dStr = item.entryDate.slice(0, 10);
      if (dateFrom && dStr < dateFrom) return false;
      if (dateTo && dStr > dateTo) return false;
      return true;
    });
  }, [kepLedgerEntries, activeCompanyId, activeFiscalYearId, effectiveStoreId, dateFrom, dateTo]);

  const kprEntries = useMemo<KprEntry[]>(() => {
    return posReceipts
      .filter((r) => r.companyId === activeCompanyId && r.status === 'POSTED')
      .filter((r) => (effectiveStoreId === 'ALL' ? true : r.storeId === effectiveStoreId))
      .filter((r) => {
        const dStr = r.issuedAt.slice(0, 10);
        if (dateFrom && dStr < dateFrom) return false;
        if (dateTo && dStr > dateTo) return false;
        return true;
      })
      .sort((a, b) => (a.issuedAt < b.issuedAt ? -1 : 1))
      .map((r, idx) => {
        const sign = r.receiptType === 'REFUND' ? -1 : 1;
        const cash = d(r.cashReceivedAmount || 0).times(sign);
        const nonCash = d(r.cardAmount || 0).plus(d(r.wireAmount || 0)).times(sign);
        const tot = d(r.totalGrossAmount).times(sign);
        return {
          entryNumber: idx + 1,
          entryDate: r.issuedAt.slice(0, 10),
          docNumber: r.fiscalNumber ? `${r.receiptNumber} (${r.fiscalNumber})` : r.receiptNumber,
          cashAmount: round2(cash),
          nonCashAmount: round2(nonCash),
          totalAmount: round2(tot),
        };
      });
  }, [posReceipts, activeCompanyId, effectiveStoreId, dateFrom, dateTo]);

  const totals = useMemo(() => {
    let debit = new Decimal(0);
    let credit = new Decimal(0);
    entries.forEach((e) => {
      debit = debit.plus(d(e.debitRetailAmount));
      credit = credit.plus(d(e.creditRetailAmount));
    });
    const balance = debit.minus(credit);

    let kprCash = new Decimal(0);
    let kprNonCash = new Decimal(0);
    let kprTotal = new Decimal(0);
    kprEntries.forEach((k) => {
      kprCash = kprCash.plus(d(k.cashAmount));
      kprNonCash = kprNonCash.plus(d(k.nonCashAmount));
      kprTotal = kprTotal.plus(d(k.totalAmount));
    });

    return {
      debit: round2(debit),
      credit: round2(credit),
      balance: round2(balance),
      kprCash: round2(kprCash),
      kprNonCash: round2(kprNonCash),
      kprTotal: round2(kprTotal),
    };
  }, [entries, kprEntries]);

  const hasDateFilter = Boolean(dateFrom || dateTo);
  const storeCodeSlug = effectiveStoreId === 'ALL' ? 'sve-poslovnice' : (currentStore.code || 'poslovnica');

  const handleExportExcel = () => {
    if (activeTab === 'KEP') {
      const headers = [t('kep.entryNumber'), t('kep.entryDate'), t('warehouse.docNumber'), t('kep.documentDescription'), t('kep.debitAmount'), t('kep.creditAmount'), t('kep.runningBalance')];
      const rows = entries.map((e) => [e.entryNumber, e.entryDate, e.documentNumber, e.description, Number(e.debitRetailAmount), Number(e.creditRetailAmount), Number(e.runningBalanceAmount)]);
      exportToExcel(`kep-tkm-${storeCodeSlug}`, 'Obrazac TKM', headers, rows);
    } else {
      const headers = [t('kep.entryNumber'), t('common.date'), t('pos.originalFiscalNumber'), t('kep.cashTurnover'), t('kep.nonCashTurnover'), t('kep.totalTurnover')];
      const rows = kprEntries.map((k) => [k.entryNumber, k.entryDate, k.docNumber, Number(k.cashAmount), Number(k.nonCashAmount), Number(k.totalAmount)]);
      exportToExcel(`kpr-${storeCodeSlug}`, 'Obrazac KPR', headers, rows);
    }
  };

  const kepColumns = useMemo<ColumnDef<KepLedgerEntry>[]>(
    () => [
      { accessorKey: 'entryNumber', header: t('kep.entryNumber'), cell: ({ row }) => <span className="font-mono font-semibold text-muted-foreground">{row.original.entryNumber}.</span> },
      { accessorKey: 'entryDate', header: t('kep.entryDate'), cell: ({ row }) => <span className="font-mono">{formatDateBs(row.original.entryDate)}</span> },
      { accessorKey: 'documentNumber', header: t('warehouse.docNumber'), cell: ({ row }) => <Badge variant="outline" className="font-mono">{row.original.documentNumber}</Badge> },
      { accessorKey: 'description', header: t('kep.documentDescription'), cell: ({ row }) => <span className="font-medium text-foreground">{row.original.description}</span> },
      { accessorKey: 'debitRetailAmount', header: t('kep.debitAmount'), cell: ({ row }) => <div className="text-right font-mono font-medium text-success">{Number(row.original.debitRetailAmount) > 0 ? formatMoney2(row.original.debitRetailAmount, true) : '-'}</div> },
      { accessorKey: 'creditRetailAmount', header: t('kep.creditAmount'), cell: ({ row }) => <div className="text-right font-mono font-medium text-destructive">{Number(row.original.creditRetailAmount) > 0 ? formatMoney2(row.original.creditRetailAmount, true) : '-'}</div> },
      { accessorKey: 'runningBalanceAmount', header: t('kep.runningBalance'), cell: ({ row }) => <div className="text-right font-mono font-bold text-foreground">{formatMoney2(row.original.runningBalanceAmount, true)}</div> },
    ],
    []
  );

  const kprColumns = useMemo<ColumnDef<KprEntry>[]>(
    () => [
      { accessorKey: 'entryNumber', header: t('kep.entryNumber'), cell: ({ row }) => <span className="font-mono font-semibold text-muted-foreground">{row.original.entryNumber}.</span> },
      { accessorKey: 'entryDate', header: t('common.date'), cell: ({ row }) => <span className="font-mono">{formatDateBs(row.original.entryDate)}</span> },
      { accessorKey: 'docNumber', header: t('pos.originalFiscalNumber'), cell: ({ row }) => <span className="font-mono font-medium">{row.original.docNumber}</span> },
      { accessorKey: 'cashAmount', header: t('kep.cashTurnover'), cell: ({ row }) => <div className="text-right font-mono">{formatMoney2(row.original.cashAmount, true)}</div> },
      { accessorKey: 'nonCashAmount', header: t('kep.nonCashTurnover'), cell: ({ row }) => <div className="text-right font-mono">{formatMoney2(row.original.nonCashAmount, true)}</div> },
      { accessorKey: 'totalAmount', header: t('kep.totalTurnover'), cell: ({ row }) => <div className="text-right font-mono font-bold text-primary">{formatMoney2(row.original.totalAmount, true)}</div> },
    ],
    []
  );

  const clearDateFilterAction = hasDateFilter ? (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        setDateFrom('');
        setDateTo('');
      }}
    >
      <X className="h-3.5 w-3.5" />
      <span>Poništi filter datuma</span>
    </Button>
  ) : undefined;

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title={t('kep.title')}
        breadcrumbs={[{ label: t('nav.groupReports') }, { label: t('nav.kepLedger') }]}
        actions={
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="h-4 w-4" />
            <span>{t('common.exportExcel')}</span>
          </Button>
        }
        primaryAction={
          <Button variant="primary" size="sm" onClick={() => setPrintModalOpen(true)}>
            <Printer className="h-4 w-4" />
            <span>{t('common.print')}</span>
          </Button>
        }
      />

      <div className="p-6 space-y-5">
        {companyStores.length === 0 && (
          <div className="flex items-center gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-xs text-foreground">
            <AlertCircle className="h-4 w-4 shrink-0 text-warning-foreground" />
            <span>
              Nema registrovanih poslovnica za aktivnu firmu. KEP / KPR knjige će se popuniti nakon definisanja poslovnice i knjiženja dokumenata.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t('kep.totalDebit')}</p>
                <p className="mt-1 text-lg font-bold font-mono text-success">{formatMoney2(totals.debit, true)}</p>
              </div>
              <BookOpen className="h-5 w-5 text-success opacity-80" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t('kep.totalCredit')}</p>
                <p className="mt-1 text-lg font-bold font-mono text-destructive">{formatMoney2(totals.credit, true)}</p>
              </div>
              <BookOpen className="h-5 w-5 text-destructive opacity-80" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t('kep.currentBalance')}</p>
                <p className="mt-1 text-lg font-bold font-mono text-foreground">{formatMoney2(totals.balance, true)}</p>
              </div>
              <BookOpen className="h-5 w-5 text-primary opacity-80" />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('KEP')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold cursor-pointer ${
                activeTab === 'KEP' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {t('kep.tabKep')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('KPR')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold cursor-pointer ${
                activeTab === 'KPR' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {t('kep.tabKpr')}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{t('reports.dateFrom')}:</span>
              <input
                type="date"
                aria-label={t('reports.dateFrom')}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 rounded-md border border-input bg-card px-2 font-mono text-xs text-foreground"
              />
            </div>
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <span>{t('reports.dateTo')}:</span>
              <input
                type="date"
                aria-label={t('reports.dateTo')}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 rounded-md border border-input bg-card px-2 font-mono text-xs text-foreground"
              />
            </div>
            {hasDateFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
                title="Poništi filter datuma"
              >
                <X className="h-3.5 w-3.5" />
                <span>Poništi</span>
              </Button>
            )}
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Store className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                aria-label="Poslovnica"
                value={effectiveStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="h-8 rounded-md border border-input bg-card px-2.5 text-xs text-foreground font-medium"
              >
                <option value="ALL">Sve poslovnice ({t('common.all')})</option>
                {companyStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {activeTab === 'KEP' ? (
          <DataTable
            data={entries}
            columns={kepColumns}
            exportFileName="kep-tkm"
            emptyAction={clearDateFilterAction}
          />
        ) : (
          <DataTable
            data={kprEntries}
            columns={kprColumns}
            exportFileName="kpr-knjiga-prometa"
            emptyAction={clearDateFilterAction}
          />
        )}
      </div>

      <KepPrintModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        reportType={activeTab}
        company={activeCompany}
        store={currentStore}
        fiscalYear={fiscalYearObj ? String(fiscalYearObj.year) : String(new Date().getFullYear())}
        kepEntries={entries}
        kprEntries={kprEntries}
        totals={totals}
      />
    </div>
  );
}
export default KepLedgerPage;
