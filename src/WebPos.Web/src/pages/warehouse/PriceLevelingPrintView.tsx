import { Printer, ArrowLeft } from 'lucide-react';
import { t } from '../../i18n';
import { d, formatMoney2, formatQty, round2 } from '../../lib/money';
import { formatDateBs } from '../../lib/utils';
import type { Company, Item, PriceLevelingDocument, StoreLocation } from '../../types/domain';
import { Button } from '../../components/ui/Button';

interface PriceLevelingPrintViewProps {
  doc: PriceLevelingDocument;
  company: Company;
  storeLocation: StoreLocation;
  items: Item[];
  onBack: () => void;
}

export function PriceLevelingPrintView({
  doc,
  company,
  storeLocation,
  items,
  onBack,
}: PriceLevelingPrintViewProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between rounded-lg border border-border bg-card p-3 shadow-xs">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          <span>{t('warehouse.backToEdit')}</span>
        </Button>
        <Button variant="primary" size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4" />
          <span>{t('common.print')}</span>
        </Button>
      </div>

      <div className="mx-auto max-w-[1000px] rounded-lg border border-border bg-card p-8 text-foreground shadow-sm">
        <div className="border-b-2 border-foreground pb-4">
          <div className="flex justify-between items-start text-xs">
            <div>
              <h1 className="text-base font-black uppercase tracking-tight">{company.name}</h1>
              <p className="text-muted-foreground">{company.address}, {company.city}</p>
              <p className="text-muted-foreground">JIB: {company.taxIdNumber} | PDV: {company.vatIdNumber}</p>
              <p className="mt-1 font-semibold text-foreground">
                {t('app.storeLocation')}: {storeLocation.name} ({storeLocation.code})
              </p>
            </div>
            <div className="text-right text-xs">
              <p className="text-muted-foreground">
                {t('warehouse.docDate')}: <strong className="text-foreground font-mono">{formatDateBs(doc.docDate)}</strong>
              </p>
              {doc.postingDate && (
                <p className="mt-0.5 text-muted-foreground">
                  {t('warehouse.postingDate')}: <strong className="text-foreground font-mono">{formatDateBs(doc.postingDate)}</strong>
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 text-center">
            <h2 className="text-sm font-black uppercase tracking-wider underline">
              {t('warehouse.levelingReportTitle')} — {doc.docNumber}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {t('common.description')}: {doc.reason || '-'}
            </p>
          </div>
        </div>

        <table className="mt-6 w-full border-collapse border border-foreground text-[10px]">
          <thead className="bg-muted/60 font-bold uppercase text-center">
            <tr>
              <th className="border border-foreground p-1.5 w-8">#</th>
              <th className="border border-foreground p-1.5">{t('common.name')}</th>
              <th className="border border-foreground p-1.5 w-12">{t('common.uom')}</th>
              <th className="border border-foreground p-1.5 w-16 text-right">{t('master.currentStock')}</th>
              <th className="border border-foreground p-1.5 w-20 text-right">{t('warehouse.oldRetailPrice')}</th>
              <th className="border border-foreground p-1.5 w-20 text-right">{t('warehouse.newRetailPrice')}</th>
              <th className="border border-foreground p-1.5 w-20 text-right">{t('warehouse.priceDifference')}</th>
              <th className="border border-foreground p-1.5 w-24 text-right font-bold">{t('warehouse.financialEffectStock')}</th>
              <th className="border border-foreground p-1.5 w-20 text-right">{t('warehouse.financialEffectVat')}</th>
              <th className="border border-foreground p-1.5 w-20 text-right">{t('warehouse.financialEffectMargin')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground font-mono">
            {doc.lines.map((l, idx) => {
              const item = items.find((i) => i.id === l.itemId);
              const unitDiff = round2(d(l.newRetailPriceWithVat || '0').minus(d(l.oldRetailPriceWithVat || '0')));
              return (
                <tr key={l.id}>
                  <td className="border border-foreground p-1.5 text-center font-sans">{idx + 1}</td>
                  <td className="border border-foreground p-1.5 font-sans">
                    <span className="font-semibold">{item?.name ?? l.itemId}</span> ({item?.sku ?? '-'})
                  </td>
                  <td className="border border-foreground p-1.5 text-center font-sans">{item?.uom ?? 'KOM'}</td>
                  <td className="border border-foreground p-1.5 text-right">{formatQty(l.stockQuantity, 2)}</td>
                  <td className="border border-foreground p-1.5 text-right">{formatMoney2(l.oldRetailPriceWithVat, true)}</td>
                  <td className="border border-foreground p-1.5 text-right font-semibold">{formatMoney2(l.newRetailPriceWithVat, true)}</td>
                  <td className="border border-foreground p-1.5 text-right">{formatMoney2(unitDiff, true)}</td>
                  <td className="border border-foreground p-1.5 text-right font-bold">{formatMoney2(l.totalRetailDifference, true)}</td>
                  <td className="border border-foreground p-1.5 text-right">{formatMoney2(l.embeddedVatDifference, true)}</td>
                  <td className="border border-foreground p-1.5 text-right">{formatMoney2(l.marginDifference, true)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-foreground bg-muted/40 font-mono font-bold text-right">
            <tr>
              <td colSpan={7} className="border border-foreground p-1.5 text-center font-sans">{t('common.total').toUpperCase()}</td>
              <td className="border border-foreground p-1.5 text-right">{formatMoney2(doc.totalRetailDifference, true)}</td>
              <td className="border border-foreground p-1.5 text-right">{formatMoney2(doc.totalVatDifference, true)}</td>
              <td className="border border-foreground p-1.5 text-right">{formatMoney2(doc.totalMarginDifference, true)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="my-6 grid grid-cols-3 gap-4 text-xs">
          <div className="rounded border border-border p-3">
            <span className="text-muted-foreground block text-[11px]">{t('warehouse.financialEffectStock')}:</span>
            <strong className="text-sm font-mono text-primary">{formatMoney2(doc.totalRetailDifference, true)}</strong>
          </div>
          <div className="rounded border border-border p-3">
            <span className="text-muted-foreground block text-[11px]">{t('warehouse.financialEffectVat')}:</span>
            <strong className="text-sm font-mono">{formatMoney2(doc.totalVatDifference, true)}</strong>
          </div>
          <div className="rounded border border-border p-3">
            <span className="text-muted-foreground block text-[11px]">{t('warehouse.financialEffectMargin')}:</span>
            <strong className="text-sm font-mono">{formatMoney2(doc.totalMarginDifference, true)}</strong>
          </div>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-12 pt-4 text-center text-xs">
          <div><div className="border-b border-foreground h-8 mb-1"></div><p className="font-semibold">{t('warehouse.commissionSignatures')}</p></div>
          <div><div className="border-b border-foreground h-8 mb-1"></div><p className="font-semibold">{t('warehouse.approvedBy')}</p></div>
        </div>
      </div>
    </div>
  );
}
