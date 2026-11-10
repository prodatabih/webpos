import { Copy, Search, X } from 'lucide-react';
import { t } from '../../i18n';
import { d, formatMoney2, formatQty, round2 } from '../../lib/money';
import type { Item, PriceLevelingLine } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { Combobox, type ComboboxOption } from '../../components/ui/Combobox';

interface PriceLevelingLineRowProps {
  line: PriceLevelingLine;
  idx: number;
  item?: Item;
  isReadOnly: boolean;
  comboboxOptions: ComboboxOption[];
  onSelectItem: (itemId: string) => void;
  onNewPriceChange: (val: string) => void;
  onCopy: () => void;
  onRemove: () => void;
}

export function PriceLevelingLineRow({
  line,
  idx,
  item,
  isReadOnly,
  comboboxOptions,
  onSelectItem,
  onNewPriceChange,
  onCopy,
  onRemove,
}: PriceLevelingLineRowProps) {
  const unitDiff = round2(d(line.newRetailPriceWithVat || '0').minus(d(line.oldRetailPriceWithVat || '0')));

  return (
    <tr className="hover:bg-muted/30">
      <td className="px-2 py-1.5 text-center text-muted-foreground">{idx + 1}</td>
      <td className="px-2 py-1.5 font-sans min-w-[220px]">
        {!line.itemId ? (
          <Combobox
            options={comboboxOptions}
            value=""
            onChange={onSelectItem}
            placeholder={t('warehouse.selectItem')}
            searchPlaceholder={t('warehouse.searchItemPlaceholder')}
            className="w-full"
          />
        ) : (
          <div className="flex items-center justify-between gap-1 group">
            <div>
              <div className="font-medium text-foreground">{item?.name ?? line.itemId}</div>
              <div className="font-mono text-[10px] text-muted-foreground">
                {item?.sku ?? '-'} {item?.primaryBarcode ? `· ${item.primaryBarcode}` : ''}
              </div>
            </div>
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => onSelectItem('')}
                title={t('warehouse.changeItem')}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <Search className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </td>
      <td className="px-2 py-1.5 text-center font-sans text-muted-foreground">
        {item?.uom ?? 'KOM'}
      </td>
      <td className="px-2 py-1.5 text-right font-mono">
        {formatQty(line.stockQuantity, 2)}
      </td>
      <td className="px-2 py-1.5 text-right font-mono">
        {formatMoney2(line.oldRetailPriceWithVat, true)}
      </td>
      <td className="px-1 py-1.5 text-right">
        <input
          type="number"
          step="0.01"
          disabled={isReadOnly || !line.itemId}
          value={line.newRetailPriceWithVat}
          onChange={(e) => onNewPriceChange(e.target.value)}
          className="h-7 w-24 rounded border border-success/60 bg-background px-2 text-right font-mono font-bold text-success"
        />
      </td>
      <td className="px-2 py-1.5 text-right font-mono">
        {formatMoney2(unitDiff, true)}
      </td>
      <td className="px-2 py-1.5 text-right font-mono font-bold text-primary bg-primary/5">
        {formatMoney2(line.totalRetailDifference, true)}
      </td>
      <td className="px-2 py-1.5 text-right font-mono">
        {formatMoney2(line.embeddedVatDifference, true)}
      </td>
      <td className="px-2 py-1.5 text-right font-mono">
        {formatMoney2(line.marginDifference, true)}
      </td>
      {!isReadOnly && (
        <td className="px-1 py-1.5 text-center">
          <div className="flex items-center justify-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              title={t('warehouse.copyLine')}
              disabled={!line.itemId}
              onClick={onCopy}
            >
              <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title={t('warehouse.deleteLine')}
              onClick={onRemove}
            >
              <X className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        </td>
      )}
    </tr>
  );
}
