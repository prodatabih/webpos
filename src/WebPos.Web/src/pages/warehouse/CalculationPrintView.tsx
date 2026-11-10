import { Printer, ArrowLeft } from 'lucide-react';
import Decimal from 'decimal.js';
import { t } from '../../i18n';
import { d, formatMoney2, formatPrice4, formatQty, round2 } from '../../lib/money';
import { formatDateBs } from '../../lib/utils';
import type { CalculationDocument, Company, Item, Partner, StoreLocation } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { CalculationPrintRecap } from './CalculationPrintRecap';

interface CalculationPrintViewProps {
  doc: CalculationDocument;
  company: Company;
  storeLocation: StoreLocation;
  partner?: Partner;
  items: Item[];
  onBack: () => void;
}

export function CalculationPrintView({
  doc,
  company,
  storeLocation,
  partner,
  items,
  onBack,
}: CalculationPrintViewProps) {
  const isWholesale = storeLocation.storeType === 'WHOLESALE';
  const isRaw = storeLocation.storeType === 'RAW_MATERIAL' || storeLocation.storeType === 'PRODUCTION';

  const docTitle = isRaw
    ? t('warehouse.calcTitleRawMaterial')
    : isWholesale
    ? t('warehouse.calcTitleWholesale')
    : t('warehouse.calcTitleRetail');

  const grossInv = round2(
    doc.lines.reduce((a, l) => a.plus(d(l.supplierUnitPrice).mul(d(l.quantity))), new Decimal(0))
  );
  const totalDisc = round2(
    doc.lines.reduce(
      (a, l) => a.plus(d(l.supplierUnitPrice).minus(d(l.netSupplierUnitPrice)).mul(d(l.quantity))),
      new Decimal(0)
    )
  );
  const totalZtr = round2(
    d(doc.ztrFreight ?? '0').plus(d(doc.ztrCustoms ?? '0')).plus(d(doc.ztrHandling ?? '0')).plus(d(doc.ztrOther ?? '0'))
  );

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between rounded-lg border border-border bg-card p-3 shadow-xs">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          <span>{t('warehouse.backToEdit')}</span>
        </Button>
        <Button variant="primary" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          <span>{t('common.print')}</span>
        </Button>
      </div>

      <div className="mx-auto max-w-[1100px] rounded-lg border border-border bg-card p-8 text-foreground shadow-sm">
        <div className="border-b-2 border-foreground pb-4">
          <div className="flex justify-between items-start text-xs">
            <div>
              <h1 className="text-base font-black uppercase tracking-tight">{company.name}</h1>
              <p className="text-muted-foreground">{company.address}, {company.city}</p>
              <p className="text-muted-foreground">JIB: {company.taxIdNumber} | PDV: {company.vatIdNumber}</p>
              <p className="mt-1 font-semibold text-foreground">
                {t('app.storeLocation')}: {storeLocation.name} ({storeLocation.code})
              </p>
            </div>
            <div className="text-right text-xs">
              <p className="text-muted-foreground">
                {t('warehouse.docDate')}: <strong className="text-foreground font-mono">{formatDateBs(doc.docDate)}</strong>
              </p>
              {doc.postingDate && (
                <p className="mt-0.5 text-muted-foreground">
                  {t('warehouse.postingDate')}: <strong className="text-foreground font-mono">{formatDateBs(doc.postingDate)}</strong>
                </p>
              )}
            </div>
          </div>
          <div className="mt-3 text-center">
            <h2 className="text-sm font-black uppercase tracking-wider underline">
              {docTitle} — {doc.docNumber}
            </h2>
          </div>
        </div>

        <div className="my-4 grid grid-cols-2 gap-4 rounded-lg border border-border bg-muted/30 p-3 text-xs">
          <div>
            <p><strong>{t('warehouse.supplier')}:</strong> {partner?.name ?? '-'}</p>
            <p><strong>{t('master.taxIdNumber')}:</strong> {partner?.taxIdNumber ?? '-'}</p>
            <p><strong>{t('master.city')}:</strong> {partner?.city ?? '-'}</p>
          </div>
          <div>
            <p><strong>{t('warehouse.supplierInvoiceNumber')}:</strong> {doc.supplierInvoiceNumber || '-'}</p>
            <p><strong>{t('warehouse.supplierInvoiceDate')}:</strong> {formatDateBs(doc.supplierInvoiceDate)}</p>
            <p><strong>{t('warehouse.receiptDate')}:</strong> {formatDateBs(doc.receiptDate || doc.docDate)}</p>
          </div>
        </div>

        <table className="w-full border-collapse border border-foreground text-[10px]">
          <thead className="bg-muted/60 font-bold uppercase text-center">
            <tr>
              <th className="border border-foreground p-1 w-6">#</th>
              <th className="border border-foreground p-1">{t('common.name')}</th>
              <th className="border border-foreground p-1 w-8">{t('common.uom')}</th>
              <th className="border border-foreground p-1 w-12 text-right">{t('common.quantity')}</th>
              <th className="border border-foreground p-1 w-14 text-right">{t('warehouse.supplierUnitPrice')}</th>
              <th className="border border-foreground p-1 w-10 text-right">{t('warehouse.discountPercent')}</th>
              <th className="border border-foreground p-1 w-12 text-right">{t('warehouse.dependentCost')}</th>
              <th className="border border-foreground p-1 w-14 text-right">{t('warehouse.purchaseUnitPrice')}</th>
              <th className="border border-foreground p-1 w-16 text-right">{t('warehouse.purchaseValue')}</th>
              {!isRaw && (
                <>
                  <th className="border border-foreground p-1 w-10 text-right">{t('warehouse.marginPercent')}</th>
                  <th className="border border-foreground p-1 w-14 text-right">{t('warehouse.marginAmount')}</th>
                  {isWholesale ? (
                    <>
                      <th className="border border-foreground p-1 w-14 text-right">{t('warehouse.wholesaleUnitPrice')}</th>
                      <th className="border border-foreground p-1 w-16 text-right font-bold">{t('warehouse.wholesaleTotalValue')}</th>
                    </>
                  ) : (
                    <>
                      <th className="border border-foreground p-1 w-14 text-right">{t('warehouse.sellingPriceExclVat')}</th>
                      <th className="border border-foreground p-1 w-8 text-center">{t('common.vat')}</th>
                      <th className="border border-foreground p-1 w-14 text-right font-bold">{t('warehouse.retailPriceWithVat')}</th>
                      <th className="border border-foreground p-1 w-16 text-right font-bold">{t('warehouse.retailValueWithVat')}</th>
                    </>
                  )}
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground font-mono">
            {doc.lines.map((l, idx) => {
              const item = items.find((i) => i.id === l.itemId);
              return (
                <tr key={l.id}>
                  <td className="border border-foreground p-1 text-center font-sans">{idx + 1}</td>
                  <td className="border border-foreground p-1 font-sans">
                    <span className="font-semibold">{item?.name ?? l.itemId}</span> {item?.sku ? `(${item.sku})` : ''}
                  </td>
                  <td className="border border-foreground p-1 text-center font-sans">{item?.uom ?? 'KOM'}</td>
                  <td className="border border-foreground p-1 text-right">{formatQty(l.quantity, 2)}</td>
                  <td className="border border-foreground p-1 text-right">{formatPrice4(l.supplierUnitPrice)}</td>
                  <td className="border border-foreground p-1 text-right">{l.discountPercent}%</td>
                  <td className="border border-foreground p-1 text-right">{formatPrice4(l.dependentCostPerUnit)}</td>
                  <td className="border border-foreground p-1 text-right font-semibold">{formatPrice4(l.purchaseUnitPrice)}</td>
                  <td className="border border-foreground p-1 text-right">{formatMoney2(l.purchaseTotalValue, true)}</td>
                  {!isRaw && (
                    <>
                      <td className="border border-foreground p-1 text-right">{l.marginPercent}%</td>
                      <td className="border border-foreground p-1 text-right">{formatMoney2(l.marginTotalAmount, true)}</td>
                      {isWholesale ? (
                        <>
                          <td className="border border-foreground p-1 text-right">{formatPrice4(l.sellingUnitPriceExclVat)}</td>
                          <td className="border border-foreground p-1 text-right font-bold">{formatMoney2(l.sellingTotalValueExclVat, true)}</td>
                        </>
                      ) : (
                        <>
                          <td className="border border-foreground p-1 text-right">{formatMoney2(l.sellingTotalValueExclVat, true)}</td>
                          <td className="border border-foreground p-1 text-center">{l.vatRatePercent}%</td>
                          <td className="border border-foreground p-1 text-right font-bold">{formatMoney2(l.retailUnitPriceWithVat, true)}</td>
                          <td className="border border-foreground p-1 text-right font-bold">{formatMoney2(l.retailTotalValueWithVat, true)}</td>
                        </>
                      )}
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-foreground bg-muted/40 font-mono font-bold text-right">
            <tr>
              <td colSpan={3} className="border border-foreground p-1 text-center font-sans">{t('common.total').toUpperCase()}</td>
              <td className="border border-foreground p-1">{formatQty(doc.lines.reduce((a, b) => a + Number(b.quantity), 0), 2)}</td>
              <td colSpan={4} className="border border-foreground p-1"></td>
              <td className="border border-foreground p-1">{formatMoney2(doc.totalPurchaseValue, true)}</td>
              {!isRaw && (
                <>
                  <td className="border border-foreground p-1"></td>
                  <td className="border border-foreground p-1">{formatMoney2(doc.totalMarginAmount, true)}</td>
                  {isWholesale ? (
                    <>
                      <td className="border border-foreground p-1"></td>
                      <td className="border border-foreground p-1">{formatMoney2(doc.totalSellingValueExclVat, true)}</td>
                    </>
                  ) : (
                    <>
                      <td className="border border-foreground p-1">{formatMoney2(doc.totalSellingValueExclVat, true)}</td>
                      <td className="border border-foreground p-1"></td>
                      <td className="border border-foreground p-1"></td>
                      <td className="border border-foreground p-1">{formatMoney2(doc.totalRetailValueWithVat, true)}</td>
                    </>
                  )}
                </>
              )}
            </tr>
          </tfoot>
        </table>

        <CalculationPrintRecap
          doc={doc}
          grossInv={grossInv}
          totalDisc={totalDisc}
          totalZtr={totalZtr}
          isRaw={isRaw}
          isWholesale={isWholesale}
        />
      </div>
    </div>
  );
}
