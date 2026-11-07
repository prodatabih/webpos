import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Decimal from 'decimal.js';
import {
  ShoppingCart,
  FilePlus2,
  BookOpen,
  TrendingUp,
  ArrowLeftRight,
  Tags,
  ReceiptText,
  Package,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { t } from '../../i18n';
import { d, formatMoney2 } from '../../lib/money';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DashboardTables, type RecentWarehouseDocRow } from './DashboardTables';

export function DashboardPage() {
  const navigate = useNavigate();
  const activeStoreId = useAppStore((s) => s.activeStoreId);
  const activeFiscalYearId = useAppStore((s) => s.activeFiscalYearId);
  const storeLocations = useAppStore((s) => s.storeLocations);
  const fiscalYears = useAppStore((s) => s.fiscalYears);
  const posReceipts = useAppStore((s) => s.posReceipts);
  const calculations = useAppStore((s) => s.calculations);
  const priceLevelings = useAppStore((s) => s.priceLevelings);
  const transfers = useAppStore((s) => s.transfers);
  const kepEntries = useAppStore((s) => s.kepLedgerEntries);
  const storePrices = useAppStore((s) => s.storeItemPrices);
  const partners = useAppStore((s) => s.partners);

  const activeStore = storeLocations.find((s) => s.id === activeStoreId);
  const activeYear = fiscalYears.find((y) => y.id === activeFiscalYearId);

  const metrics = useMemo(() => {
    const storeKep = kepEntries.filter((e) => e.storeId === activeStoreId && e.fiscalYearId === activeFiscalYearId);
    const totalDebit = storeKep.reduce((acc, e) => acc.plus(d(e.debitRetailAmount)), new Decimal(0));
    const totalCredit = storeKep.reduce((acc, e) => acc.plus(d(e.creditRetailAmount)), new Decimal(0));
    const currentBalance = totalDebit.minus(totalCredit);

    const storeReceipts = posReceipts.filter((r) => r.storeId === activeStoreId && r.fiscalYearId === activeFiscalYearId);
    const posTurnover = storeReceipts.reduce(
      (acc, r) => (r.receiptType === 'REFUND' ? acc.minus(d(r.totalGrossAmount)) : acc.plus(d(r.totalGrossAmount))),
      new Decimal(0)
    );

    const storeCalcs = calculations.filter(
      (c) => c.storeId === activeStoreId && c.fiscalYearId === activeFiscalYearId && c.status === 'POSTED'
    );
    const totalCalcRetail = storeCalcs.reduce((acc, c) => acc.plus(d(c.totalRetailValueWithVat)), new Decimal(0));
    const activeStoreStock = storePrices.filter((p) => p.storeId === activeStoreId);

    return {
      totalDebit: formatMoney2(totalDebit, true),
      currentBalance: formatMoney2(currentBalance, true),
      posTurnover: formatMoney2(posTurnover, true),
      receiptCount: storeReceipts.length,
      totalCalcRetail: formatMoney2(totalCalcRetail, true),
      calcCount: storeCalcs.length,
      stockItemCount: activeStoreStock.length,
      labelQueueCount: activeStoreStock.filter((p) => p.needsLabelPrint).length,
    };
  }, [kepEntries, posReceipts, calculations, storePrices, activeStoreId, activeFiscalYearId]);

  const recentWarehouseDocs = useMemo<RecentWarehouseDocRow[]>(() => {
    const calcRows = calculations.filter((c) => c.storeId === activeStoreId).map((c) => ({
      id: c.id,
      docNumber: c.docNumber,
      docDate: c.docDate,
      typeLabel: t('nav.calculations'),
      partnerOrInfo: partners.find((p) => p.id === c.partnerId)?.name ?? '-',
      amount: c.totalRetailValueWithVat,
      status: c.status,
      path: '/warehouse/calculations',
    }));
    const nivRows = priceLevelings.filter((n) => n.storeId === activeStoreId).map((n) => ({
      id: n.id,
      docNumber: n.docNumber,
      docDate: n.docDate,
      typeLabel: t('nav.priceLeveling'),
      partnerOrInfo: n.reason,
      amount: n.totalRetailDifference,
      status: n.status,
      path: '/warehouse/price-leveling',
    }));
    const trfRows = transfers.filter((tr) => tr.sourceStoreId === activeStoreId || tr.targetStoreId === activeStoreId).map((tr) => ({
      id: tr.id,
      docNumber: tr.docNumber,
      docDate: tr.docDate,
      typeLabel: t('nav.transfers'),
      partnerOrInfo: tr.notes,
      amount: tr.totalSourceRetailValue,
      status: tr.status,
      path: '/warehouse/transfers',
    }));
    return [...calcRows, ...nivRows, ...trfRows].sort((a, b) => b.docDate.localeCompare(a.docDate)).slice(0, 6);
  }, [calculations, priceLevelings, transfers, partners, activeStoreId]);

  const recentReceipts = useMemo(
    () => posReceipts.filter((r) => r.storeId === activeStoreId).slice(0, 6),
    [posReceipts, activeStoreId]
  );

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t('nav.dashboard')}
        subtitle={activeStore && activeYear ? `${activeStore.code} — ${activeStore.name} (${activeYear.year})` : undefined}
        breadcrumbs={[{ label: t('nav.groupPos') }, { label: t('nav.dashboard') }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('/warehouse/calculations')}>
              <FilePlus2 className="h-4 w-4" />
              <span>{t('nav.calculations')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/reports/kep-ledger')}>
              <BookOpen className="h-4 w-4" />
              <span>{t('nav.kepLedger')}</span>
            </Button>
          </>
        }
        primaryAction={
          <Button variant="primary" size="sm" onClick={() => navigate('/pos')}>
            <ShoppingCart className="h-4 w-4" />
            <span>{t('nav.posRegister')}</span>
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">{t('kep.currentBalance')}</CardTitle></CardHeader>
            <CardContent>
              <div className="text-xl font-bold font-mono text-foreground">{metrics.currentBalance}</div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground"><span>{t('kep.totalDebit')}:</span><span className="font-mono text-foreground">{metrics.totalDebit}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">{t('pos.shiftSummary')}</CardTitle></CardHeader>
            <CardContent>
              <div className="text-xl font-bold font-mono text-primary">{metrics.posTurnover}</div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground"><span>{t('nav.posReceipts')}:</span><span className="font-mono text-foreground">{metrics.receiptCount}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">{t('nav.calculations')}</CardTitle></CardHeader>
            <CardContent>
              <div className="text-xl font-bold font-mono text-foreground">{metrics.totalCalcRetail}</div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground"><span>{t('status.POSTED')}:</span><span className="font-mono text-foreground">{metrics.calcCount}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">{t('master.labelQueueCount')}</CardTitle></CardHeader>
            <CardContent>
              <div className="text-xl font-bold font-mono text-foreground">{metrics.labelQueueCount}</div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground"><span>{t('nav.items')}:</span><span className="font-mono text-foreground">{metrics.stockItemCount}</span></div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/pos')}><ShoppingCart className="h-3.5 w-3.5" /><span>{t('nav.posRegister')}</span></Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/pos/receipts')}><ReceiptText className="h-3.5 w-3.5" /><span>{t('nav.posReceipts')}</span></Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/warehouse/calculations')}><FilePlus2 className="h-3.5 w-3.5" /><span>{t('nav.calculations')}</span></Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/warehouse/price-leveling')}><TrendingUp className="h-3.5 w-3.5" /><span>{t('nav.priceLeveling')}</span></Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/warehouse/transfers')}><ArrowLeftRight className="h-3.5 w-3.5" /><span>{t('nav.transfers')}</span></Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/master/items')}><Package className="h-3.5 w-3.5" /><span>{t('nav.items')}</span></Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/master/labels')}><Tags className="h-3.5 w-3.5" /><span>{t('nav.labelCenter')}</span></Button>
        </div>

        <DashboardTables recentWarehouseDocs={recentWarehouseDocs} recentReceipts={recentReceipts} />
      </div>
    </div>
  );
}
export default DashboardPage;
