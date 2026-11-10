import { Copy, Search, X } from 'lucide-react';
import { t } from '../../i18n';
import { formatMoney2, formatPrice4 } from '../../lib/money';
import type { CalculationLine, Item } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { Combobox, type ComboboxOption } from '../../components/ui/Combobox';
import type { CalculationLineField } from './calculationUtils';

interface CalculationLineRowProps {
  line: CalculationLine;
  idx: number;
  item?: Item;
  isReadOnly: boolean;
  isRaw: boolean;
  isWholesale: boolean;
  comboboxOptions: ComboboxOption[];
  onSelectItem: (itemId: string) => void;
  onUpdateField: (field: CalculationLineField, value: string) => void;
  onCopy: () => void;
  onRemove: () => void;
}

export function CalculationLineRow({
  line,
  idx,
  item,
  isReadOnly,
  isRaw,
  isWholesale,
  comboboxOptions,
  onSelectItem,
  onUpdateField,
  onCopy,
  onRemove,
}: CalculationLineRowProps) {
  return (
    <tr className="hover:bg-muted/30">
      <td className="px-2 py-1.5 text-center text-muted-foreground">{idx + 1}</td>
      <td className="px-2 py-1.5 font-sans min-w-[200px]">
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
              <div className="font-mono text-[10px] text-muted-foreground">{item?.sku ?? '-'}</div>
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
      <td className="px-2 py-1.5 text-center font-sans text-muted-foreground">{item?.uom ?? 'KOM'}</td>
      <td className="px-1 py-1.5 text-right">
        <input
          type="number"
          step="0.01"
          disabled={isReadOnly}
          value={line.quantity}
          onChange={(e) => onUpdateField('quantity', e.target.value)}
          className="h-6 w-16 rounded border border-input bg-background px-1 text-right font-mono"
        />
      </td>
      <td className="px-1 py-1.5 text-right">
        <input
          type="number"
          step="0.0001"
          disabled={isReadOnly}
          value={line.supplierUnitPrice}
          onChange={(e) => onUpdateField('supplierUnitPrice', e.target.value)}
          className="h-6 w-20 rounded border border-input bg-background px-1 text-right font-mono"
        />
      </td>
      <td className="px-1 py-1.5 text-right">
        <input
          type="number"
          step="0.1"
          disabled={isReadOnly}
          value={line.discountPercent}
          onChange={(e) => onUpdateField('discountPercent', e.target.value)}
          className="h-6 w-14 rounded border border-input bg-background px-1 text-right font-mono"
        />
      </td>
      <td className="px-2 py-1.5 text-right text-muted-foreground">{formatPrice4(line.netSupplierUnitPrice)}</td>
      <td className="px-2 py-1.5 text-right text-warning">{formatPrice4(line.dependentCostPerUnit)}</td>
      <td className="px-2 py-1.5 text-right font-bold text-primary bg-primary/5">{formatPrice4(line.purchaseUnitPrice)}</td>
      <td className="px-2 py-1.5 text-right text-primary bg-primary/5">{formatMoney2(line.purchaseTotalValue, true)}</td>
      {!isRaw && (
        <>
          <td className="px-1 py-1.5 text-right">
            <input
              type="number"
              step="0.01"
              disabled={isReadOnly}
              value={line.marginPercent}
              onChange={(e) => onUpdateField('marginPercent', e.target.value)}
              className="h-6 w-16 rounded border border-info/50 bg-background px-1 text-right font-mono font-semibold text-info"
            />
          </td>
          <td className="px-2 py-1.5 text-right">{formatMoney2(line.marginTotalAmount, true)}</td>
          {isWholesale ? (
            <>
              <td className="px-1 py-1.5 text-right bg-info/5">
                <input
                  type="number"
                  step="0.0001"
                  disabled={isReadOnly}
                  value={line.sellingUnitPriceExclVat}
                  onChange={(e) => onUpdateField('sellingUnitPriceExclVat', e.target.value)}
                  className="h-6 w-20 rounded border border-info/60 bg-background px-1 text-right font-mono font-bold text-info"
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
                <input
                  type="number"
                  step="0.01"
                  disabled={isReadOnly}
                  value={line.retailUnitPriceWithVat}
                  onChange={(e) => onUpdateField('retailUnitPriceWithVat', e.target.value)}
                  className="h-6 w-20 rounded border border-success/60 bg-background px-1 text-right font-mono font-bold text-success"
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
              title={t('warehouse.copyLine')}
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
