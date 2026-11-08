import { Trash2 } from 'lucide-react';
import { t } from '../../i18n';
import { d, formatMoney2, formatQty, round2 } from '../../lib/money';
import type { Item, PriceLevelingLine } from '../../types/domain';
import { Button } from '../../components/ui/Button';

interface PriceLevelingLinesTableProps {
  lines: PriceLevelingLine[];
  items: Item[];
  isReadOnly: boolean;
  onNewPriceChange: (lineId: string, val: string) => void;
  onRemoveLine: (lineId: string) => void;
}

export function PriceLevelingLinesTable({
  lines,
  items,
  isReadOnly,
  onNewPriceChange,
  onRemoveLine,
}: PriceLevelingLinesTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-border bg-muted/60 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-semibold">{t('common.name')}</th>
            <th className="px-3 py-2 font-semibold text-right">{t('master.currentStock')}</th>
            <th className="px-3 py-2 font-semibold text-right">{t('warehouse.oldRetailPrice')}</th>
            <th className="px-3 py-2 font-semibold text-right">{t('warehouse.newRetailPrice')}</th>
            <th className="px-3 py-2 font-semibold text-right">{t('warehouse.priceDifference')}</th>
            <th className="px-3 py-2 font-semibold text-right font-bold text-primary">{t('warehouse.financialEffectStock')}</th>
            <th className="px-3 py-2 font-semibold text-right">{t('warehouse.financialEffectVat')}</th>
            <th className="px-3 py-2 font-semibold text-right">{t('warehouse.financialEffectMargin')}</th>
            {!isReadOnly && <th className="px-3 py-2 text-center">{t('common.actions')}</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {lines.map((line) => {
            const item = items.find((i) => i.id === line.itemId);
            const unitDiff = round2(d(line.newRetailPriceWithVat).minus(d(line.oldRetailPriceWithVat)));
            return (
              <tr key={line.id}>
                <td className="px-3 py-2 font-medium">{item?.name ?? line.itemId}</td>
                <td className="px-3 py-2 text-right font-mono">{formatQty(line.stockQuantity, 2)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatMoney2(line.oldRetailPriceWithVat, true)}</td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    disabled={isReadOnly}
                    value={line.newRetailPriceWithVat}
                    onChange={(e) => onNewPriceChange(line.id, e.target.value)}
                    className="h-7 w-24 rounded border border-input bg-background px-2 text-right font-mono font-semibold"
                  />
                </td>
                <td className="px-3 py-2 text-right font-mono">{formatMoney2(unitDiff, true)}</td>
                <td className="px-3 py-2 text-right font-mono font-bold text-primary">{formatMoney2(line.totalRetailDifference, true)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatMoney2(line.embeddedVatDifference, true)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatMoney2(line.marginDifference, true)}</td>
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
