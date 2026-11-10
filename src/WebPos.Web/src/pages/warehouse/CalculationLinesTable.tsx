import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { t } from '../../i18n';
import { formatMoney2, formatPrice4, formatQty } from '../../lib/money';
import type { CalculationLine, Item, StoreItemPrice, StoreType } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import type { ComboboxOption } from '../../components/ui/Combobox';
import type { CalculationLineField } from './calculationUtils';
import { CalculationLineRow } from './CalculationLineRow';

interface CalculationLinesTableProps {
  lines: CalculationLine[];
  items: Item[];
  storePrices: StoreItemPrice[];
  activeStoreId: string;
  storeType?: StoreType;
  isReadOnly: boolean;
  onUpdateLineField: (
    lineId: string,
    field: CalculationLineField,
    value: string
  ) => void;
  onSelectItemForLine: (lineId: string, itemId: string) => void;
  onRemoveLine: (lineId: string) => void;
  onCopyLine: (idx: number) => void;
  onAddItem: (item: Item) => void;
  onAddBlankLine: () => void;
}

export function CalculationLinesTable({
  lines,
  items,
  storePrices,
  activeStoreId,
  storeType = 'RETAIL',
  isReadOnly,
  onUpdateLineField,
  onSelectItemForLine,
  onRemoveLine,
  onCopyLine,
  onAddItem,
  onAddBlankLine,
}: CalculationLinesTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const isRaw = storeType === 'RAW_MATERIAL' || storeType === 'PRODUCTION';
  const isWholesale = storeType === 'WHOLESALE';

  const comboboxOptions = useMemo<ComboboxOption[]>(
    () =>
      items
        .filter((it) => it.isActive)
        .map((it) => {
          const sp = storePrices.find((p) => p.storeId === activeStoreId && p.itemId === it.id);
          const pr = isRaw
            ? sp?.purchaseUnitPrice
            : isWholesale
            ? sp?.wholesaleUnitPriceExclVat
            : sp?.retailUnitPriceWithVat;
          return {
            value: it.id,
            label: it.name,
            code: it.sku,
            barcode: it.primaryBarcode,
            price: pr,
            stockQty: sp?.currentStockQty,
            uom: it.uom,
          };
        }),
    [items, storePrices, activeStoreId, isRaw, isWholesale]
  );

  const filteredItems = searchTerm.trim()
    ? items
        .filter(
          (it) =>
            it.isActive &&
            (it.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              it.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
              it.primaryBarcode.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        .slice(0, 30)
    : items.filter((it) => it.isActive).slice(0, 15);

  return (
    <div className="space-y-3">
      {!isReadOnly && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 rounded-xl border border-border bg-card p-2 shadow-xs">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder={t('warehouse.fastItemSearchPlaceholder')}
                className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
              />
            </div>

            {showDropdown && filteredItems.length > 0 && (
              <div className="absolute left-0 right-0 top-14 z-50 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-xl divide-y divide-border">
                {filteredItems.map((item) => {
                  const sp = storePrices.find((p) => p.storeId === activeStoreId && p.itemId === item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        onAddItem(item);
                        setSearchTerm('');
                        setShowDropdown(false);
                      }}
                      className="flex cursor-pointer items-center justify-between p-2.5 text-xs hover:bg-muted/60"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary">
                          {item.sku}
                        </span>
                        <div>
                          <div className="font-semibold text-foreground">{item.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {item.primaryBarcode} · {item.uom}
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-muted-foreground">
                          NC: {formatPrice4(sp?.purchaseUnitPrice ?? '0.0000')}
                        </div>
                        <div className="font-semibold text-success">
                          {isWholesale ? 'VPC: ' : 'MPC: '}
                          {formatMoney2(
                            (isWholesale ? sp?.wholesaleUnitPriceExclVat : sp?.retailUnitPriceWithVat) ?? '0.00',
                            true
                          )} ({formatQty(sp?.currentStockQty ?? '0', 2)})
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={onAddBlankLine}>
            <Plus className="h-4 w-4" />
            <span>{t('warehouse.emptyLine')}</span>
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="border-b border-border bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-2 py-2 text-center w-8">#</th>
              <th className="px-2 py-2 min-w-[200px]">{t('common.name')}</th>
              <th className="px-2 py-2 text-center w-12">{t('common.uom')}</th>
              <th className="px-2 py-2 text-right w-16">{t('common.quantity')}</th>
              <th className="px-2 py-2 text-right w-20">{t('warehouse.supplierUnitPrice')}</th>
              <th className="px-2 py-2 text-right w-14">{t('warehouse.discountPercent')}</th>
              <th className="px-2 py-2 text-right w-20">{t('warehouse.netSupplierPrice')}</th>
              <th className="px-2 py-2 text-right w-16">{t('warehouse.dependentCost')}</th>
              <th className="px-2 py-2 text-right w-20 bg-primary/5 font-bold text-primary">{t('warehouse.purchaseUnitPrice')}</th>
              <th className="px-2 py-2 text-right w-24 bg-primary/5 text-primary">{t('warehouse.purchaseValue')}</th>
              {!isRaw && (
                <>
                  <th className="px-2 py-2 text-right w-16">{t('warehouse.marginPercent')}</th>
                  <th className="px-2 py-2 text-right w-20">{t('warehouse.marginAmount')}</th>
                  {isWholesale ? (
                    <>
                      <th className="px-2 py-2 text-right w-20 bg-info/5 font-bold text-info">{t('warehouse.wholesaleUnitPrice')}</th>
                      <th className="px-2 py-2 text-right w-24 bg-info/5 text-info font-semibold">{t('warehouse.wholesaleTotalValue')}</th>
                    </>
                  ) : (
                    <>
                      <th className="px-2 py-2 text-right w-20">{t('warehouse.sellingPriceExclVat')}</th>
                      <th className="px-2 py-2 text-center w-12">{t('common.vat')}</th>
                      <th className="px-2 py-2 text-right w-20 bg-success/5 font-bold text-success">{t('warehouse.retailPriceWithVat')}</th>
                      <th className="px-2 py-2 text-right w-24 bg-success/5 text-success font-semibold">{t('warehouse.retailValueWithVat')}</th>
                    </>
                  )}
                </>
              )}
              {!isReadOnly && <th className="px-2 py-2 text-center w-16">{t('common.actions')}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-mono text-[11px]">
            {lines.map((line, idx) => (
              <CalculationLineRow
                key={line.id}
                line={line}
                idx={idx}
                item={items.find((i) => i.id === line.itemId)}
                isReadOnly={isReadOnly}
                isRaw={isRaw}
                isWholesale={isWholesale}
                comboboxOptions={comboboxOptions}
                onSelectItem={(val) => onSelectItemForLine(line.id, val)}
                onUpdateField={(field, val) => onUpdateLineField(line.id, field, val)}
                onCopy={() => onCopyLine(idx)}
                onRemove={() => onRemoveLine(line.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
