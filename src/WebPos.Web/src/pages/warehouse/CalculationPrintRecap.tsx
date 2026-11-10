import { t } from '../../i18n';
import { formatMoney2 } from '../../lib/money';
import type { CalculationDocument } from '../../types/domain';

interface CalculationPrintRecapProps {
  doc: CalculationDocument;
  grossInv: string;
  totalDisc: string;
  totalZtr: string;
  isRaw: boolean;
  isWholesale: boolean;
}

export function CalculationPrintRecap({
  doc,
  grossInv,
  totalDisc,
  totalZtr,
  isRaw,
  isWholesale,
}: CalculationPrintRecapProps) {
  return (
    <>
      <div className="my-6 grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
        <div className="rounded border border-border p-3">
          <h4 className="border-b border-border pb-1 font-bold">{t('warehouse.recapCostsAndPurchase')}</h4>
          <div className="mt-2 space-y-1 font-mono">
            <div className="flex justify-between"><span>{t('warehouse.invoiceValue')}:</span><span>{formatMoney2(grossInv, true)}</span></div>
            <div className="flex justify-between text-destructive"><span>{t('warehouse.totalDiscount')}:</span><span>-{formatMoney2(totalDisc, true)}</span></div>
            <div className="flex justify-between text-warning"><span>{t('warehouse.totalZtr')}:</span><span>{formatMoney2(totalZtr, true)}</span></div>
            <div className="flex justify-between border-t border-border pt-1 font-bold text-sm">
              <span>{t('warehouse.totalPurchaseVal')}:</span><span>{formatMoney2(doc.totalPurchaseValue, true)}</span>
            </div>
          </div>
        </div>
        <div className="rounded border border-border p-3">
          <h4 className="border-b border-border pb-1 font-bold">
            {isRaw ? t('warehouse.recapDebitRaw') : isWholesale ? t('warehouse.recapDebitVpc') : t('warehouse.recapSalesAndTax')}
          </h4>
          <div className="mt-2 space-y-1 font-mono">
            {isRaw ? (
              <div className="flex justify-between font-bold text-sm pt-2">
                <span>{t('warehouse.totalDebitRaw')}:</span><span>{formatMoney2(doc.totalPurchaseValue, true)}</span>
              </div>
            ) : isWholesale ? (
              <>
                <div className="flex justify-between"><span>{t('warehouse.totalMargin')}:</span><span>{formatMoney2(doc.totalMarginAmount, true)}</span></div>
                <div className="flex justify-between font-bold text-sm border-t border-border pt-1 text-info">
                  <span>{t('warehouse.totalDebitVpc')}:</span><span>{formatMoney2(doc.totalSellingValueExclVat, true)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between"><span>{t('warehouse.totalMargin')}:</span><span>{formatMoney2(doc.totalMarginAmount, true)}</span></div>
                <div className="flex justify-between"><span>{t('warehouse.sellingValueExclVat')}:</span><span>{formatMoney2(doc.totalSellingValueExclVat, true)}</span></div>
                <div className="flex justify-between"><span>{t('warehouse.embeddedVat')}:</span><span>{formatMoney2(doc.totalEmbeddedVatAmount, true)}</span></div>
                <div className="flex justify-between font-bold text-sm border-t border-border pt-1 text-success">
                  <span>{t('warehouse.totalDebitMpc')}:</span><span>{formatMoney2(doc.totalRetailValueWithVat, true)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-3 gap-6 pt-4 text-center text-xs">
        <div><div className="border-b border-foreground h-8 mb-1"></div><p className="font-semibold">{t('warehouse.receivedBy')}</p></div>
        <div><div className="border-b border-foreground h-8 mb-1"></div><p className="font-semibold">{t('warehouse.commissionSignatures')}</p></div>
        <div><div className="border-b border-foreground h-8 mb-1"></div><p className="font-semibold">{t('warehouse.approvedBy')}</p></div>
      </div>
    </>
  );
}
