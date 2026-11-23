import type React from 'react';
import { AlertTriangle, Copy, Search, X } from 'lucide-react';
import { t } from '../../i18n';
import { d, formatMoney2, formatPrice4, formatQty } from '../../lib/money';
import type { Item, TransferLine } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { Combobox, type ComboboxOption } from '../../components/ui/Combobox';
import { NumericInput } from '../../components/ui/NumericInput';

interface TransferLineRowProps {
  line: TransferLine;
  idx: number;
  isLastRow: boolean;
  item?: Item;
  sourceStockQty: string;
  isReadOnly: boolean;
  comboboxOptions: ComboboxOption[];
  onSelectItem: (itemId: string) => void;
  onAfterSelectItem: () => void;
  onLineChange: (field: 'quantity' | 'targetRetailUnitPrice', val: string) => void;
  onAdvanceFocus: (currentEl: HTMLElement) => void;
  onRowFocus: () => void;
  onCopy: () => void;
  onRemove: () => void;
}

export function TransferLineRow({
  line,
  idx,
  isLastRow,
  item,
  sourceStockQty,
  isReadOnly,
  comboboxOptions,
  onSelectItem,
  onAfterSelectItem,
  onLineChange,
  onAdvanceFocus,
  onRowFocus,
  onCopy,
  onRemove,
}: TransferLineRowProps) {
  const isInsufficientStock =
    Boolean(line.itemId) && d(line.quantity || '0').gt(d(sourceStockQty || '0'));

  const handleLastFieldTabForward = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isLastRow || Boolean(line.itemId)) {
      e.preventDefault();
      onAdvanceFocus(e.currentTarget);
    }
  };

  return (
    <tr data-row-index={idx} onFocus={onRowFocus} className="hover:bg-muted/30">
      <td className="px-2 py-1.5 text-center text-muted-foreground">{idx + 1}</td>
      <td className="px-2 py-1.5 font-sans min-w-[220px]">
        {!line.itemId ? (
          <Combobox
            options={comboboxOptions}
            value=""
            onChange={onSelectItem}
            onAfterSelect={onAfterSelectItem}
            dataGridItemPicker={true}
            disabled={isReadOnly}
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
                tabIndex={-1}
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
        {formatQty(sourceStockQty, 2)}
      </td>
      <td className="px-1 py-1.5 text-right">
        <div className="flex items-center justify-end gap-1">
          {isInsufficientStock && (
            <span title={t('warehouse.insufficientStockWarning')}>
              <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
            </span>
          )}
          <NumericInput
            decimals={4}
            min={0}
            disabled={isReadOnly || !line.itemId}
            value={line.quantity}
            onChange={(val) => onLineChange('quantity', val)}
            onEnterKey={(e) => onAdvanceFocus(e.currentTarget)}
            data-grid-cell="true"
            className={`h-7 w-24 bg-background px-1.5 font-mono text-xs font-bold ${
              isInsufficientStock
                ? 'border-warning text-warning'
                : 'border-input text-foreground'
            }`}
          />
        </div>
      </td>
      <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">
        {formatPrice4(line.purchaseUnitPrice, true)}
      </td>
      <td className="px-2 py-1.5 text-right font-mono">
        {formatMoney2(line.sourceRetailUnitPrice, true)}
      </td>
      <td className="px-1 py-1.5 text-right">
        <NumericInput
          decimals={2}
          min={0}
          disabled={isReadOnly || !line.itemId}
          value={line.targetRetailUnitPrice}
          onChange={(val) => onLineChange('targetRetailUnitPrice', val)}
          onEnterKey={(e) => onAdvanceFocus(e.currentTarget)}
          onTabForward={handleLastFieldTabForward}
          data-grid-cell="true"
          className="h-7 w-24 border-success/60 bg-background px-1.5 font-mono text-xs font-bold text-success"
        />
      </td>
      <td className="px-2 py-1.5 text-right font-mono font-bold text-primary bg-primary/5">
        {formatMoney2(line.targetRetailTotalValue, true)}
      </td>
      {!isReadOnly && (
        <td className="px-1 py-1.5 text-center">
          <div className="flex items-center justify-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              tabIndex={-1}
              title={t('warehouse.copyLine')}
              disabled={!line.itemId}
              onClick={onCopy}
            >
              <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              tabIndex={-1}
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
