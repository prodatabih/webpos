import { Trash2 } from 'lucide-react';
import { t } from '../../i18n';
import { d, formatMoney2, formatQty } from '../../lib/money';
import type { InventoryCountLine, Item } from '../../types/domain';
import { Button } from '../../components/ui/Button';

interface InventoryCountLinesTableProps {
  lines: InventoryCountLine[];
  items: Item[];
  isReadOnly: boolean;
  onCountedQtyChange: (lineId: string, val: string) => void;
  onAllowedWasteChange: (lineId: string, val: string) => void;
  onRemoveLine: (lineId: string) => void;
}

export function InventoryCountLinesTable({
  lines,
  items,
  isReadOnly,
  onCountedQtyChange,
  onAllowedWasteChange,
  onRemoveLine,
}: InventoryCountLinesTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-border bg-muted/60 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-semibold">{t('common.name')}</th>
            <th className="px-3 py-2 font-semibold text-right">{t('warehouse.bookQuantity')}</th>
            <th className="px-3 py-2 font-semibold text-right">{t('warehouse.countedQuantity')}</th>
            <th className="px-3 py-2 font-semibold text-right">{t('warehouse.priceDifference')}</th>
            <th className="px-3 py-2 font-semibold text-right">{t('warehouse.retailPriceWithVat')}</th>
            <th className="px-3 py-2 font-semibold text-right text-success">{t('warehouse.surplusValue')}</th>
            <th className="px-3 py-2 font-semibold text-right">{t('warehouse.allowedWasteQty')}</th>
            <th className="px-3 py-2 font-semibold text-right text-destructive">{t('warehouse.unrecognizedShortageValue')}</th>
            <th className="px-3 py-2 font-semibold text-right">{t('warehouse.unrecognizedShortageVat')}</th>
            {!isReadOnly && <th className="px-3 py-2 text-center">{t('common.actions')}</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border font-mono">
          {lines.map((line) => {
            const item = items.find((i) => i.id === line.itemId);
            return (
              <tr key={line.id} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-medium font-sans">
                  <div>{item?.name ?? line.itemId}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{item?.sku}</div>
                </td>
                <td className="px-3 py-2 text-right">{formatQty(line.bookQuantity, 2)}</td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    disabled={isReadOnly}
                    value={line.countedQuantity}
                    onChange={(e) => onCountedQtyChange(line.id, e.target.value)}
                    className="h-7 w-20 rounded border border-input bg-background px-1.5 text-right font-mono font-semibold"
                  />
                </td>
                <td className="px-3 py-2 text-right">{formatQty(line.differenceQuantity, 2)}</td>
                <td className="px-3 py-2 text-right">{formatMoney2(line.retailUnitPriceWithVat, true)}</td>
                <td className="px-3 py-2 text-right font-semibold text-success">{formatMoney2(line.surplusRetailValue, true)}</td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    disabled={isReadOnly || d(line.differenceQuantity).gte(0)}
                    value={line.allowedWasteQuantity ?? '0.0000'}
                    onChange={(e) => onAllowedWasteChange(line.id, e.target.value)}
                    className="h-7 w-20 rounded border border-input bg-background px-1.5 text-right font-mono"
                  />
                </td>
                <td className="px-3 py-2 text-right font-semibold text-destructive">
                  {formatMoney2(line.unrecognizedShortageRetailValue ?? line.shortageRetailValue, true)}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  {formatMoney2(line.unrecognizedShortageVat ?? '0.00', true)}
                </td>
                {!isReadOnly && (
                  <td className="px-3 py-2 text-center">
                    <Button variant="ghost" size="icon" onClick={() => onRemoveLine(line.id)}>
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
  );
}
