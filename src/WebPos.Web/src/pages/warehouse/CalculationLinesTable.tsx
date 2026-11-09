import { useState } from 'react';
import { Copy, Plus, Search, X } from 'lucide-react';
import { t } from '../../i18n';
import { formatMoney2, formatPrice4, formatQty } from '../../lib/money';
import type { CalculationLine, Item, StoreItemPrice } from '../../types/domain';
import { Button } from '../../components/ui/Button';

interface CalculationLinesTableProps {
  lines: CalculationLine[];
  items: Item[];
  storePrices: StoreItemPrice[];
  activeStoreId: string;
  isReadOnly: boolean;
  onUpdateLineField: (
    lineId: string,
    field: 'quantity' | 'supplierUnitPrice' | 'discountPercent' | 'marginPercent' | 'retailUnitPriceWithVat',
    value: string
  ) => void;
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
  isReadOnly,
  onUpdateLineField,
  onRemoveLine,
  onCopyLine,
  onAddItem,
  onAddBlankLine,
}: CalculationLinesTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

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
                          MPC: {formatMoney2(sp?.retailUnitPriceWithVat ?? '0.00', true)} ({formatQty(sp?.currentStockQty ?? '0', 2)})
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
              <th className="px-2 py-2 min-w-[170px]">{t('common.name')}</th>
              <th className="px-2 py-2 text-center w-12">{t('common.uom')}</th>
              <th className="px-2 py-2 text-right w-16">{t('common.quantity')}</th>
              <th className="px-2 py-2 text-right w-20">{t('warehouse.supplierUnitPrice')}</th>
              <th className="px-2 py-2 text-right w-14">{t('warehouse.discountPercent')}</th>
              <th className="px-2 py-2 text-right w-20">{t('warehouse.netSupplierPrice')}</th>
              <th className="px-2 py-2 text-right w-16">{t('warehouse.dependentCost')}</th>
              <th className="px-2 py-2 text-right w-20 bg-primary/5 font-bold text-primary">{t('warehouse.purchaseUnitPrice')}</th>
              <th className="px-2 py-2 text-right w-24 bg-primary/5 text-primary">{t('warehouse.purchaseValue')}</th>
              <th className="px-2 py-2 text-right w-16">{t('warehouse.marginPercent')}</th>
              <th className="px-2 py-2 text-right w-20">{t('warehouse.marginAmount')}</th>
              <th className="px-2 py-2 text-right w-20">{t('warehouse.sellingPriceExclVat')}</th>
              <th className="px-2 py-2 text-center w-12">{t('common.vat')}</th>
              <th className="px-2 py-2 text-right w-20 bg-success/5 font-bold text-success">{t('warehouse.retailPriceWithVat')}</th>
              <th className="px-2 py-2 text-right w-24 bg-success/5 text-success font-semibold">{t('warehouse.retailValueWithVat')}</th>
              {!isReadOnly && <th className="px-2 py-2 text-center w-16">{t('common.actions')}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-mono text-[11px]">
            {lines.map((line, idx) => {
              const item = items.find((i) => i.id === line.itemId);
              return (
                <tr key={line.id} className="hover:bg-muted/30">
                  <td className="px-2 py-1.5 text-center text-muted-foreground">{idx + 1}</td>
                  <td className="px-2 py-1.5 font-sans">
                    <div className="font-medium text-foreground">{item?.name ?? (line.itemId || t('warehouse.emptyLine'))}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{item?.sku ?? '-'}</div>
                  </td>
                  <td className="px-2 py-1.5 text-center font-sans text-muted-foreground">{item?.uom ?? 'KOM'}</td>
                  <td className="px-1 py-1.5 text-right">
                    <input
                      type="number"
                      step="0.01"
                      disabled={isReadOnly}
                      value={line.quantity}
                      onChange={(e) => onUpdateLineField(line.id, 'quantity', e.target.value)}
                      className="h-6 w-16 rounded border border-input bg-background px-1 text-right font-mono"
                    />
                  </td>
                  <td className="px-1 py-1.5 text-right">
                    <input
                      type="number"
                      step="0.0001"
                      disabled={isReadOnly}
                      value={line.supplierUnitPrice}
                      onChange={(e) => onUpdateLineField(line.id, 'supplierUnitPrice', e.target.value)}
                      className="h-6 w-20 rounded border border-input bg-background px-1 text-right font-mono"
                    />
                  </td>
                  <td className="px-1 py-1.5 text-right">
                    <input
                      type="number"
                      step="0.1"
                      disabled={isReadOnly}
                      value={line.discountPercent}
                      onChange={(e) => onUpdateLineField(line.id, 'discountPercent', e.target.value)}
                      className="h-6 w-14 rounded border border-input bg-background px-1 text-right font-mono"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground">{formatPrice4(line.netSupplierUnitPrice)}</td>
                  <td className="px-2 py-1.5 text-right text-warning">{formatPrice4(line.dependentCostPerUnit)}</td>
                  <td className="px-2 py-1.5 text-right font-bold text-primary bg-primary/5">{formatPrice4(line.purchaseUnitPrice)}</td>
                  <td className="px-2 py-1.5 text-right text-primary bg-primary/5">{formatMoney2(line.purchaseTotalValue, true)}</td>
                  <td className="px-1 py-1.5 text-right">
                    <input
                      type="number"
                      step="0.01"
                      disabled={isReadOnly}
                      value={line.marginPercent}
                      onChange={(e) => onUpdateLineField(line.id, 'marginPercent', e.target.value)}
                      className="h-6 w-16 rounded border border-info/50 bg-background px-1 text-right font-mono font-semibold text-info"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right">{formatMoney2(line.marginTotalAmount, true)}</td>
                  <td className="px-2 py-1.5 text-right">{formatMoney2(line.sellingTotalValueExclVat, true)}</td>
                  <td className="px-2 py-1.5 text-center text-muted-foreground">{line.vatRatePercent}%</td>
                  <td className="px-1 py-1.5 text-right bg-success/5">
                    <input
                      type="number"
                      step="0.01"
                      disabled={isReadOnly}
                      value={line.retailUnitPriceWithVat}
                      onChange={(e) => onUpdateLineField(line.id, 'retailUnitPriceWithVat', e.target.value)}
                      className="h-6 w-20 rounded border border-success/60 bg-background px-1 text-right font-mono font-bold text-success"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right font-bold text-success bg-success/5">
                    {formatMoney2(line.retailTotalValueWithVat, true)}
                  </td>
                  {!isReadOnly && (
                    <td className="px-1 py-1.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t('warehouse.copyLine')}
                          onClick={() => onCopyLine(idx)}
                        >
                          <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t('warehouse.deleteLine')}
                          onClick={() => onRemoveLine(line.id)}
                        >
                          <X className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
