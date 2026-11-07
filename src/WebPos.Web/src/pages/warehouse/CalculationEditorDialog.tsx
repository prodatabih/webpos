import { useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { Plus, Trash2, CheckCircle2, Save } from 'lucide-react';
import { t } from '../../i18n';
import { calculateCalculationLine, d, formatMoney2, formatPrice4, round2 } from '../../lib/money';
import { generateUuidV7 } from '../../lib/utils';
import type {
  CalculationDocument,
  CalculationLine,
  Item,
  Partner,
  StoreItemPrice,
  VatRate,
} from '../../types/domain';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Combobox } from '../../components/ui/Combobox';
import { Badge, DocumentStatusBadge } from '../../components/ui/Badge';

interface CalculationEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDoc: CalculationDocument;
  partners: Partner[];
  items: Item[];
  vatRates: VatRate[];
  storePrices: StoreItemPrice[];
  onSaveDraft: (doc: CalculationDocument) => void;
  onPostDocument: (doc: CalculationDocument) => void;
}

type EditableLineField =
  | 'quantity'
  | 'supplierUnitPrice'
  | 'discountPercent'
  | 'dependentCostPerUnit'
  | 'marginPercent'
  | 'retailUnitPriceWithVat';

export function CalculationEditorDialog({
  open,
  onOpenChange,
  initialDoc,
  partners,
  items,
  vatRates,
  storePrices,
  onSaveDraft,
  onPostDocument,
}: CalculationEditorDialogProps) {
  const [doc, setDoc] = useState<CalculationDocument>(initialDoc);
  const [newItemId, setNewItemId] = useState('');
  const isReadOnly = doc.status !== 'DRAFT';

  const supplierOptions = useMemo(
    () =>
      partners
        .filter((p) => p.isActive && (p.partnerType === 'SUPPLIER' || p.partnerType === 'BOTH'))
        .map((p) => ({ value: p.id, code: p.code, label: p.name, sublabel: `${t('master.taxIdNumber')}: ${p.taxIdNumber}` })),
    [partners]
  );

  const itemOptions = useMemo(
    () =>
      items
        .filter((it) => it.isActive)
        .map((it) => ({ value: it.id, code: it.sku, label: it.name, sublabel: `${it.primaryBarcode} · ${it.uom}` })),
    [items]
  );

  const recomputeDocTotals = (nextLines: CalculationLine[]): CalculationDocument => ({
    ...doc,
    lines: nextLines,
    totalPurchaseValue: round2(nextLines.reduce((a, l) => a.plus(d(l.purchaseTotalValue)), new Decimal(0))),
    totalMarginAmount: round2(nextLines.reduce((a, l) => a.plus(d(l.marginTotalAmount)), new Decimal(0))),
    totalSellingValueExclVat: round2(nextLines.reduce((a, l) => a.plus(d(l.sellingTotalValueExclVat)), new Decimal(0))),
    totalEmbeddedVatAmount: round2(nextLines.reduce((a, l) => a.plus(d(l.embeddedVatTotalAmount)), new Decimal(0))),
    totalRetailValueWithVat: round2(nextLines.reduce((a, l) => a.plus(d(l.retailTotalValueWithVat)), new Decimal(0))),
  });

  const handleAddLine = () => {
    if (!newItemId || isReadOnly) return;
    const item = items.find((i) => i.id === newItemId);
    if (!item) return;
    const existingPrice = storePrices.find((p) => p.storeId === doc.storeId && p.itemId === item.id);
    const vatRate = vatRates.find((v) => v.id === item.vatRateId)?.ratePercent ?? '17.00';
    const calc = calculateCalculationLine({
      quantity: '10.0000',
      supplierUnitPrice: existingPrice?.purchaseUnitPrice ?? '5.0000',
      discountPercent: '0.00',
      dependentCostPerUnit: '0.0000',
      targetRetailPriceWithVat: existingPrice?.retailUnitPriceWithVat ?? '7.00',
      vatRatePercent: vatRate,
    });
    setDoc(recomputeDocTotals([...doc.lines, { id: generateUuidV7(), itemId: item.id, ...calc }]));
    setNewItemId('');
  };

  const handleLineChange = (lineId: string, field: EditableLineField, value: string) => {
    if (isReadOnly) return;
    const nextLines = doc.lines.map((line) => {
      if (line.id !== lineId) return line;
      const calc = calculateCalculationLine({
        quantity: field === 'quantity' ? value : line.quantity,
        supplierUnitPrice: field === 'supplierUnitPrice' ? value : line.supplierUnitPrice,
        discountPercent: field === 'discountPercent' ? value : line.discountPercent,
        dependentCostPerUnit: field === 'dependentCostPerUnit' ? value : line.dependentCostPerUnit,
        marginPercent: field === 'marginPercent' ? value : line.marginPercent,
        targetRetailPriceWithVat:
          field === 'retailUnitPriceWithVat' ? value : field === 'marginPercent' ? undefined : line.retailUnitPriceWithVat,
        vatRatePercent: line.vatRatePercent,
      });
      return { ...line, ...calc };
    });
    setDoc(recomputeDocTotals(nextLines));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${t('nav.calculations')} — ${doc.docNumber}`}
      size="full"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
          {!isReadOnly && (
            <>
              <Button variant="secondary" onClick={() => onSaveDraft(doc)}>
                <Save className="h-4 w-4" />
                <span>{t('common.saveDraft')}</span>
              </Button>
              <Button variant="success" disabled={!doc.partnerId || doc.lines.length === 0} onClick={() => onPostDocument(doc)}>
                <CheckCircle2 className="h-4 w-4" />
                <span>{t('common.postDocument')}</span>
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input label={t('warehouse.docNumber')} value={doc.docNumber} disabled={isReadOnly} onChange={(e) => setDoc({ ...doc, docNumber: e.target.value })} className="font-mono" />
          <Input label={t('warehouse.docDate')} type="date" value={doc.docDate} disabled={isReadOnly} onChange={(e) => setDoc({ ...doc, docDate: e.target.value })} />
          <Combobox label={t('warehouse.supplier')} options={supplierOptions} value={doc.partnerId} disabled={isReadOnly} onChange={(val) => setDoc({ ...doc, partnerId: val })} />
          <Input label={t('warehouse.supplierInvoiceNumber')} value={doc.supplierInvoiceNumber} disabled={isReadOnly} onChange={(e) => setDoc({ ...doc, supplierInvoiceNumber: e.target.value })} />
          <Input label={t('warehouse.supplierInvoiceDate')} type="date" value={doc.supplierInvoiceDate} disabled={isReadOnly} onChange={(e) => setDoc({ ...doc, supplierInvoiceDate: e.target.value })} />
        </div>

        {!isReadOnly && (
          <div className="flex items-end gap-2 rounded-md border border-border bg-muted/30 p-3">
            <div className="flex-1">
              <Combobox label={t('nav.items')} options={itemOptions} value={newItemId} onChange={setNewItemId} />
            </div>
            <Button variant="primary" onClick={handleAddLine} disabled={!newItemId}>
              <Plus className="h-4 w-4" />
              <span>{t('common.add')}</span>
            </Button>
          </div>
        )}

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-2 py-2 font-semibold">{t('common.name')}</th>
                <th className="px-2 py-2 font-semibold text-right">{t('common.quantity')}</th>
                <th className="px-2 py-2 font-semibold text-right">{t('warehouse.supplierUnitPrice')}</th>
                <th className="px-2 py-2 font-semibold text-right">{t('warehouse.discountPercent')}</th>
                <th className="px-2 py-2 font-semibold text-right">{t('warehouse.dependentCost')}</th>
                <th className="px-2 py-2 font-semibold text-right">{t('warehouse.purchaseUnitPrice')}</th>
                <th className="px-2 py-2 font-semibold text-right">{t('warehouse.marginPercent')}</th>
                <th className="px-2 py-2 font-semibold text-right">{t('common.vat')}</th>
                <th className="px-2 py-2 font-semibold text-right">{t('warehouse.oldRetailPrice')}</th>
                <th className="px-2 py-2 font-semibold text-right">{t('warehouse.newRetailPrice')}</th>
                <th className="px-2 py-2 font-semibold text-right">{t('warehouse.retailValueWithVat')}</th>
                {!isReadOnly && <th className="px-2 py-2 text-center">{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {doc.lines.map((line) => {
                const item = items.find((i) => i.id === line.itemId);
                const storeRec = storePrices.find((p) => p.storeId === doc.storeId && p.itemId === line.itemId);
                const oldMpc = storeRec?.retailUnitPriceWithVat ?? line.retailUnitPriceWithVat;
                const triggersAutoLeveling = storeRec && d(storeRec.currentStockQty).gt(0) && !d(oldMpc).eq(d(line.retailUnitPriceWithVat));
                return (
                  <tr key={line.id}>
                    <td className="px-2 py-1.5">
                      <div className="font-medium">{item?.name ?? line.itemId}</div>
                      {triggersAutoLeveling && <Badge variant="warning" className="mt-0.5 text-[10px]">{t('warehouse.autoLevelingCreated')}</Badge>}
                    </td>
                    <td className="px-2 py-1.5 text-right"><input type="number" step="0.01" disabled={isReadOnly} value={line.quantity} onChange={(e) => handleLineChange(line.id, 'quantity', e.target.value)} className="h-7 w-20 rounded border border-input bg-background px-1.5 text-right font-mono" /></td>
                    <td className="px-2 py-1.5 text-right"><input type="number" step="0.0001" disabled={isReadOnly} value={line.supplierUnitPrice} onChange={(e) => handleLineChange(line.id, 'supplierUnitPrice', e.target.value)} className="h-7 w-24 rounded border border-input bg-background px-1.5 text-right font-mono" /></td>
                    <td className="px-2 py-1.5 text-right"><input type="number" step="0.5" disabled={isReadOnly} value={line.discountPercent} onChange={(e) => handleLineChange(line.id, 'discountPercent', e.target.value)} className="h-7 w-16 rounded border border-input bg-background px-1.5 text-right font-mono" /></td>
                    <td className="px-2 py-1.5 text-right"><input type="number" step="0.0001" disabled={isReadOnly} value={line.dependentCostPerUnit} onChange={(e) => handleLineChange(line.id, 'dependentCostPerUnit', e.target.value)} className="h-7 w-20 rounded border border-input bg-background px-1.5 text-right font-mono" /></td>
                    <td className="px-2 py-1.5 text-right font-mono">{formatPrice4(line.purchaseUnitPrice)}</td>
                    <td className="px-2 py-1.5 text-right"><input type="number" step="0.1" disabled={isReadOnly} value={line.marginPercent} onChange={(e) => handleLineChange(line.id, 'marginPercent', e.target.value)} className="h-7 w-16 rounded border border-input bg-background px-1.5 text-right font-mono" /></td>
                    <td className="px-2 py-1.5 text-right font-mono">{line.vatRatePercent}%</td>
                    <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{formatMoney2(oldMpc)}</td>
                    <td className="px-2 py-1.5 text-right"><input type="number" step="0.01" disabled={isReadOnly} value={line.retailUnitPriceWithVat} onChange={(e) => handleLineChange(line.id, 'retailUnitPriceWithVat', e.target.value)} className="h-7 w-20 rounded border border-input bg-background px-1.5 text-right font-mono font-semibold" /></td>
                    <td className="px-2 py-1.5 text-right font-mono font-semibold">{formatMoney2(line.retailTotalValueWithVat, true)}</td>
                    {!isReadOnly && (
                      <td className="px-2 py-1.5 text-center">
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

        <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/30 p-3 sm:grid-cols-5">
          <div><div className="text-muted-foreground">{t('warehouse.purchaseValue')}</div><div className="font-mono font-semibold">{formatMoney2(doc.totalPurchaseValue, true)}</div></div>
          <div><div className="text-muted-foreground">{t('warehouse.marginAmount')}</div><div className="font-mono font-semibold">{formatMoney2(doc.totalMarginAmount, true)}</div></div>
          <div><div className="text-muted-foreground">{t('warehouse.sellingValueExclVat')}</div><div className="font-mono font-semibold">{formatMoney2(doc.totalSellingValueExclVat, true)}</div></div>
          <div><div className="text-muted-foreground">{t('warehouse.embeddedVat')}</div><div className="font-mono font-semibold">{formatMoney2(doc.totalEmbeddedVatAmount, true)}</div></div>
          <div><div className="text-muted-foreground">{t('warehouse.retailValueWithVat')}</div><div className="font-mono text-sm font-bold text-primary">{formatMoney2(doc.totalRetailValueWithVat, true)}</div></div>
        </div>
      </div>
    </Dialog>
  );
}
