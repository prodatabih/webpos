import { t } from '../../i18n';
import { formatMoney2 } from '../../lib/money';

interface CalculationZtrPanelProps {
  freight: string;
  customs: string;
  handling: string;
  other: string;
  totalZtr: string;
  allocationMethod: 'VALUE' | 'QUANTITY';
  disabled: boolean;
  onZtrChange: (field: 'freight' | 'customs' | 'handling' | 'other', value: string) => void;
  onAllocationMethodChange: (method: 'VALUE' | 'QUANTITY') => void;
}

export function CalculationZtrPanel({
  freight,
  customs,
  handling,
  other,
  totalZtr,
  allocationMethod,
  disabled,
  onZtrChange,
  onAllocationMethodChange,
}: CalculationZtrPanelProps) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t('warehouse.totalZtr')}
          </span>
          <span className="font-mono text-sm font-bold text-warning">
            {formatMoney2(totalZtr, true)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div>
            <label className="block text-[11px] text-muted-foreground">{t('warehouse.ztrFreight')}</label>
            <input
              type="number"
              step="0.01"
              disabled={disabled}
              value={freight}
              onChange={(e) => onZtrChange('freight', e.target.value)}
              className="mt-1 h-8 w-full rounded border border-input bg-background px-2 text-right font-mono text-xs focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted-foreground">{t('warehouse.ztrCustoms')}</label>
            <input
              type="number"
              step="0.01"
              disabled={disabled}
              value={customs}
              onChange={(e) => onZtrChange('customs', e.target.value)}
              className="mt-1 h-8 w-full rounded border border-input bg-background px-2 text-right font-mono text-xs focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted-foreground">{t('warehouse.ztrHandling')}</label>
            <input
              type="number"
              step="0.01"
              disabled={disabled}
              value={handling}
              onChange={(e) => onZtrChange('handling', e.target.value)}
              className="mt-1 h-8 w-full rounded border border-input bg-background px-2 text-right font-mono text-xs focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted-foreground">{t('warehouse.ztrOther')}</label>
            <input
              type="number"
              step="0.01"
              disabled={disabled}
              value={other}
              onChange={(e) => onZtrChange('other', e.target.value)}
              className="mt-1 h-8 w-full rounded border border-input bg-background px-2 text-right font-mono text-xs focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs">
        <span className="text-muted-foreground">{t('warehouse.ztrAllocation')}:</span>
        <select
          disabled={disabled}
          value={allocationMethod}
          onChange={(e) => onAllocationMethodChange(e.target.value as 'VALUE' | 'QUANTITY')}
          className="h-7 rounded border border-input bg-background px-2 font-medium text-foreground focus:ring-1 focus:ring-ring"
        >
          <option value="VALUE">{t('warehouse.ztrByValue')}</option>
          <option value="QUANTITY">{t('warehouse.ztrByQuantity')}</option>
        </select>
      </div>
    </div>
  );
}
