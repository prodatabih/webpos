import { useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { Plus, Trash2, CheckCircle2, Save } from 'lucide-react';
import { t } from '../../i18n';
import { d, formatMoney2, formatPrice4, round2 } from '../../lib/money';
import { generateUuidV7 } from '../../lib/utils';
import type {
  Item,
  StoreItemPrice,
  StoreLocation,
  TransferDocument,
  TransferLine,
  VatRate,
} from '../../types/domain';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Combobox } from '../../components/ui/Combobox';
import { DocumentStatusBadge } from '../../components/ui/Badge';

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDoc: TransferDocument;
  storeLocations: StoreLocation[];
  items: Item[];
  vatRates: VatRate[];
  storePrices: StoreItemPrice[];
  onSaveDraft: (doc: TransferDocument) => void;
  onPostDocument: (doc: TransferDocument) => void;
}

export function TransferDialog({
  open,
  onOpenChange,
  initialDoc,
  storeLocations,
  items,
  vatRates,
  storePrices,
  onSaveDraft,
  onPostDocument,
}: TransferDialogProps) {
  const [doc, setDoc] = useState<TransferDocument>(initialDoc);
  const [newItemId, setNewItemId] = useState('');
  const isReadOnly = doc.status !== 'DRAFT';

  const storeOptions = useMemo(
    () => storeLocations.filter((s) => s.isActive).map((s) => ({ value: s.id, code: s.code, label: s.name, sublabel: s.city })),
    [storeLocations]
  );

  const itemOptions = useMemo(
    () => items.filter((it) => it.isActive).map((it) => ({ value: it.id, code: it.sku, label: it.name, sublabel: `${it.primaryBarcode} · ${it.uom}` })),
    [items]
  );

  const recomputeDocTotals = (nextLines: TransferLine[]): TransferDocument => ({
    ...doc,
    lines: nextLines,
    totalPurchaseValue: round2(nextLines.reduce((a, l) => a.plus(d(l.purchaseTotalValue)), new Decimal(0))),
    totalSourceRetailValue: round2(nextLines.reduce((a, l) => a.plus(d(l.sourceRetailTotalValue)), new Decimal(0))),
    totalTargetRetailValue: round2(nextLines.reduce((a, l) => a.plus(d(l.targetRetailTotalValue)), new Decimal(0))),
  });

  const handleAddLine = () => {
    if (!newItemId || isReadOnly) return;
    const item = items.find((i) => i.id === newItemId);
    if (!item) return;
    const srcPrice = storePrices.find((p) => p.storeId === doc.sourceStoreId && p.itemId === item.id);
    const tgtPrice = storePrices.find((p) => p.storeId === doc.targetStoreId && p.itemId === item.id);
    const vatRate = vatRates.find((v) => v.id === item.vatRateId)?.ratePercent ?? '17.00';
    const qty = new Decimal(10);
    const purchUnit = srcPrice?.purchaseUnitPrice ?? '5.0000';
    const srcMpc = srcPrice?.retailUnitPriceWithVat ?? '7.00';
    const tgtMpc = tgtPrice?.retailUnitPriceWithVat ?? srcMpc;

    const nextLine: TransferLine = {
      id: generateUuidV7(),
      itemId: item.id,
      quantity: '10.0000',
      purchaseUnitPrice: purchUnit,
      purchaseTotalValue: round2(qty.mul(d(purchUnit))),
      sourceRetailUnitPrice: srcMpc,
      sourceRetailTotalValue: round2(qty.mul(d(srcMpc))),
      targetRetailUnitPrice: tgtMpc,
      targetRetailTotalValue: round2(qty.mul(d(tgtMpc))),
      vatRatePercent: vatRate,
    };
    setDoc(recomputeDocTotals([...doc.lines, nextLine]));
    setNewItemId('');
  };

  const handleLineChange = (lineId: string, field: 'quantity' | 'targetRetailUnitPrice', value: string) => {
    if (isReadOnly) return;
    const nextLines = doc.lines.map((line) => {
      if (line.id !== lineId) return line;
      const qty = field === 'quantity' ? d(value) : d(line.quantity);
      const tgtUnit = field === 'targetRetailUnitPrice' ? round2(value) : line.targetRetailUnitPrice;
      return {
        ...line,
        quantity: field === 'quantity' ? value : line.quantity,
        targetRetailUnitPrice: tgtUnit,
        purchaseTotalValue: round2(qty.mul(d(line.purchaseUnitPrice))),
        sourceRetailTotalValue: round2(qty.mul(d(line.sourceRetailUnitPrice))),
        targetRetailTotalValue: round2(qty.mul(d(tgtUnit))),
      };
    });
    setDoc(recomputeDocTotals(nextLines));
  };

  const priceDifferenceTotal = d(doc.totalTargetRetailValue).minus(d(doc.totalSourceRetailValue));

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${t('nav.transfers')} — ${doc.docNumber}`}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
          {!isReadOnly && (
            <>
              <Button variant="secondary" onClick={() => onSaveDraft(doc)}>
                <Save className="h-4 w-4" /><span>{t('common.saveDraft')}</span>
              </Button>
              <Button
                variant="success"
                disabled={!doc.sourceStoreId || !doc.targetStoreId || doc.sourceStoreId === doc.targetStoreId || doc.lines.length === 0}
                onClick={() => onPostDocument(doc)}
              >
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Input label={t('warehouse.docNumber')} value={doc.docNumber} disabled={isReadOnly} onChange={(e) => setDoc({ ...doc, docNumber: e.target.value })} className="font-mono" />
          <Input label={t('warehouse.docDate')} type="date" value={doc.docDate} disabled={isReadOnly} onChange={(e) => setDoc({ ...doc, docDate: e.target.value })} />
          <Combobox label={t('warehouse.sourceStore')} options={storeOptions} value={doc.sourceStoreId} disabled={isReadOnly} onChange={(val) => setDoc({ ...doc, sourceStoreId: val })} />
          <Combobox label={t('warehouse.targetStore')} options={storeOptions} value={doc.targetStoreId} disabled={isReadOnly} onChange={(val) => setDoc({ ...doc, targetStoreId: val })} />
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
                <th className="px-3 py-2 font-semibold text-right">{t('common.quantity')}</th>
                <th className="px-3 py-2 font-semibold text-right">{t('warehouse.purchaseUnitPrice')}</th>
                <th className="px-3 py-2 font-semibold text-right">{t('warehouse.oldRetailPrice')}</th>
                <th className="px-3 py-2 font-semibold text-right">{t('warehouse.newRetailPrice')}</th>
                <th className="px-3 py-2 font-semibold text-right">{t('warehouse.priceDifference')}</th>
                {!isReadOnly && <th className="px-3 py-2 text-center">{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {doc.lines.map((line) => {
                const item = items.find((i) => i.id === line.itemId);
                const diffVal = d(line.targetRetailTotalValue).minus(d(line.sourceRetailTotalValue));
                return (
                  <tr key={line.id}>
                    <td className="px-3 py-2 font-medium">{item?.name ?? line.itemId}</td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" step="0.01" disabled={isReadOnly} value={line.quantity} onChange={(e) => handleLineChange(line.id, 'quantity', e.target.value)} className="h-7 w-20 rounded border border-input bg-background px-1.5 text-right font-mono" />
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{formatPrice4(line.purchaseUnitPrice, true)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatMoney2(line.sourceRetailUnitPrice, true)}</td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" step="0.01" disabled={isReadOnly} value={line.targetRetailUnitPrice} onChange={(e) => handleLineChange(line.id, 'targetRetailUnitPrice', e.target.value)} className="h-7 w-24 rounded border border-input bg-background px-1.5 text-right font-mono font-semibold" />
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{formatMoney2(diffVal, true)}</td>
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

        <div className="grid grid-cols-3 gap-3 rounded-md border border-border bg-muted/30 p-3">
          <div><div className="text-muted-foreground">{t('warehouse.sourceStore')}</div><div className="font-mono font-semibold">{formatMoney2(doc.totalSourceRetailValue, true)}</div></div>
          <div><div className="text-muted-foreground">{t('warehouse.targetStore')}</div><div className="font-mono font-semibold">{formatMoney2(doc.totalTargetRetailValue, true)}</div></div>
          <div><div className="text-muted-foreground">{t('warehouse.priceDifference')}</div><div className="font-mono font-bold text-primary">{formatMoney2(priceDifferenceTotal, true)}</div></div>
        </div>
      </div>
    </Dialog>
  );
}
