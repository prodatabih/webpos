import { Printer } from 'lucide-react';
import { t } from '../../i18n';
import { formatMoney2 } from '../../lib/money';
import { formatDateBs } from '../../lib/utils';
import type { Company, KepLedgerEntry, StoreLocation } from '../../types/domain';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';

export interface KprEntry {
  entryNumber: number;
  entryDate: string;
  docNumber: string;
  cashAmount: string;
  nonCashAmount: string;
  totalAmount: string;
}

export interface KepPrintModalProps {
  open: boolean;
  onClose: () => void;
  reportType: 'KEP' | 'KPR';
  company: Company;
  store: StoreLocation;
  fiscalYear: string;
  kepEntries: KepLedgerEntry[];
  kprEntries: KprEntry[];
  totals: {
    debit: string;
    credit: string;
    balance: string;
    kprCash: string;
    kprNonCash: string;
    kprTotal: string;
  };
}

export function KepPrintModal({
  open,
  onClose,
  reportType,
  company,
  store,
  fiscalYear,
  kepEntries,
  kprEntries,
  totals,
}: KepPrintModalProps) {
  const isKep = reportType === 'KEP';

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
      title={isKep ? t('kep.kepTitleFbih') : t('kep.kprTitle')}
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
            <p className="text-xs font-semibold mt-1 text-primary">
              {t('app.storeLocation')}: {store.code} — {store.name} ({store.city})
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t('kep.fbihPrescribed')}
            </span>
            <h3 className="text-sm font-bold uppercase mt-0.5">
              {isKep ? 'OBRAZAC TKM — TRGOVAČKA KNJIGA NA MALO' : 'OBRAZAC KPR — KNJIGA PROMETA'}
            </h3>
            <p className="text-xs font-mono mt-1">
              {t('app.fiscalYear')}: {fiscalYear}
            </p>
          </div>
        </div>

        {isKep ? (
          <table className="w-full text-left text-xs border border-border">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="p-2 font-semibold w-12 text-center">{t('kep.entryNumber')}</th>
                <th className="p-2 font-semibold w-24">{t('kep.entryDate')}</th>
                <th className="p-2 font-semibold w-28">{t('warehouse.docNumber')}</th>
                <th className="p-2 font-semibold">{t('kep.documentDescription')}</th>
                <th className="p-2 font-semibold text-right">{t('kep.debitAmount')}</th>
                <th className="p-2 font-semibold text-right">{t('kep.creditAmount')}</th>
                <th className="p-2 font-semibold text-right">{t('kep.runningBalance')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {kepEntries.map((e) => (
                <tr key={e.id}>
                  <td className="p-2 text-center font-mono text-muted-foreground">{e.entryNumber}.</td>
                  <td className="p-2 font-mono">{formatDateBs(e.entryDate)}</td>
                  <td className="p-2 font-mono font-medium">{e.documentNumber}</td>
                  <td className="p-2">{e.description}</td>
                  <td className="p-2 text-right font-mono">{Number(e.debitRetailAmount) > 0 ? formatMoney2(e.debitRetailAmount, true) : '-'}</td>
                  <td className="p-2 text-right font-mono">{Number(e.creditRetailAmount) > 0 ? formatMoney2(e.creditRetailAmount, true) : '-'}</td>
                  <td className="p-2 text-right font-mono font-bold">{formatMoney2(e.runningBalanceAmount, true)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/40 font-bold border-t-2 border-border">
              <tr>
                <td colSpan={4} className="p-2 text-right uppercase text-[11px]">{t('common.total')}</td>
                <td className="p-2 text-right font-mono text-success">{formatMoney2(totals.debit, true)}</td>
                <td className="p-2 text-right font-mono text-destructive">{formatMoney2(totals.credit, true)}</td>
                <td className="p-2 text-right font-mono text-foreground">{formatMoney2(totals.balance, true)}</td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <table className="w-full text-left text-xs border border-border">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="p-2 font-semibold w-12 text-center">{t('kep.entryNumber')}</th>
                <th className="p-2 font-semibold w-28">{t('common.date')}</th>
                <th className="p-2 font-semibold">{t('pos.originalFiscalNumber')}</th>
                <th className="p-2 font-semibold text-right">{t('kep.cashTurnover')}</th>
                <th className="p-2 font-semibold text-right">{t('kep.nonCashTurnover')}</th>
                <th className="p-2 font-semibold text-right">{t('kep.totalTurnover')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {kprEntries.map((e) => (
                <tr key={e.entryNumber}>
                  <td className="p-2 text-center font-mono text-muted-foreground">{e.entryNumber}.</td>
                  <td className="p-2 font-mono">{formatDateBs(e.entryDate)}</td>
                  <td className="p-2 font-mono">{e.docNumber}</td>
                  <td className="p-2 text-right font-mono">{formatMoney2(e.cashAmount, true)}</td>
                  <td className="p-2 text-right font-mono">{formatMoney2(e.nonCashAmount, true)}</td>
                  <td className="p-2 text-right font-mono font-bold">{formatMoney2(e.totalAmount, true)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/40 font-bold border-t-2 border-border">
              <tr>
                <td colSpan={3} className="p-2 text-right uppercase text-[11px]">{t('common.total')}</td>
                <td className="p-2 text-right font-mono">{formatMoney2(totals.kprCash, true)}</td>
                <td className="p-2 text-right font-mono">{formatMoney2(totals.kprNonCash, true)}</td>
                <td className="p-2 text-right font-mono text-primary">{formatMoney2(totals.kprTotal, true)}</td>
              </tr>
            </tfoot>
          </table>
        )}

        <div className="pt-8 grid grid-cols-2 gap-12 text-center text-xs">
          <div className="border-t border-border pt-2">
            <p className="font-semibold">{t('kep.storeManager')}</p>
            <p className="text-[11px] text-muted-foreground mt-8">M.P. / Potpis</p>
          </div>
          <div className="border-t border-border pt-2">
            <p className="font-semibold">{t('printDoc.liquidator')}</p>
            <p className="text-[11px] text-muted-foreground mt-8">Potpis</p>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
