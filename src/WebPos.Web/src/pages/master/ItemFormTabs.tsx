import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { t } from '../../i18n';
import { formatMoney2, formatPrice4, formatQty, round2, round4 } from '../../lib/money';
import { generateUuidV7 } from '../../lib/utils';
import type { Item, ItemBarcode, ItemBomLine, StoreItemPrice, StoreLocation } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Combobox } from '../../components/ui/Combobox';
import { Badge } from '../../components/ui/Badge';

export function ItemBarcodesTab({
  itemId,
  barcodes,
  onChange,
}: {
  itemId: string;
  barcodes: ItemBarcode[];
  onChange: (next: ItemBarcode[]) => void;
}) {
  const [barcode, setBarcode] = useState('');
  const [uom, setUom] = useState('pak');
  const [packMultiplier, setPackMultiplier] = useState('6.0000');
  const [description, setDescription] = useState('');

  const handleAdd = () => {
    if (!barcode.trim()) return;
    onChange([
      ...barcodes,
      { id: generateUuidV7(), itemId, barcode: barcode.trim(), uom: uom.trim() || 'pak', packMultiplier: round4(packMultiplier), description: description.trim() },
    ]);
    setBarcode('');
    setDescription('');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end rounded-lg border border-border bg-muted/20 p-3">
        <Input label={t('master.barcode')} value={barcode} onChange={(e) => setBarcode(e.target.value)} className="font-mono" />
        <Input label={t('common.uom')} value={uom} onChange={(e) => setUom(e.target.value)} />
        <Input label={t('master.packMultiplier')} value={packMultiplier} onChange={(e) => setPackMultiplier(e.target.value)} className="font-mono text-right" />
        <div className="flex gap-2 items-end">
          <Input label={t('common.description')} value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button variant="secondary" size="md" onClick={handleAdd}>
            <Plus className="h-4 w-4" />
            <span>{t('common.add')}</span>
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/60 border-b border-border text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">{t('master.barcode')}</th>
              <th className="px-3 py-2 font-semibold">{t('common.uom')}</th>
              <th className="px-3 py-2 font-semibold text-right">{t('master.packMultiplier')}</th>
              <th className="px-3 py-2 font-semibold">{t('common.description')}</th>
              <th className="px-3 py-2 font-semibold text-right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {barcodes.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">{t('common.noResults')}</td></tr>
            ) : (
              barcodes.map((b) => (
                <tr key={b.id}>
                  <td className="px-3 py-2 font-mono font-medium">{b.barcode}</td>
                  <td className="px-3 py-2">{b.uom}</td>
                  <td className="px-3 py-2 font-mono text-right">{formatQty(b.packMultiplier, 4)}</td>
                  <td className="px-3 py-2">{b.description}</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="icon" onClick={() => onChange(barcodes.filter((x) => x.id !== b.id))} aria-label={t('common.delete')}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ItemBomTab({
  parentItemId,
  allItems,
  bomLines,
  stores = [],
  onChange,
}: {
  parentItemId: string;
  allItems: Item[];
  bomLines: ItemBomLine[];
  stores?: StoreLocation[];
  onChange: (next: ItemBomLine[]) => void;
}) {
  const [componentItemId, setComponentItemId] = useState('');
  const [sourceStoreId, setSourceStoreId] = useState(stores[0]?.id ?? '');
  const [quantity, setQuantity] = useState('0.1000');
  const [wastePercent, setWastePercent] = useState('0.00');

  const itemOptions = allItems.filter((i) => i.id !== parentItemId).map((i) => ({ value: i.id, code: i.sku, label: i.name, sublabel: i.uom }));

  const handleAdd = () => {
    if (!componentItemId) return;
    onChange([
      ...bomLines,
      {
        id: generateUuidV7(),
        parentItemId,
        componentItemId,
        sourceStoreId: sourceStoreId || undefined,
        quantity: round4(quantity),
        wastePercent: round2(wastePercent),
      },
    ]);
    setComponentItemId('');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end rounded-lg border border-border bg-muted/20 p-3">
        <div className="sm:col-span-2">
          <Combobox label={t('master.componentItem')} options={itemOptions} value={componentItemId} onChange={setComponentItemId} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-foreground">{t('master.sourceStore')}</label>
          <select
            value={sourceStoreId}
            onChange={(e) => setSourceStoreId(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-2 text-xs text-foreground"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.code} ({s.storeType})</option>
            ))}
          </select>
        </div>
        <Input label={t('common.quantity')} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="font-mono text-right" />
        <div className="flex gap-2 items-end">
          <Input label={t('master.wastePercent')} value={wastePercent} onChange={(e) => setWastePercent(e.target.value)} className="font-mono text-right" />
          <Button variant="secondary" size="md" onClick={handleAdd}>
            <Plus className="h-4 w-4" />
            <span>{t('common.add')}</span>
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/60 border-b border-border text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">{t('master.componentItem')}</th>
              <th className="px-3 py-2 font-semibold">{t('master.sourceStore')}</th>
              <th className="px-3 py-2 font-semibold text-right">{t('common.quantity')}</th>
              <th className="px-3 py-2 font-semibold text-right">{t('master.wastePercent')}</th>
              <th className="px-3 py-2 font-semibold text-right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {bomLines.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">{t('common.noResults')}</td></tr>
            ) : (
              bomLines.map((line) => {
                const comp = allItems.find((i) => i.id === line.componentItemId);
                const st = stores.find((s) => s.id === line.sourceStoreId);
                return (
                  <tr key={line.id}>
                    <td className="px-3 py-2 font-medium">{comp ? `${comp.sku} — ${comp.name}` : line.componentItemId}</td>
                    <td className="px-3 py-2 font-mono">{st ? `${st.code} — ${st.name}` : '-'}</td>
                    <td className="px-3 py-2 font-mono text-right">{formatQty(line.quantity, 4)}</td>
                    <td className="px-3 py-2 font-mono text-right">{formatMoney2(line.wastePercent)}%</td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="icon" onClick={() => onChange(bomLines.filter((x) => x.id !== line.id))} aria-label={t('common.delete')}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ItemStorePricesTab({
  itemId,
  stores,
  storePrices,
  allowPriceChangeWithoutLeveling = false,
  onUpsertPrice,
}: {
  itemId: string;
  stores: StoreLocation[];
  storePrices: StoreItemPrice[];
  allowPriceChangeWithoutLeveling?: boolean;
  onUpsertPrice: (price: StoreItemPrice) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/60 border-b border-border text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">{t('app.storeLocation')}</th>
              <th className="px-3 py-2 font-semibold text-right">{t('warehouse.purchaseUnitPrice')}</th>
              <th className="px-3 py-2 font-semibold text-right">{t('warehouse.sellingPriceExclVat')}</th>
              <th className="px-3 py-2 font-semibold text-right">{t('warehouse.retailPriceWithVat')}</th>
              <th className="px-3 py-2 font-semibold text-right">{t('master.currentStock')}</th>
              <th className="px-3 py-2 font-semibold">{t('master.shelfLocation')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {stores.map((st) => {
              const current: StoreItemPrice = storePrices.find((p) => p.storeId === st.id && p.itemId === itemId) ?? {
                id: `sip-${st.id}-${itemId}`, storeId: st.id, itemId, purchaseUnitPrice: '0.0000', wholesaleUnitPriceExclVat: '0.0000',
                retailUnitPriceWithVat: '0.00', currentStockQty: '0.0000', minStockQty: '10.0000', shelfLocation: 'A-01-01', needsLabelPrint: false, updatedAt: new Date().toISOString(),
              };
              const hasStock = Number(current.currentStockQty) > 0;
              const isPriceLocked = hasStock && !allowPriceChangeWithoutLeveling;

              return (
                <tr key={st.id}>
                  <td className="px-3 py-2 font-medium">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{st.code}</Badge>
                      <span>{st.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-right">{formatPrice4(current.purchaseUnitPrice, true)}</td>
                  <td className="px-3 py-2 font-mono text-right">{formatPrice4(current.wholesaleUnitPriceExclVat, true)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <input
                        type="text"
                        defaultValue={current.retailUnitPriceWithVat}
                        disabled={isPriceLocked}
                        onBlur={(e) => onUpsertPrice({ ...current, retailUnitPriceWithVat: round2(e.target.value), needsLabelPrint: true, updatedAt: new Date().toISOString() })}
                        className={`h-7 w-24 rounded border border-input px-2 text-right font-mono text-xs ${
                          isPriceLocked ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-80' : 'bg-card text-foreground'
                        }`}
                      />
                      {isPriceLocked && (
                        <span className="text-[10px] text-destructive max-w-[140px] text-right font-medium leading-tight">
                          {t('master.priceChangeBlockedStock')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-right">
                    <Badge variant={hasStock ? 'default' : 'outline'}>
                      {formatQty(current.currentStockQty, 2)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      defaultValue={current.shelfLocation}
                      onBlur={(e) => onUpsertPrice({ ...current, shelfLocation: e.target.value.trim(), updatedAt: new Date().toISOString() })}
                      className="h-7 w-24 rounded border border-input bg-card px-2 font-mono text-xs text-foreground"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
