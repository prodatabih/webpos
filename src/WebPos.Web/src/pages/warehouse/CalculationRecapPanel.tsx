import { t } from '../../i18n';
import { formatMoney2, formatQty } from '../../lib/money';

interface CalculationRecapPanelProps {
  itemCount: number;
  totalQuantity: string;
  grossInvoiceValue: string;
  totalDiscount: string;
  totalZtr: string;
  totalPurchaseValue: string;
  totalMarginAmount: string;
  totalVatAmount: string;
  totalRetailValueWithVat: string;
}

export function CalculationRecapPanel({
  itemCount,
  totalQuantity,
  grossInvoiceValue,
  totalDiscount,
  totalZtr,
  totalPurchaseValue,
  totalMarginAmount,
  totalVatAmount,
  totalRetailValueWithVat,
}: CalculationRecapPanelProps) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-3 text-xs sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9">
      <div className="rounded-lg border border-border/80 bg-muted/40 p-2.5">
        <div className="text-[11px] text-muted-foreground">{t('warehouse.itemCount')}</div>
        <div className="mt-1 font-mono text-sm font-bold text-foreground">
          {itemCount}
        </div>
      </div>
      <div className="rounded-lg border border-border/80 bg-muted/40 p-2.5">
        <div className="text-[11px] text-muted-foreground">{t('warehouse.totalQuantity')}</div>
        <div className="mt-1 font-mono text-sm font-bold text-foreground">
          {formatQty(totalQuantity, 2)}
        </div>
      </div>
      <div className="rounded-lg border border-border/80 bg-muted/40 p-2.5">
        <div className="text-[11px] text-muted-foreground">{t('warehouse.invoiceValue')}</div>
        <div className="mt-1 font-mono text-sm font-bold text-foreground">
          {formatMoney2(grossInvoiceValue, true)}
        </div>
      </div>
      <div className="rounded-lg border border-border/80 bg-muted/40 p-2.5">
        <div className="text-[11px] text-muted-foreground">{t('warehouse.totalDiscount')}</div>
        <div className="mt-1 font-mono text-sm font-bold text-destructive">
          -{formatMoney2(totalDiscount, true)}
        </div>
      </div>
      <div className="rounded-lg border border-border/80 bg-muted/40 p-2.5">
        <div className="text-[11px] text-muted-foreground">{t('warehouse.totalZtr')}</div>
        <div className="mt-1 font-mono text-sm font-bold text-warning">
          {formatMoney2(totalZtr, true)}
        </div>
      </div>
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5">
        <div className="text-[11px] font-semibold text-primary">{t('warehouse.totalPurchaseVal')}</div>
        <div className="mt-1 font-mono text-sm font-bold text-foreground">
          {formatMoney2(totalPurchaseValue, true)}
        </div>
      </div>
      <div className="rounded-lg border border-border/80 bg-muted/40 p-2.5">
        <div className="text-[11px] text-muted-foreground">{t('warehouse.totalMargin')}</div>
        <div className="mt-1 font-mono text-sm font-bold text-info">
          {formatMoney2(totalMarginAmount, true)}
        </div>
      </div>
      <div className="rounded-lg border border-border/80 bg-muted/40 p-2.5">
        <div className="text-[11px] text-muted-foreground">{t('warehouse.totalVat')}</div>
        <div className="mt-1 font-mono text-sm font-bold text-foreground">
          {formatMoney2(totalVatAmount, true)}
        </div>
      </div>
      <div className="rounded-lg border border-success/40 bg-success/10 p-2.5 col-span-2 sm:col-span-1">
        <div className="text-[11px] font-bold uppercase text-success">{t('warehouse.totalDebitMpc')}</div>
        <div className="mt-1 font-mono text-base font-extrabold text-foreground">
          {formatMoney2(totalRetailValueWithVat, true)}
        </div>
      </div>
    </div>
  );
}
