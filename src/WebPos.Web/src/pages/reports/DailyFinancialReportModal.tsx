import { Printer } from 'lucide-react';
import { t } from '../../i18n';
import { formatMoney2 } from '../../lib/money';
import { formatDateBs } from '../../lib/utils';
import type { Company, PosReceipt, PosTerminal, StoreLocation, VatRate } from '../../types/domain';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import {
  calculateSummary,
  aggregateByPaymentMethods,
  aggregateVatRecap,
  aggregateByTerminals,
} from './dailyTurnoverUtils';

export interface DailyFinancialReportModalProps {
  open: boolean;
  onClose: () => void;
  company: Company;
  receipts: PosReceipt[];
  dateFrom: string;
  dateTo: string;
  terminals: PosTerminal[];
  stores: StoreLocation[];
  vatRates: VatRate[];
}

export function DailyFinancialReportModal({
  open,
  onClose,
  company,
  receipts,
  dateFrom,
  dateTo,
  terminals,
  stores,
  vatRates,
}: DailyFinancialReportModalProps) {
  const summary = calculateSummary(receipts);
  const payAgg = aggregateByPaymentMethods(receipts);
  const vatAgg = aggregateVatRecap(receipts, vatRates);
  const termAgg = aggregateByTerminals(receipts, terminals, stores);

  const handlePrint = () => {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      title={t('reports.dailyFinancialReport')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.close')}
          </Button>
          <Button variant="primary" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            <span>{t('common.print')}</span>
          </Button>
        </>
      }
    >
      <div className="space-y-6 text-foreground print:text-black">
        <div className="border-b border-border pb-4 flex justify-between items-start">
          <div>
            <h2 className="text-base font-bold uppercase tracking-tight">{company.name}</h2>
            <p className="text-xs text-muted-foreground">{company.address}, {company.city}</p>
            <div className="flex gap-4 mt-1 text-xs font-mono">
              <span>{t('master.taxIdNumber')}: {company.taxIdNumber}</span>
              <span>{t('master.vatIdNumber')}: {company.vatIdNumber}</span>
            </div>
          </div>
          <div className="text-right">
            <h3 className="text-sm font-bold uppercase">{t('reports.dailyFinancialReport')}</h3>
            <p className="text-xs font-mono mt-1">
              {t('reports.dateFrom')}: {formatDateBs(dateFrom)} — {t('reports.dateTo')}: {formatDateBs(dateTo)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg border border-border bg-muted/20">
            <div className="text-xs text-muted-foreground">{t('reports.receiptsCount')}</div>
            <div className="text-lg font-bold font-mono">{summary.receiptsCount}</div>
          </div>
          <div className="p-3 rounded-lg border border-border bg-muted/20">
            <div className="text-xs text-muted-foreground">{t('reports.retailTotal')}</div>
            <div className="text-lg font-bold font-mono text-primary">{formatMoney2(summary.totalGross, true)}</div>
          </div>
          <div className="p-3 rounded-lg border border-border bg-muted/20">
            <div className="text-xs text-muted-foreground">{t('reports.sellingTotalExclVat')}</div>
            <div className="text-lg font-bold font-mono">{formatMoney2(summary.totalNet, true)}</div>
          </div>
          <div className="p-3 rounded-lg border border-border bg-muted/20">
            <div className="text-xs text-muted-foreground">{t('reports.vatTotal')}</div>
            <div className="text-lg font-bold font-mono">{formatMoney2(summary.totalVat, true)}</div>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 text-muted-foreground">
            {t('reports.vatRecap')}
          </h4>
          <table className="w-full text-left text-xs border border-border">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="p-2 font-semibold">{t('common.vat')}</th>
                <th className="p-2 font-semibold text-right">{t('common.rate')}</th>
                <th className="p-2 font-semibold text-right">{t('pos.baseExclVat')}</th>
                <th className="p-2 font-semibold text-right">{t('pos.vatAmount')}</th>
                <th className="p-2 font-semibold text-right">{t('common.total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vatAgg.map((v) => (
                <tr key={v.rateCode}>
                  <td className="p-2 font-medium">{v.rateCode}</td>
                  <td className="p-2 text-right font-mono">{formatMoney2(v.ratePercent)}%</td>
                  <td className="p-2 text-right font-mono">{formatMoney2(v.netBase, true)}</td>
                  <td className="p-2 text-right font-mono">{formatMoney2(v.vatAmount, true)}</td>
                  <td className="p-2 text-right font-mono font-semibold">{formatMoney2(v.grossTotal, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 text-muted-foreground">
            {t('reports.paymentMethodsRecap')}
          </h4>
          <table className="w-full text-left text-xs border border-border">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="p-2 font-semibold">{t('pos.paymentMethod')}</th>
                <th className="p-2 font-semibold text-right">{t('reports.receiptsCount')}</th>
                <th className="p-2 font-semibold text-right">{t('pos.baseExclVat')}</th>
                <th className="p-2 font-semibold text-right">{t('pos.vatAmount')}</th>
                <th className="p-2 font-semibold text-right">{t('common.total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payAgg.map((p) => (
                <tr key={p.method}>
                  <td className="p-2 font-medium">{p.method}</td>
                  <td className="p-2 text-right font-mono">{p.receiptsCount}</td>
                  <td className="p-2 text-right font-mono">{formatMoney2(p.totalNet, true)}</td>
                  <td className="p-2 text-right font-mono">{formatMoney2(p.totalVat, true)}</td>
                  <td className="p-2 text-right font-mono font-semibold">{formatMoney2(p.totalGross, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 text-muted-foreground">
            {t('reports.byTerminals')}
          </h4>
          <table className="w-full text-left text-xs border border-border">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="p-2 font-semibold">{t('app.terminal')}</th>
                <th className="p-2 font-semibold text-right">{t('reports.receiptsCount')}</th>
                <th className="p-2 font-semibold text-right">{t('pos.payCash')}</th>
                <th className="p-2 font-semibold text-right">{t('pos.payCard')}</th>
                <th className="p-2 font-semibold text-right">{t('common.total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {termAgg.map((tr) => (
                <tr key={tr.terminalId}>
                  <td className="p-2 font-medium">{tr.terminalCode} — {tr.terminalName}</td>
                  <td className="p-2 text-right font-mono">{tr.receiptsCount}</td>
                  <td className="p-2 text-right font-mono">{formatMoney2(tr.cashAmount, true)}</td>
                  <td className="p-2 text-right font-mono">{formatMoney2(tr.cardAmount, true)}</td>
                  <td className="p-2 text-right font-mono font-semibold">{formatMoney2(tr.totalGross, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pt-8 grid grid-cols-3 gap-6 text-center text-xs">
          <div className="border-t border-border pt-2">
            <p className="font-semibold">{t('kep.storeManager')}</p>
            <p className="text-[11px] text-muted-foreground mt-8">M.P. / Potpis</p>
          </div>
          <div className="border-t border-border pt-2">
            <p className="font-semibold">{t('printDoc.liquidator')}</p>
            <p className="text-[11px] text-muted-foreground mt-8">Potpis</p>
          </div>
          <div className="border-t border-border pt-2">
            <p className="font-semibold">{t('app.operator')}</p>
            <p className="text-[11px] text-muted-foreground mt-8">Potpis</p>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
