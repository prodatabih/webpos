import { t } from '../../i18n';
import { formatMoney2 } from '../../lib/money';

interface InventoryCountRecapPanelProps {
  totalSurplusRetailValue: string;
  totalAllowedWasteValue?: string;
  totalUnrecognizedShortageValue?: string;
  totalShortageRetailValue: string;
  totalUnrecognizedShortageVat?: string;
}

export function InventoryCountRecapPanel({
  totalSurplusRetailValue,
  totalAllowedWasteValue,
  totalUnrecognizedShortageValue,
  totalShortageRetailValue,
  totalUnrecognizedShortageVat,
}: InventoryCountRecapPanelProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-lg border border-border bg-muted/40 p-3 text-xs font-mono">
      <div>
        <div className="text-muted-foreground font-sans">{t('warehouse.surplusValue')}</div>
        <div className="text-sm font-bold text-success">{formatMoney2(totalSurplusRetailValue, true)}</div>
      </div>
      <div>
        <div className="text-muted-foreground font-sans">{t('warehouse.allowedWasteValue')}</div>
        <div className="text-sm font-semibold text-foreground">{formatMoney2(totalAllowedWasteValue ?? '0.00', true)}</div>
      </div>
      <div>
        <div className="text-muted-foreground font-sans">{t('warehouse.unrecognizedShortageValue')}</div>
        <div className="text-sm font-bold text-destructive">
          {formatMoney2(totalUnrecognizedShortageValue ?? totalShortageRetailValue, true)}
        </div>
      </div>
      <div>
        <div className="text-muted-foreground font-sans">{t('warehouse.unrecognizedShortageVat')}</div>
        <div className="text-sm font-bold text-destructive">
          {formatMoney2(totalUnrecognizedShortageVat ?? '0.00', true)}
        </div>
      </div>
    </div>
  );
}
