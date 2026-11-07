import { useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { Plus, Trash2, CheckCircle2, Save } from 'lucide-react';
import { t } from '../../i18n';
import { d, formatMoney2, formatQty, round2 } from '../../lib/money';
import { generateUuidV7 } from '../../lib/utils';
import type {
  Item,
  PriceLevelingDocument,
  PriceLevelingLine,
  StoreItemPrice,
  VatRate,
} from '../../types/domain';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Combobox } from '../../components/ui/Combobox';
import { DocumentStatusBadge } from '../../components/ui/Badge';

interface PriceLevelingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDoc: PriceLevelingDocument;
  items: Item[];
  vatRates: VatRate[];
  storePrices: StoreItemPrice[];
  onSaveDraft: (doc: PriceLevelingDocument) => void;
  onPostDocument: (doc: PriceLevelingDocument) => void;
}

function buildLevelingLine(params: {
  id: string;
  itemId: string;
  stockQuantity: string;
  oldRetailPriceWithVat: string;
  newRetailPriceWithVat: string;
  vatRatePercent: string;
}): PriceLevelingLine {
  const qty = d(params.stockQuantity);
  const oldPrice = d(params.oldRetailPriceWithVat).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const newPrice = d(params.newRetailPriceWithVat).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const vatRate = d(params.vatRatePercent);
  const vatMult = new Decimal(1).plus(vatRate.div(100));

  const oldTot = qty.mul(oldPrice).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const newTot = qty.mul(newPrice).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const diffTot = newTot.minus(oldTot).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const vatDiff = diffTot.minus(diffTot.div(vatMult).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const marginDiff = diffTot.minus(vatDiff).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    id: params.id,
    itemId: params.itemId,
    stockQuantity: params.stockQuantity,
    oldRetailPriceWithVat: round2(oldPrice),
    newRetailPriceWithVat: round2(newPrice),
    vatRatePercent: round2(vatRate),
    oldTotalRetailValue: round2(oldTot),
    newTotalRetailValue: round2(newTot),
    totalRetailDifference: round2(diffTot),
    embeddedVatDifference: round2(vatDiff),
    marginDifference: round2(marginDiff),
  };
}

export function PriceLevelingDialog({
  open,
  onOpenChange,
  initialDoc,
  items,
  vatRates,
  storePrices,
  onSaveDraft,
  onPostDocument,
}: PriceLevelingDialogProps) {
  const [doc, setDoc] = useState<PriceLevelingDocument>(initialDoc);
  const [newItemId, setNewItemId] = useState('');
  const isReadOnly = doc.status !== 'DRAFT';

  const itemOptions = useMemo(
    () => items.filter((it) => it.isActive).map((it) => ({ value: it.id, code: it.sku, label: it.name, sublabel: `${it.primaryBarcode} · ${it.uom}` })),
    [items]
  );

  const recomputeDocTotals = (nextLines: PriceLevelingLine[]): PriceLevelingDocument => ({
    ...doc,
    lines: nextLines,
    totalRetailDifference: round2(nextLines.reduce((a, l) => a.plus(d(l.totalRetailDifference)), new Decimal(0))),
    totalVatDifference: round2(nextLines.reduce((a, l) => a.plus(d(l.embeddedVatDifference)), new Decimal(0))),
    totalMarginDifference: round2(nextLines.reduce((a, l) => a.plus(d(l.marginDifference)), new Decimal(0))),
  });

  const handleAddLine = () => {
    if (!newItemId || isReadOnly) return;
    const item = items.find((i) => i.id === newItemId);
    if (!item) return;
    const priceRec = storePrices.find((p) => p.storeId === doc.storeId && p.itemId === item.id);
    const vatRate = vatRates.find((v) => v.id === item.vatRateId)?.ratePercent ?? '17.00';
    const oldMpc = priceRec?.retailUnitPriceWithVat ?? '1.00';
    const nextLine = buildLevelingLine({
      id: generateUuidV7(),
      itemId: item.id,
      stockQuantity: priceRec?.currentStockQty ?? '10.0000',
      oldRetailPriceWithVat: oldMpc,
      newRetailPriceWithVat: oldMpc,
      vatRatePercent: vatRate,
    });
    setDoc(recomputeDocTotals([...doc.lines, nextLine]));
    setNewItemId('');
  };

  const handleNewPriceChange = (lineId: string, newPriceStr: string) => {
    if (isReadOnly) return;
    const nextLines = doc.lines.map((line) => (line.id === lineId ? buildLevelingLine({ ...line, newRetailPriceWithVat: newPriceStr }) : line));
    setDoc(recomputeDocTotals(nextLines));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${t('nav.priceLeveling')} — ${doc.docNumber}`}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
          {!isReadOnly && (
            <>
              <Button variant="secondary" onClick={() => onSaveDraft(doc)}>
                <Save className="h-4 w-4" /><span>{t('common.saveDraft')}</span>
              </Button>
              <Button variant="success" disabled={doc.lines.length === 0} onClick={() => onPostDocument(doc)}>
                <CheckCircle2 className="h-4 w-4" /><span>{t('common.postDocument')}</span>
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="space-y-4 text-xs">
        <div className="flex items-center justify-between">
          <DocumentStatusBadge status={doc.status} />
          {isReadOnly && <span className="text-muted-foreground">{t('messages.postedImmutableError')}</span>}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label={t('warehouse.docNumber')} value={doc.docNumber} disabled={isReadOnly} onChange={(e) => setDoc({ ...doc, docNumber: e.target.value })} className="font-mono" />
          <Input label={t('warehouse.docDate')} type="date" value={doc.docDate} disabled={isReadOnly} onChange={(e) => setDoc({ ...doc, docDate: e.target.value })} />
          <Input label={t('common.description')} value={doc.reason} disabled={isReadOnly} onChange={(e) => setDoc({ ...doc, reason: e.target.value })} />
        </div>

        {!isReadOnly && (
          <div className="flex items-end gap-2 rounded-md border border-border bg-muted/30 p-3">
            <div className="flex-1"><Combobox label={t('nav.items')} options={itemOptions} value={newItemId} onChange={setNewItemId} /></div>
            <Button variant="primary" onClick={handleAddLine} disabled={!newItemId}>
              <Plus className="h-4 w-4" /><span>{t('common.add')}</span>
            </Button>
          </div>
        )}

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">{t('common.name')}</th>
                <th className="px-3 py-2 font-semibold text-right">{t('master.currentStock')}</th>
                <th className="px-3 py-2 font-semibold text-right">{t('warehouse.oldRetailPrice')}</th>
                <th className="px-3 py-2 font-semibold text-right">{t('warehouse.newRetailPrice')}</th>
                <th className="px-3 py-2 font-semibold text-right">{t('warehouse.priceDifference')}</th>
                <th className="px-3 py-2 font-semibold text-right">{t('warehouse.vatDifference')}</th>
                <th className="px-3 py-2 font-semibold text-right">{t('warehouse.marginDifference')}</th>
                {!isReadOnly && <th className="px-3 py-2 text-center">{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {doc.lines.map((line) => {
                const item = items.find((i) => i.id === line.itemId);
                return (
                  <tr key={line.id}>
                    <td className="px-3 py-2 font-medium">{item?.name ?? line.itemId}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatQty(line.stockQuantity, 2)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatMoney2(line.oldRetailPriceWithVat, true)}</td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" step="0.01" disabled={isReadOnly} value={line.newRetailPriceWithVat} onChange={(e) => handleNewPriceChange(line.id, e.target.value)} className="h-7 w-24 rounded border border-input bg-background px-2 text-right font-mono font-semibold" />
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{formatMoney2(line.totalRetailDifference, true)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatMoney2(line.embeddedVatDifference, true)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatMoney2(line.marginDifference, true)}</td>
                    {!isReadOnly && (
                      <td className="px-3 py-2 text-center">
                        <Button variant="ghost" size="icon" onClick={() => setDoc(recomputeDocTotals(doc.lines.filter((l) => l.id !== line.id)))}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Dialog>
  );
}
