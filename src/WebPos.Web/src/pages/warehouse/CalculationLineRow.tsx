import type React from 'react';
import { Copy, Search, X } from 'lucide-react';
import { t } from '../../i18n';
import { formatMoney2, formatPrice4 } from '../../lib/money';
import type { CalculationLine, Item } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { Combobox, type ComboboxOption } from '../../components/ui/Combobox';
import { NumericInput } from '../../components/ui/NumericInput';
import type { CalculationLineField } from './calculationUtils';

interface CalculationLineRowProps {
  line: CalculationLine;
  idx: number;
  isLastRow: boolean;
  item?: Item;
  isReadOnly: boolean;
  isRaw: boolean;
  isWholesale: boolean;
  comboboxOptions: ComboboxOption[];
  onSelectItem: (itemId: string) => void;
  onAfterSelectItem: () => void;
  onUpdateField: (field: CalculationLineField, value: string) => void;
  onAdvanceFocus: (currentEl: HTMLElement) => void;
  onRowFocus: () => void;
  onCopy: () => void;
  onRemove: () => void;
}

export function CalculationLineRow({
  line,
  idx,
  isLastRow,
  item,
  isReadOnly,
  isRaw,
  isWholesale,
  comboboxOptions,
  onSelectItem,
  onAfterSelectItem,
  onUpdateField,
  onAdvanceFocus,
  onRowFocus,
  onCopy,
  onRemove,
}: CalculationLineRowProps) {
  const handleLastFieldTabForward = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isLastRow || Boolean(line.itemId)) {
      e.preventDefault();
      onAdvanceFocus(e.currentTarget);
    }
  };

  return (
    <tr data-row-index={idx} onFocus={onRowFocus} className="hover:bg-muted/30">
      <td className="px-2 py-1.5 text-center text-muted-foreground">{idx + 1}</td>
      <td className="px-2 py-1.5 font-sans min-w-[200px]">
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
              <div className="font-mono text-[10px] text-muted-foreground">{item?.sku ?? '-'}</div>
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
      <td className="px-2 py-1.5 text-center font-sans text-muted-foreground">{item?.uom ?? 'KOM'}</td>
      <td className="px-1 py-1.5 text-right">
        <NumericInput
          decimals={4}
          min={0}
          disabled={isReadOnly}
          value={line.quantity}
          onChange={(val) => onUpdateField('quantity', val)}
          onEnterKey={(e) => onAdvanceFocus(e.currentTarget)}
          data-grid-cell="true"
          className="h-7 w-20 bg-background px-1.5 font-mono text-xs"
        />
      </td>
      <td className="px-1 py-1.5 text-right">
        <NumericInput
          decimals={4}
          min={0}
          disabled={isReadOnly}
          value={line.supplierUnitPrice}
          onChange={(val) => onUpdateField('supplierUnitPrice', val)}
          onEnterKey={(e) => onAdvanceFocus(e.currentTarget)}
          data-grid-cell="true"
          className="h-7 w-24 bg-background px-1.5 font-mono text-xs"
        />
      </td>
      <td className="px-1 py-1.5 text-right">
        <NumericInput
          decimals={2}
          min={0}
          disabled={isReadOnly}
          value={line.discountPercent}
          onChange={(val) => onUpdateField('discountPercent', val)}
          onEnterKey={(e) => onAdvanceFocus(e.currentTarget)}
          onTabForward={isRaw ? handleLastFieldTabForward : undefined}
          data-grid-cell="true"
          className="h-7 w-16 bg-background px-1.5 font-mono text-xs"
        />
      </td>
      <td className="px-2 py-1.5 text-right text-muted-foreground">{formatPrice4(line.netSupplierUnitPrice)}</td>
      <td className="px-2 py-1.5 text-right text-warning">{formatPrice4(line.dependentCostPerUnit)}</td>
      <td className="px-2 py-1.5 text-right font-bold text-primary bg-primary/5">{formatPrice4(line.purchaseUnitPrice)}</td>
      <td className="px-2 py-1.5 text-right text-primary bg-primary/5">{formatMoney2(line.purchaseTotalValue, true)}</td>
      {!isRaw && (
        <>
          <td className="px-1 py-1.5 text-right">
            <NumericInput
              decimals={2}
              min={0}
              disabled={isReadOnly}
              value={line.marginPercent}
              onChange={(val) => onUpdateField('marginPercent', val)}
              onEnterKey={(e) => onAdvanceFocus(e.currentTarget)}
              data-grid-cell="true"
              className="h-7 w-20 border-info/50 bg-background px-1.5 font-mono text-xs font-semibold text-info"
            />
          </td>
          <td className="px-2 py-1.5 text-right">{formatMoney2(line.marginTotalAmount, true)}</td>
          {isWholesale ? (
            <>
              <td className="px-1 py-1.5 text-right bg-info/5">
                <NumericInput
                  decimals={4}
                  min={0}
                  disabled={isReadOnly}
                  value={line.sellingUnitPriceExclVat}
                  onChange={(val) => onUpdateField('sellingUnitPriceExclVat', val)}
                  onEnterKey={(e) => onAdvanceFocus(e.currentTarget)}
                  onTabForward={handleLastFieldTabForward}
                  data-grid-cell="true"
                  className="h-7 w-24 border-info/60 bg-background px-1.5 font-mono text-xs font-bold text-info"
                />
              </td>
              <td className="px-2 py-1.5 text-right font-bold text-info bg-info/5">
                {formatMoney2(line.sellingTotalValueExclVat, true)}
              </td>
            </>
          ) : (
            <>
              <td className="px-2 py-1.5 text-right">{formatMoney2(line.sellingTotalValueExclVat, true)}</td>
              <td className="px-2 py-1.5 text-center text-muted-foreground">{line.vatRatePercent}%</td>
              <td className="px-1 py-1.5 text-right bg-success/5">
                <NumericInput
                  decimals={2}
                  min={0}
                  disabled={isReadOnly}
                  value={line.retailUnitPriceWithVat}
                  onChange={(val) => onUpdateField('retailUnitPriceWithVat', val)}
                  onEnterKey={(e) => onAdvanceFocus(e.currentTarget)}
                  onTabForward={handleLastFieldTabForward}
                  data-grid-cell="true"
                  className="h-7 w-24 border-success/60 bg-background px-1.5 font-mono text-xs font-bold text-success"
                />
              </td>
              <td className="px-2 py-1.5 text-right font-bold text-success bg-success/5">
                {formatMoney2(line.retailTotalValueWithVat, true)}
              </td>
            </>
          )}
        </>
      )}
      {!isReadOnly && (
        <td className="px-1 py-1.5 text-center">
          <div className="flex items-center justify-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              tabIndex={-1}
              title={t('warehouse.copyLine')}
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
