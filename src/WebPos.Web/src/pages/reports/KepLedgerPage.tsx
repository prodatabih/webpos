import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { BookOpen, Printer } from 'lucide-react';
import Decimal from 'decimal.js';
import { t } from '../../i18n';
import { d, formatMoney2 } from '../../lib/money';
import { formatDateBs } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';
import type { KepLedgerEntry } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

export function KepLedgerPage() {
  const {
    activeCompanyId,
    activeFiscalYearId,
    activeStoreId,
    storeLocations,
    kepLedgerEntries,
  } = useAppStore();

  const [selectedStoreId, setSelectedStoreId] = useState<string>(activeStoreId);

  const companyStores = useMemo(
    () => storeLocations.filter((s) => s.companyId === activeCompanyId),
    [storeLocations, activeCompanyId]
  );

  const entries = useMemo(() => {
    const raw = kepLedgerEntries
      .filter(
        (e) =>
          e.companyId === activeCompanyId &&
          e.fiscalYearId === activeFiscalYearId &&
          (selectedStoreId === 'ALL' ? true : e.storeId === selectedStoreId)
      )
      .sort((a, b) => a.entryNumber - b.entryNumber);

    let running = new Decimal(0);
    return raw.map((item, idx) => {
      running = running
        .plus(d(item.debitRetailAmount))
        .minus(d(item.creditRetailAmount));
      return {
        ...item,
        entryNumber: idx + 1,
        runningBalanceAmount: running.toFixed(2),
      };
    });
  }, [kepLedgerEntries, activeCompanyId, activeFiscalYearId, selectedStoreId]);

  const totals = useMemo(() => {
    let debit = new Decimal(0);
    let credit = new Decimal(0);
    entries.forEach((e) => {
      debit = debit.plus(d(e.debitRetailAmount));
      credit = credit.plus(d(e.creditRetailAmount));
    });
    const balance = debit.minus(credit);
    return {
      totalDebit: formatMoney2(debit, true),
      totalCredit: formatMoney2(credit, true),
      currentBalance: formatMoney2(balance, true),
    };
  }, [entries]);

  const columns = useMemo<ColumnDef<KepLedgerEntry>[]>(
    () => [
      {
        accessorKey: 'entryNumber',
        header: t('kep.entryNumber'),
        cell: ({ row }) => (
          <span className="font-mono font-semibold text-muted-foreground">
            {row.original.entryNumber}.
          </span>
        ),
      },
      {
        accessorKey: 'entryDate',
        header: t('kep.entryDate'),
        cell: ({ row }) => (
          <span className="font-mono">{formatDateBs(row.original.entryDate)}</span>
        ),
      },
      {
        accessorKey: 'documentNumber',
        header: t('warehouse.docNumber'),
        cell: ({ row }) => (
          <Badge variant="outline" className="font-mono">
            {row.original.documentNumber}
          </Badge>
        ),
      },
      {
        accessorKey: 'description',
        header: t('kep.documentDescription'),
        cell: ({ row }) => (
          <span className="font-medium text-foreground">{row.original.description}</span>
        ),
      },
      {
        accessorKey: 'debitRetailAmount',
        header: t('kep.debitAmount'),
        cell: ({ row }) => {
          const isPositive = d(row.original.debitRetailAmount).gt(0);
          return (
            <div className="text-right font-mono font-medium text-success">
              {isPositive ? formatMoney2(row.original.debitRetailAmount, true) : '-'}
            </div>
          );
        },
      },
      {
        accessorKey: 'creditRetailAmount',
        header: t('kep.creditAmount'),
        cell: ({ row }) => {
          const isPositive = d(row.original.creditRetailAmount).gt(0);
          return (
            <div className="text-right font-mono font-medium text-destructive">
              {isPositive ? formatMoney2(row.original.creditRetailAmount, true) : '-'}
            </div>
          );
        },
      },
      {
        accessorKey: 'runningBalanceAmount',
        header: t('kep.runningBalance'),
        cell: ({ row }) => (
          <div className="text-right font-mono font-bold text-foreground">
            {formatMoney2(row.original.runningBalanceAmount, true)}
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title={t('kep.title')}
        breadcrumbs={[
          { label: t('nav.groupReports') },
          { label: t('nav.kepLedger') },
        ]}
        primaryAction={
          <Button
            variant="outline"
            onClick={() => {
              if (typeof window !== 'undefined' && typeof window.print === 'function') {
                window.print();
              }
            }}
          >
            <Printer className="h-4 w-4" />
            <span>{t('common.print')}</span>
          </Button>
        }
      />

      <div className="p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t('kep.totalDebit')}</p>
                <p className="mt-1 text-lg font-bold font-mono text-success">
                  {totals.totalDebit}
                </p>
              </div>
              <BookOpen className="h-5 w-5 text-success opacity-80" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t('kep.totalCredit')}</p>
                <p className="mt-1 text-lg font-bold font-mono text-destructive">
                  {totals.totalCredit}
                </p>
              </div>
              <BookOpen className="h-5 w-5 text-destructive opacity-80" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t('kep.currentBalance')}</p>
                <p className="mt-1 text-lg font-bold font-mono text-foreground">
                  {totals.currentBalance}
                </p>
              </div>
              <BookOpen className="h-5 w-5 text-primary opacity-80" />
            </CardContent>
          </Card>
        </div>

        <DataTable
          data={entries}
          columns={columns}
          exportFileName="kep-trgovacka-knjiga"
          toolbarExtras={
            <select
              aria-label={t('app.storeLocation')}
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="h-8 rounded-md border border-input bg-card px-2.5 text-xs text-foreground"
            >
              <option value="ALL">{t('common.all')}</option>
              {companyStores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          }
        />
      </div>
    </div>
  );
}

export default KepLedgerPage;
