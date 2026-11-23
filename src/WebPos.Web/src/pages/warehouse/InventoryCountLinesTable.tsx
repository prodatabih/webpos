import { useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { t } from '../../i18n';
import { d, formatMoney2, formatQty } from '../../lib/money';
import { advanceGridFocus } from '../../lib/keyboardGridUtils';
import type { InventoryCountLine, Item } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { NumericInput } from '../../components/ui/NumericInput';

interface InventoryCountLinesTableProps {
  lines: InventoryCountLine[];
  items: Item[];
  isReadOnly: boolean;
  onCountedQtyChange: (lineId: string, val: string) => void;
  onAllowedWasteChange: (lineId: string, val: string) => void;
  onRemoveLine: (lineId: string) => void;
  onAddBlankLine?: () => void;
}

export function InventoryCountLinesTable({
  lines,
  items,
  isReadOnly,
  onCountedQtyChange,
  onAllowedWasteChange,
  onRemoveLine,
  onAddBlankLine,
}: InventoryCountLinesTableProps) {
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

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
        <tbody ref={tbodyRef} className="divide-y divide-border font-mono">
          {lines.map((line, idx) => {
            const item = items.find((i) => i.id === line.itemId);
            const diffDec = d(line.differenceQuantity || '0');
            const isWasteDisabled = isReadOnly || !line.itemId || diffDec.gte(0);
            const isLastRow = idx === lines.length - 1;
            const handleAdvance = (currentEl: HTMLElement) => {
              advanceGridFocus({
                tbodyEl: tbodyRef.current,
                rowIndex: idx,
                currentEl,
                isLastRow,
                hasSelectedItem: Boolean(line.itemId),
                onAddRow: () => onAddBlankLine?.(),
              });
            };

            return (
              <tr key={line.id} data-row-index={idx} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-medium font-sans">
                  <div>{item?.name ?? line.itemId}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{item?.sku}</div>
                </td>
                <td className="px-3 py-2 text-right">{formatQty(line.bookQuantity, 2)}</td>
                <td className="px-3 py-2 text-right">
                  <NumericInput
                    decimals={4}
                    min={0}
                    data-grid-cell="true"
                    disabled={isReadOnly}
                    value={line.countedQuantity}
                    onChange={(val) => onCountedQtyChange(line.id, val)}
                    onEnterKey={(e) => handleAdvance(e.currentTarget)}
                    onTabForward={
                      isWasteDisabled
                        ? (e) => {
                            if (Boolean(line.itemId) && (onAddBlankLine || !isLastRow)) {
                              e.preventDefault();
                              handleAdvance(e.currentTarget);
                            }
                          }
                        : undefined
                    }
                    className="h-7 w-24 rounded border border-input bg-background px-1.5 text-right font-mono font-semibold text-xs"
                  />
                </td>
                <td className="px-3 py-2 text-right">{formatQty(line.differenceQuantity, 2)}</td>
                <td className="px-3 py-2 text-right">{formatMoney2(line.retailUnitPriceWithVat, true)}</td>
                <td className="px-3 py-2 text-right font-semibold text-success">{formatMoney2(line.surplusRetailValue, true)}</td>
                <td className="px-3 py-2 text-right">
                  <NumericInput
                    decimals={4}
                    min={0}
                    data-grid-cell="true"
                    disabled={isWasteDisabled}
                    value={line.allowedWasteQuantity ?? '0.0000'}
                    onChange={(val) => onAllowedWasteChange(line.id, val)}
                    onEnterKey={(e) => handleAdvance(e.currentTarget)}
                    onTabForward={(e) => {
                      if (Boolean(line.itemId) && (onAddBlankLine || !isLastRow)) {
                        e.preventDefault();
                        handleAdvance(e.currentTarget);
                      }
                    }}
                    className="h-7 w-24 rounded border border-input bg-background px-1.5 text-right font-mono text-xs"
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
                    <Button
                      variant="ghost"
                      size="icon"
                      tabIndex={-1}
                      onClick={() => onRemoveLine(line.id)}
                    >
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
