import { useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { Plus, Trash2, CheckCircle2, Save } from 'lucide-react';
import { t } from '../../i18n';
import { d, formatMoney2, formatPrice4, round2 } from '../../lib/money';
import { generateUuidV7 } from '../../lib/utils';
import type {
  Item,
  OtherWarehouseDocSubtype,
  OtherWarehouseDocument,
  OtherWarehouseLine,
  Partner,
  StoreItemPrice,
  VatRate,
} from '../../types/domain';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Combobox } from '../../components/ui/Combobox';
import { DocumentStatusBadge } from '../../components/ui/Badge';

interface OtherWarehouseDocDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDoc: OtherWarehouseDocument;
  items: Item[];
  partners: Partner[];
  vatRates: VatRate[];
  storePrices: StoreItemPrice[];
  onSaveDraft: (doc: OtherWarehouseDocument) => void;
  onPostDocument: (doc: OtherWarehouseDocument) => void;
}

export function OtherWarehouseDocDialog({
  open,
  onOpenChange,
  initialDoc,
  items,
  partners,
  vatRates,
  storePrices,
  onSaveDraft,
  onPostDocument,
}: OtherWarehouseDocDialogProps) {
  const [doc, setDoc] = useState<OtherWarehouseDocument>(initialDoc);
  const [newItemId, setNewItemId] = useState('');
  const isReadOnly = doc.status !== 'DRAFT';

  const subtypeOptions: Array<{ value: OtherWarehouseDocSubtype; label: string }> = [
    { value: 'WRITEOFF_KALORASTUR', label: t('warehouse.subtypeWriteoff') },
    { value: 'INTERNAL_ISSUE', label: t('warehouse.subtypeInternalIssue') },
    { value: 'INTERNAL_RECEIPT', label: t('warehouse.subtypeInternalReceipt') },
    { value: 'SUPPLIER_RETURN', label: t('warehouse.subtypeSupplierReturn') },
    { value: 'INTERNAL_PRODUCTION', label: t('warehouse.subtypeProduction') },
  ];

  const supplierOptions = useMemo(
    () => partners.filter((p) => p.isActive && (p.partnerType === 'SUPPLIER' || p.partnerType === 'BOTH')).map((p) => ({ value: p.id, code: p.code, label: p.name })),
    [partners]
  );

  const itemOptions = useMemo(
    () => items.filter((it) => it.isActive).map((it) => ({ value: it.id, code: it.sku, label: it.name, sublabel: `${it.primaryBarcode} · ${it.uom}` })),
    [items]
  );

  const recomputeDocTotals = (nextLines: OtherWarehouseLine[]): OtherWarehouseDocument => ({
    ...doc,
    lines: nextLines,
    totalPurchaseValue: round2(nextLines.reduce((a, l) => a.plus(d(l.purchaseTotalValue)), new Decimal(0))),
    totalRetailValueWithVat: round2(nextLines.reduce((a, l) => a.plus(d(l.retailTotalValueWithVat)), new Decimal(0))),
  });

  const handleAddLine = () => {
    if (!newItemId || isReadOnly) return;
    const item = items.find((i) => i.id === newItemId);
    if (!item) return;
    const priceRec = storePrices.find((p) => p.storeId === doc.storeId && p.itemId === item.id);
    const vatRate = vatRates.find((v) => v.id === item.vatRateId)?.ratePercent ?? '17.00';
    const qty = new Decimal(1);
    const purchUnit = priceRec?.purchaseUnitPrice ?? '1.0000';
    const retailUnit = priceRec?.retailUnitPriceWithVat ?? '1.50';

    const nextLine: OtherWarehouseLine = {
      id: generateUuidV7(),
      itemId: item.id,
      quantity: '1.0000',
      purchaseUnitPrice: purchUnit,
      purchaseTotalValue: round2(qty.mul(d(purchUnit))),
      retailUnitPriceWithVat: retailUnit,
      retailTotalValueWithVat: round2(qty.mul(d(retailUnit))),
      vatRatePercent: vatRate,
    };
    setDoc(recomputeDocTotals([...doc.lines, nextLine]));
    setNewItemId('');
  };

  const handleQtyChange = (lineId: string, qtyStr: string) => {
    if (isReadOnly) return;
    const nextLines = doc.lines.map((line) => {
      if (line.id !== lineId) return line;
      const qty = d(qtyStr);
      return {
        ...line,
        quantity: qtyStr,
        purchaseTotalValue: round2(qty.mul(d(line.purchaseUnitPrice))),
        retailTotalValueWithVat: round2(qty.mul(d(line.retailUnitPriceWithVat))),
      };
    });
    setDoc(recomputeDocTotals(nextLines));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${t('nav.otherWarehouseDocs')} — ${doc.docNumber}`}
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Input label={t('warehouse.docNumber')} value={doc.docNumber} disabled={isReadOnly} onChange={(e) => setDoc({ ...doc, docNumber: e.target.value })} className="font-mono" />
          <Input label={t('warehouse.docDate')} type="date" value={doc.docDate} disabled={isReadOnly} onChange={(e) => setDoc({ ...doc, docDate: e.target.value })} />
          <Combobox label={t('warehouse.docSubtype')} options={subtypeOptions} value={doc.subtype} disabled={isReadOnly} onChange={(val) => setDoc({ ...doc, subtype: val as OtherWarehouseDocSubtype })} />
          {doc.subtype === 'SUPPLIER_RETURN' ? (
            <Combobox label={t('warehouse.supplier')} options={supplierOptions} value={doc.partnerId ?? ''} disabled={isReadOnly} onChange={(val) => setDoc({ ...doc, partnerId: val })} />
          ) : (
            <Input label={t('common.notes')} value={doc.notes} disabled={isReadOnly} onChange={(e) => setDoc({ ...doc, notes: e.target.value })} />
          )}
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
                <th className="px-3 py-2 font-semibold text-right">{t('warehouse.purchaseValue')}</th>
                <th className="px-3 py-2 font-semibold text-right">{t('warehouse.retailPriceWithVat')}</th>
                <th className="px-3 py-2 font-semibold text-right">{t('warehouse.retailValueWithVat')}</th>
                {!isReadOnly && <th className="px-3 py-2 text-center">{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {doc.lines.map((line) => {
                const item = items.find((i) => i.id === line.itemId);
                return (
                  <tr key={line.id}>
                    <td className="px-3 py-2 font-medium">{item?.name ?? line.itemId}</td>
                    <td className="px-3 py-2 text-right">
                      <input type="number" step="0.01" disabled={isReadOnly} value={line.quantity} onChange={(e) => handleQtyChange(line.id, e.target.value)} className="h-7 w-20 rounded border border-input bg-background px-1.5 text-right font-mono font-semibold" />
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{formatPrice4(line.purchaseUnitPrice, true)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatMoney2(line.purchaseTotalValue, true)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatMoney2(line.retailUnitPriceWithVat, true)}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{formatMoney2(line.retailTotalValueWithVat, true)}</td>
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
