import { useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { Plus, Trash2, CheckCircle2, Save } from 'lucide-react';
import { t } from '../../i18n';
import { d, formatMoney2, formatQty, round2, round4 } from '../../lib/money';
import { generateUuidV7 } from '../../lib/utils';
import type {
  InventoryCountDocument,
  InventoryCountLine,
  Item,
  StoreItemPrice,
  VatRate,
} from '../../types/domain';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Combobox } from '../../components/ui/Combobox';
import { DocumentStatusBadge } from '../../components/ui/Badge';

interface InventoryCountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDoc: InventoryCountDocument;
  items: Item[];
  vatRates: VatRate[];
  storePrices: StoreItemPrice[];
  onSaveDraft: (doc: InventoryCountDocument) => void;
  onPostDocument: (doc: InventoryCountDocument) => void;
}

function buildCountLine(params: {
  id: string;
  itemId: string;
  bookQuantity: string;
  countedQuantity: string;
  purchaseUnitPrice: string;
  retailUnitPriceWithVat: string;
  vatRatePercent: string;
}): InventoryCountLine {
  const book = d(params.bookQuantity);
  const counted = d(params.countedQuantity);
  const diff = counted.minus(book);
  const retailPrice = d(params.retailUnitPriceWithVat).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const surplusVal = diff.gt(0) ? diff.mul(retailPrice) : new Decimal(0);
  const shortageVal = diff.lt(0) ? diff.abs().mul(retailPrice) : new Decimal(0);

  return {
    id: params.id,
    itemId: params.itemId,
    bookQuantity: round4(book),
    countedQuantity: round4(counted),
    differenceQuantity: round4(diff),
    purchaseUnitPrice: params.purchaseUnitPrice,
    retailUnitPriceWithVat: round2(retailPrice),
    vatRatePercent: params.vatRatePercent,
    surplusRetailValue: round2(surplusVal),
    shortageRetailValue: round2(shortageVal),
  };
}

export function InventoryCountDialog({
  open,
  onOpenChange,
  initialDoc,
  items,
  vatRates,
  storePrices,
  onSaveDraft,
  onPostDocument,
}: InventoryCountDialogProps) {
  const [doc, setDoc] = useState<InventoryCountDocument>(initialDoc);
  const [newItemId, setNewItemId] = useState('');
  const isReadOnly = doc.status !== 'DRAFT';

  const itemOptions = useMemo(
    () => items.filter((it) => it.isActive).map((it) => ({ value: it.id, code: it.sku, label: it.name, sublabel: `${it.primaryBarcode} · ${it.uom}` })),
    [items]
  );

  const recomputeDocTotals = (nextLines: InventoryCountLine[]): InventoryCountDocument => ({
    ...doc,
    lines: nextLines,
    totalSurplusRetailValue: round2(nextLines.reduce((a, l) => a.plus(d(l.surplusRetailValue)), new Decimal(0))),
    totalShortageRetailValue: round2(nextLines.reduce((a, l) => a.plus(d(l.shortageRetailValue)), new Decimal(0))),
  });

  const handleAddLine = () => {
    if (!newItemId || isReadOnly) return;
    const item = items.find((i) => i.id === newItemId);
    if (!item) return;
    const priceRec = storePrices.find((p) => p.storeId === doc.storeId && p.itemId === item.id);
    const vatRate = vatRates.find((v) => v.id === item.vatRateId)?.ratePercent ?? '17.00';
    const bookQty = priceRec?.currentStockQty ?? '0.0000';
    const nextLine = buildCountLine({
      id: generateUuidV7(),
      itemId: item.id,
      bookQuantity: bookQty,
      countedQuantity: bookQty,
      purchaseUnitPrice: priceRec?.purchaseUnitPrice ?? '0.0000',
      retailUnitPriceWithVat: priceRec?.retailUnitPriceWithVat ?? '0.00',
      vatRatePercent: vatRate,
    });
    setDoc(recomputeDocTotals([...doc.lines, nextLine]));
    setNewItemId('');
  };

  const handleCountedQtyChange = (lineId: string, countedStr: string) => {
    if (isReadOnly) return;
    const nextLines = doc.lines.map((line) => (line.id === lineId ? buildCountLine({ ...line, countedQuantity: countedStr }) : line));
    setDoc(recomputeDocTotals(nextLines));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${t('nav.inventoryCount')} — ${doc.docNumber}`}
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
          <Input label={t('common.notes')} value={doc.notes} disabled={isReadOnly} onChange={(e) => setDoc({ ...doc, notes: e.target.value })} />
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
                <th className="px-3 py-2 font-semibold text-right">{t('warehouse.bookQuantity')}</th>
                <th className="px-3 py-2 font-semibold text-right">{t('warehouse.countedQuantity')}</th>
                <th className="px-3 py-2 font-semibold text-right">{t('warehouse.retailPriceWithVat')}</th>
                <th className="px-3 py-2 font-semibold text-right">{t('warehouse.surplusValue')}</th>
                <th className="px-3 py-2 font-semibold text-right">{t('warehouse.shortageValue')}</th>
                {!isReadOnly && <th className="px-3 py-2 text-center">{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {doc.lines.map((line) => {
                const item = items.find((i) => i.id === line.itemId);
                return (
                  <tr key={line.id}>
                    <td className="px-3 py-2 font-medium">{item?.name ?? line.itemId}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatQty(line.bookQuantity, 2)}</td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" step="0.01" disabled={isReadOnly} value={line.countedQuantity} onChange={(e) => handleCountedQtyChange(line.id, e.target.value)} className="h-7 w-24 rounded border border-input bg-background px-2 text-right font-mono font-semibold" />
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{formatMoney2(line.retailUnitPriceWithVat, true)}</td>
                    <td className="px-3 py-2 text-right font-mono text-success">{formatMoney2(line.surplusRetailValue, true)}</td>
                    <td className="px-3 py-2 text-right font-mono text-destructive">{formatMoney2(line.shortageRetailValue, true)}</td>
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
