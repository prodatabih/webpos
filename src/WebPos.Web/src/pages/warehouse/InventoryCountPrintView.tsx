import { useState } from 'react';
import { Printer, ArrowLeft, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { t } from '../../i18n';
import { d, formatMoney2, formatQty } from '../../lib/money';
import { formatDateBs } from '../../lib/utils';
import type { Company, InventoryCountDocument, Item, StoreLocation } from '../../types/domain';
import { Button } from '../../components/ui/Button';

type PrintMode = 'ALL' | 'SURPLUS' | 'SHORTAGE';

interface InventoryCountPrintViewProps {
  doc: InventoryCountDocument;
  company: Company;
  storeLocation: StoreLocation;
  items: Item[];
  initialMode?: PrintMode;
  onBack: () => void;
}

export function InventoryCountPrintView({
  doc,
  company,
  storeLocation,
  items,
  initialMode = 'ALL',
  onBack,
}: InventoryCountPrintViewProps) {
  const [mode, setMode] = useState<PrintMode>(initialMode);

  const displayedLines = doc.lines.filter((l) => {
    const diff = d(l.differenceQuantity);
    if (mode === 'SURPLUS') return diff.gt(0);
    if (mode === 'SHORTAGE') return diff.lt(0);
    return true;
  });

  const title =
    mode === 'SURPLUS'
      ? t('warehouse.inventorySurplusTitle')
      : mode === 'SHORTAGE'
      ? t('warehouse.inventoryShortageTitle')
      : t('warehouse.inventoryElaboratTitle');

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between rounded-lg border border-border bg-card p-3 shadow-xs">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          <span>{t('warehouse.backToEdit')}</span>
        </Button>
        <div className="flex items-center gap-1.5">
          <Button variant={mode === 'ALL' ? 'primary' : 'outline'} size="sm" onClick={() => setMode('ALL')}>
            <FileText className="h-3.5 w-3.5" /><span>{t('warehouse.printA4InventoryList')}</span>
          </Button>
          <Button variant={mode === 'SURPLUS' ? 'primary' : 'outline'} size="sm" onClick={() => setMode('SURPLUS')}>
            <CheckCircle className="h-3.5 w-3.5 text-success" /><span>{t('warehouse.printA4SurplusList')}</span>
          </Button>
          <Button variant={mode === 'SHORTAGE' ? 'primary' : 'outline'} size="sm" onClick={() => setMode('SHORTAGE')}>
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" /><span>{t('warehouse.printA4ShortageList')}</span>
          </Button>
          <Button variant="primary" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /><span>{t('common.print')}</span>
          </Button>
        </div>
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
            <div className="text-right">
              <div className="inline-block rounded border border-foreground px-3 py-1.5 text-center">
                <span className="block text-[10px] uppercase font-bold text-muted-foreground">{t('common.status')}</span>
                <span className="font-mono text-sm font-black">{doc.docNumber}</span>
              </div>
              <p className="mt-1 text-muted-foreground">{t('warehouse.docDate')}: <strong className="text-foreground">{formatDateBs(doc.docDate)}</strong></p>
            </div>
          </div>
          <div className="mt-3 text-center">
            <h2 className="text-sm font-black uppercase tracking-wider underline">{title}</h2>
            {doc.commissionMembers && (
              <p className="text-xs text-muted-foreground mt-1">
                {t('warehouse.commissionMembers')}: <strong className="text-foreground">{doc.commissionMembers}</strong>
              </p>
            )}
          </div>
        </div>

        <table className="mt-6 w-full border-collapse border border-foreground text-[10px]">
          <thead className="bg-muted/60 font-bold uppercase text-center">
            <tr>
              <th className="border border-foreground p-1.5 w-8">#</th>
              <th className="border border-foreground p-1.5">{t('common.name')}</th>
              <th className="border border-foreground p-1.5 w-10">{t('common.uom')}</th>
              <th className="border border-foreground p-1.5 w-16 text-right">{t('warehouse.bookQuantity')}</th>
              <th className="border border-foreground p-1.5 w-16 text-right">{t('warehouse.countedQuantity')}</th>
              <th className="border border-foreground p-1.5 w-16 text-right">{t('warehouse.priceDifference')}</th>
              <th className="border border-foreground p-1.5 w-16 text-right">{t('warehouse.retailPriceWithVat')}</th>
              {mode !== 'SHORTAGE' && <th className="border border-foreground p-1.5 w-20 text-right font-bold text-success">{t('warehouse.surplusValue')}</th>}
              {mode === 'SHORTAGE' && <th className="border border-foreground p-1.5 w-16 text-right">{t('warehouse.allowedWasteQty')}</th>}
              {mode === 'SHORTAGE' && <th className="border border-foreground p-1.5 w-20 text-right">{t('warehouse.allowedWasteValue')}</th>}
              {mode === 'SHORTAGE' && <th className="border border-foreground p-1.5 w-20 text-right font-bold text-destructive">{t('warehouse.unrecognizedShortageValue')}</th>}
              {mode === 'SHORTAGE' && <th className="border border-foreground p-1.5 w-16 text-right">{t('warehouse.unrecognizedShortageVat')}</th>}
              {mode === 'ALL' && <th className="border border-foreground p-1.5 w-20 text-right font-bold text-destructive">{t('warehouse.shortageValue')}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground font-mono">
            {displayedLines.map((l, idx) => {
              const item = items.find((i) => i.id === l.itemId);
              return (
                <tr key={l.id}>
                  <td className="border border-foreground p-1.5 text-center font-sans">{idx + 1}</td>
                  <td className="border border-foreground p-1.5 font-sans">
                    <span className="font-semibold">{item?.name}</span> ({item?.sku})
                  </td>
                  <td className="border border-foreground p-1.5 text-center font-sans">{item?.uom ?? 'KOM'}</td>
                  <td className="border border-foreground p-1.5 text-right">{formatQty(l.bookQuantity, 2)}</td>
                  <td className="border border-foreground p-1.5 text-right font-semibold">{formatQty(l.countedQuantity, 2)}</td>
                  <td className="border border-foreground p-1.5 text-right">{formatQty(l.differenceQuantity, 2)}</td>
                  <td className="border border-foreground p-1.5 text-right">{formatMoney2(l.retailUnitPriceWithVat, true)}</td>
                  {mode !== 'SHORTAGE' && <td className="border border-foreground p-1.5 text-right font-bold text-success">{formatMoney2(l.surplusRetailValue, true)}</td>}
                  {mode === 'SHORTAGE' && <td className="border border-foreground p-1.5 text-right">{formatQty(l.allowedWasteQuantity ?? '0.0000', 2)}</td>}
                  {mode === 'SHORTAGE' && <td className="border border-foreground p-1.5 text-right">{formatMoney2(l.allowedWasteRetailValue ?? '0.00', true)}</td>}
                  {mode === 'SHORTAGE' && <td className="border border-foreground p-1.5 text-right font-bold text-destructive">{formatMoney2(l.unrecognizedShortageRetailValue ?? l.shortageRetailValue, true)}</td>}
                  {mode === 'SHORTAGE' && <td className="border border-foreground p-1.5 text-right">{formatMoney2(l.unrecognizedShortageVat ?? '0.00', true)}</td>}
                  {mode === 'ALL' && <td className="border border-foreground p-1.5 text-right font-bold text-destructive">{formatMoney2(l.shortageRetailValue, true)}</td>}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-foreground bg-muted/40 font-mono font-bold text-right">
            <tr>
              <td colSpan={7} className="border border-foreground p-1.5 text-center font-sans">{t('common.total').toUpperCase()}</td>
              {mode !== 'SHORTAGE' && <td className="border border-foreground p-1.5 text-right text-success">{formatMoney2(doc.totalSurplusRetailValue, true)}</td>}
              {mode === 'SHORTAGE' && <td className="border border-foreground p-1.5"></td>}
              {mode === 'SHORTAGE' && <td className="border border-foreground p-1.5 text-right">{formatMoney2(doc.totalAllowedWasteValue ?? '0.00', true)}</td>}
              {mode === 'SHORTAGE' && <td className="border border-foreground p-1.5 text-right text-destructive">{formatMoney2(doc.totalUnrecognizedShortageValue ?? doc.totalShortageRetailValue, true)}</td>}
              {mode === 'SHORTAGE' && <td className="border border-foreground p-1.5 text-right">{formatMoney2(doc.totalUnrecognizedShortageVat ?? '0.00', true)}</td>}
              {mode === 'ALL' && <td className="border border-foreground p-1.5 text-right text-destructive">{formatMoney2(doc.totalShortageRetailValue, true)}</td>}
            </tr>
          </tfoot>
        </table>

        <div className="my-6 grid grid-cols-2 gap-4 text-xs">
          <div className="rounded border border-border p-3">
            <span className="text-muted-foreground block text-[11px]">{t('warehouse.surplusValue')} ({t('warehouse.financialEffectStock')}):</span>
            <strong className="text-sm font-mono text-success">{formatMoney2(doc.totalSurplusRetailValue, true)}</strong>
          </div>
          <div className="rounded border border-border p-3">
            <span className="text-muted-foreground block text-[11px]">{t('warehouse.shortageValue')} (Priznato: {formatMoney2(doc.totalAllowedWasteValue ?? '0.00', true)} | Nepriznato: {formatMoney2(doc.totalUnrecognizedShortageValue ?? doc.totalShortageRetailValue, true)} | PDV 17%: {formatMoney2(doc.totalUnrecognizedShortageVat ?? '0.00', true)}):</span>
            <strong className="text-sm font-mono text-destructive">{formatMoney2(doc.totalShortageRetailValue, true)}</strong>
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
