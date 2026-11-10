import { t } from '../../i18n';
import { formatMoney2, formatQty } from '../../lib/money';
import type { StoreType } from '../../types/domain';

interface CalculationRecapPanelProps {
  itemCount: number;
  totalQuantity: string;
  grossInvoiceValue: string;
  totalDiscount: string;
  totalZtr: string;
  totalPurchaseValue: string;
  totalMarginAmount?: string;
  totalVatAmount?: string;
  totalRetailValueWithVat?: string;
  totalSellingValueExclVat?: string;
  storeType?: StoreType;
}

export function CalculationRecapPanel({
  itemCount,
  totalQuantity,
  grossInvoiceValue,
  totalDiscount,
  totalZtr,
  totalPurchaseValue,
  totalMarginAmount = '0.00',
  totalVatAmount = '0.00',
  totalRetailValueWithVat = '0.00',
  totalSellingValueExclVat = '0.00',
  storeType = 'RETAIL',
}: CalculationRecapPanelProps) {
  const isRaw = storeType === 'RAW_MATERIAL' || storeType === 'PRODUCTION';
  const isWholesale = storeType === 'WHOLESALE';

  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-3 text-xs sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9">
      <div className="rounded-lg border border-border/80 bg-muted/40 p-2.5">
        <div className="text-[11px] text-muted-foreground">{t('warehouse.itemCount')}</div>
        <div className="mt-1 font-mono text-sm font-bold text-foreground">{itemCount}</div>
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

      {isRaw ? (
        <div className="col-span-2 rounded-lg border border-primary/40 bg-primary/10 p-2.5 sm:col-span-1 md:col-span-2 xl:col-span-4">
          <div className="text-[11px] font-bold uppercase text-primary">{t('warehouse.totalDebitRaw')}</div>
          <div className="mt-1 font-mono text-base font-extrabold text-foreground">
            {formatMoney2(totalPurchaseValue, true)}
          </div>
        </div>
      ) : isWholesale ? (
        <>
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
          <div className="col-span-2 rounded-lg border border-info/40 bg-info/10 p-2.5 sm:col-span-1 md:col-span-2">
            <div className="text-[11px] font-bold uppercase text-info">{t('warehouse.totalDebitVpc')}</div>
            <div className="mt-1 font-mono text-base font-extrabold text-foreground">
              {formatMoney2(totalSellingValueExclVat, true)}
            </div>
          </div>
        </>
      ) : (
        <>
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
          <div className="col-span-2 rounded-lg border border-success/40 bg-success/10 p-2.5 sm:col-span-1">
            <div className="text-[11px] font-bold uppercase text-success">{t('warehouse.totalDebitMpc')}</div>
            <div className="mt-1 font-mono text-base font-extrabold text-foreground">
              {formatMoney2(totalRetailValueWithVat, true)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
