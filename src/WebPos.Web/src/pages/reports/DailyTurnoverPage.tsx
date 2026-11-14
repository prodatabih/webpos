import { useMemo, useState } from 'react';
import { Calendar, Download, Printer } from 'lucide-react';
import { t } from '../../i18n';
import { formatMoney2 } from '../../lib/money';
import { exportToExcel } from '../../lib/exportExcel';
import { EMPTY_COMPANY_FALLBACK } from '../../lib/emptyOrgFallbacks';
import { useAppStore } from '../../store/useAppStore';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import {
  aggregateByCashiers,
  aggregateByItems,
  aggregateByPaymentMethods,
  aggregateByStores,
  aggregateByTerminals,
  calculateSummary,
  filterReceiptsByPeriod,
} from './dailyTurnoverUtils';
import { useTurnoverColumns } from './dailyTurnoverColumns';
import { DailyFinancialReportModal } from './DailyFinancialReportModal';

type Dimension = 'items' | 'payments' | 'receipts' | 'terminals' | 'stores' | 'cashiers';

export function DailyTurnoverPage() {
  const {
    activeCompanyId,
    companies,
    posReceipts,
    items,
    vatRates,
    storeLocations,
    posTerminals,
  } = useAppStore();

  const todayStr = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(todayStr.slice(0, 7) + '-01');
  const [dateTo, setDateTo] = useState(todayStr);
  const [activeDimension, setActiveDimension] = useState<Dimension>('items');
  const [printModalOpen, setPrintModalOpen] = useState(false);

  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? companies[0] ?? EMPTY_COMPANY_FALLBACK;

  const filteredReceipts = useMemo(
    () => filterReceiptsByPeriod(posReceipts, activeCompanyId, dateFrom, dateTo),
    [posReceipts, activeCompanyId, dateFrom, dateTo]
  );

  const summary = useMemo(() => calculateSummary(filteredReceipts), [filteredReceipts]);

  const itemsData = useMemo(() => aggregateByItems(filteredReceipts, items), [filteredReceipts, items]);
  const paymentsData = useMemo(() => aggregateByPaymentMethods(filteredReceipts), [filteredReceipts]);
  const terminalsData = useMemo(
    () => aggregateByTerminals(filteredReceipts, posTerminals, storeLocations),
    [filteredReceipts, posTerminals, storeLocations]
  );
  const storesData = useMemo(() => aggregateByStores(filteredReceipts, storeLocations), [filteredReceipts, storeLocations]);
  const cashiersData = useMemo(() => aggregateByCashiers(filteredReceipts), [filteredReceipts]);

  const { itemColumns, paymentColumns, receiptColumns, terminalColumns, storeColumns, cashierColumns } = useTurnoverColumns();

  const handleExportExcel = () => {
    if (activeDimension === 'items') {
      const headers = [t('master.sku'), t('common.name'), t('common.uom'), t('reports.soldQuantity'), t('reports.purchaseTotal'), t('reports.realizedMargin'), t('reports.sellingTotalExclVat'), t('reports.vatTotal'), t('reports.retailTotal')];
      const rows = itemsData.map((r) => [r.sku, r.name, r.uom, Number(r.quantity), Number(r.cogsTotal), Number(r.marginTotal), Number(r.netExclVat), Number(r.vatAmount), Number(r.grossWithVat)]);
      exportToExcel(`promet-po-artiklima-${dateFrom}-${dateTo}`, t('reports.byItems'), headers, rows);
    } else if (activeDimension === 'payments') {
      const headers = [t('pos.paymentMethod'), t('reports.receiptsCount'), t('reports.sellingTotalExclVat'), t('reports.vatTotal'), t('reports.retailTotal')];
      const rows = paymentsData.map((r) => [r.method, r.receiptsCount, Number(r.totalNet), Number(r.totalVat), Number(r.totalGross)]);
      exportToExcel(`promet-po-placanjima-${dateFrom}-${dateTo}`, t('reports.byPaymentMethods'), headers, rows);
    } else if (activeDimension === 'terminals') {
      const headers = [t('app.terminal'), t('common.name'), t('reports.byStores'), t('reports.receiptsCount'), t('pos.payCash'), t('pos.payCard'), t('reports.retailTotal')];
      const rows = terminalsData.map((r) => [r.terminalCode, r.terminalName, r.storeCode, r.receiptsCount, Number(r.cashAmount), Number(r.cardAmount), Number(r.totalGross)]);
      exportToExcel(`promet-po-blagajnama-${dateFrom}-${dateTo}`, t('reports.byTerminals'), headers, rows);
    } else if (activeDimension === 'stores') {
      const headers = [t('common.code'), t('common.name'), t('master.itemType'), t('reports.receiptsCount'), t('reports.sellingTotalExclVat'), t('reports.vatTotal'), t('reports.retailTotal')];
      const rows = storesData.map((r) => [r.storeCode, r.storeName, r.storeType, r.receiptsCount, Number(r.totalNet), Number(r.totalVat), Number(r.totalGross)]);
      exportToExcel(`promet-po-prodavnicama-${dateFrom}-${dateTo}`, t('reports.byStores'), headers, rows);
    } else if (activeDimension === 'cashiers') {
      const headers = [t('reports.byCashiers'), t('reports.receiptsCount'), t('pos.payCash'), t('pos.payCard'), t('reports.retailTotal')];
      const rows = cashiersData.map((r) => [r.cashierName, r.receiptsCount, Number(r.cashAmount), Number(r.cardAmount), Number(r.totalGross)]);
      exportToExcel(`promet-po-kasirima-${dateFrom}-${dateTo}`, t('reports.byCashiers'), headers, rows);
    } else {
      const headers = [t('warehouse.docNumber'), t('pos.originalFiscalNumber'), t('common.date'), t('reports.byCashiers'), t('pos.paymentMethod'), t('reports.sellingTotalExclVat'), t('reports.vatTotal'), t('reports.retailTotal')];
      const rows = filteredReceipts.map((r) => [r.receiptNumber, r.fiscalNumber, r.issuedAt, r.cashierName, r.paymentMethod, Number(r.totalNetExclVat), Number(r.totalVatAmount), Number(r.totalGrossAmount)]);
      exportToExcel(`promet-po-racunima-${dateFrom}-${dateTo}`, t('reports.byReceipts'), headers, rows);
    }
  };

  const dimensionTabs: Array<{ id: Dimension; label: string }> = [
    { id: 'items', label: t('reports.byItems') },
    { id: 'payments', label: t('reports.byPaymentMethods') },
    { id: 'receipts', label: t('reports.byReceipts') },
    { id: 'terminals', label: t('reports.byTerminals') },
    { id: 'stores', label: t('reports.byStores') },
    { id: 'cashiers', label: t('reports.byCashiers') },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title={t('reports.dailyTurnover')}
        breadcrumbs={[{ label: t('nav.groupReports') }, { label: t('reports.dailyTurnover') }]}
        actions={
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="h-4 w-4" />
            <span>{t('common.exportExcel')}</span>
          </Button>
        }
        primaryAction={
          <Button variant="primary" size="sm" onClick={() => setPrintModalOpen(true)}>
            <Printer className="h-4 w-4" />
            <span>{t('reports.printZReport')}</span>
          </Button>
        }
      />

      <div className="p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{t('reports.dateFrom')}:</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 rounded border border-input bg-card px-2 text-xs font-mono text-foreground" />
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <span>{t('reports.dateTo')}:</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 rounded border border-input bg-card px-2 text-xs font-mono text-foreground" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{t('reports.receiptsCount')}</p>
              <p className="mt-1 text-xl font-bold font-mono">{summary.receiptsCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{t('reports.retailTotal')}</p>
              <p className="mt-1 text-xl font-bold font-mono text-primary">{formatMoney2(summary.totalGross, true)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{t('reports.sellingTotalExclVat')}</p>
              <p className="mt-1 text-xl font-bold font-mono">{formatMoney2(summary.totalNet, true)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{t('reports.vatTotal')}</p>
              <p className="mt-1 text-xl font-bold font-mono text-foreground">{formatMoney2(summary.totalVat, true)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-border pb-2">
          {dimensionTabs.map((tb) => (
            <button
              key={tb.id}
              type="button"
              onClick={() => setActiveDimension(tb.id)}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                activeDimension === tb.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {activeDimension === 'items' && <DataTable data={itemsData} columns={itemColumns} exportFileName="promet-po-artiklima" />}
        {activeDimension === 'payments' && <DataTable data={paymentsData} columns={paymentColumns} exportFileName="promet-po-placanjima" />}
        {activeDimension === 'receipts' && <DataTable data={filteredReceipts} columns={receiptColumns} exportFileName="promet-po-racunima" />}
        {activeDimension === 'terminals' && <DataTable data={terminalsData} columns={terminalColumns} exportFileName="promet-po-blagajnama" />}
        {activeDimension === 'stores' && <DataTable data={storesData} columns={storeColumns} exportFileName="promet-po-prodavnicama" />}
        {activeDimension === 'cashiers' && <DataTable data={cashiersData} columns={cashierColumns} exportFileName="promet-po-kasirima" />}
      </div>

      <DailyFinancialReportModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        company={activeCompany}
        receipts={filteredReceipts}
        dateFrom={dateFrom}
        dateTo={dateTo}
        terminals={posTerminals}
        stores={storeLocations}
        vatRates={vatRates}
      />
    </div>
  );
}
export default DailyTurnoverPage;
