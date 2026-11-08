import { Printer, ArrowLeft } from 'lucide-react';
import { t } from '../../i18n';
import { formatMoney2, formatPrice4, formatQty } from '../../lib/money';
import { formatDateBs } from '../../lib/utils';
import type { CalculationDocument, Company, Item, Partner, StoreLocation } from '../../types/domain';
import { Button } from '../../components/ui/Button';

interface CalculationPrintViewProps {
  doc: CalculationDocument;
  company: Company;
  storeLocation: StoreLocation;
  partner?: Partner;
  items: Item[];
  isWholesale?: boolean;
  onBack: () => void;
}

export function CalculationPrintView({
  doc,
  company,
  storeLocation,
  partner,
  items,
  isWholesale = false,
  onBack,
}: CalculationPrintViewProps) {
  const handlePrint = () => {
    window.print();
  };

  const title = isWholesale
    ? `${t('warehouse.printA4WholesaleCalc').toUpperCase()} — ${doc.docNumber}`
    : `${t('warehouse.printA4RetailCalc').toUpperCase()} — ${doc.docNumber}`;

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between rounded-lg border border-border bg-card p-3 shadow-xs">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          <span>{t('warehouse.backToEdit')}</span>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            <span>{t('common.print')}</span>
          </Button>
        </div>
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
            <div className="text-right">
              <div className="inline-block rounded border border-foreground px-3 py-1.5 text-center">
                <span className="block text-[10px] uppercase font-bold text-muted-foreground">{t('common.status')}</span>
                <span className="font-mono text-sm font-black">{doc.docNumber}</span>
              </div>
              <p className="mt-1 text-muted-foreground">{t('warehouse.docDate')}: <strong className="text-foreground">{formatDateBs(doc.docDate)}</strong></p>
            </div>
          </div>
          <div className="mt-3 text-center">
            <h2 className="text-sm font-black uppercase tracking-wider underline">{title}</h2>
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
              <th className="border border-foreground p-1 w-10 text-right">{t('warehouse.marginPercent')}</th>
              <th className="border border-foreground p-1 w-14 text-right">{t('warehouse.marginAmount')}</th>
              <th className="border border-foreground p-1 w-14 text-right">{t('warehouse.sellingPriceExclVat')}</th>
              <th className="border border-foreground p-1 w-8 text-center">{t('common.vat')}</th>
              {!isWholesale && <th className="border border-foreground p-1 w-14 text-right font-bold">{t('warehouse.retailPriceWithVat')}</th>}
              {!isWholesale && <th className="border border-foreground p-1 w-16 text-right font-bold">{t('warehouse.retailValueWithVat')}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground font-mono">
            {doc.lines.map((l, idx) => {
              const item = items.find((i) => i.id === l.itemId);
              return (
                <tr key={l.id}>
                  <td className="border border-foreground p-1 text-center font-sans">{idx + 1}</td>
                  <td className="border border-foreground p-1 font-sans">
                    <span className="font-semibold">{item?.name}</span> ({item?.sku})
                  </td>
                  <td className="border border-foreground p-1 text-center font-sans">{item?.uom ?? 'KOM'}</td>
                  <td className="border border-foreground p-1 text-right">{formatQty(l.quantity, 2)}</td>
                  <td className="border border-foreground p-1 text-right">{formatPrice4(l.supplierUnitPrice)}</td>
                  <td className="border border-foreground p-1 text-right">{l.discountPercent}%</td>
                  <td className="border border-foreground p-1 text-right">{formatPrice4(l.dependentCostPerUnit)}</td>
                  <td className="border border-foreground p-1 text-right font-semibold">{formatPrice4(l.purchaseUnitPrice)}</td>
                  <td className="border border-foreground p-1 text-right">{formatMoney2(l.purchaseTotalValue, true)}</td>
                  <td className="border border-foreground p-1 text-right">{l.marginPercent}%</td>
                  <td className="border border-foreground p-1 text-right">{formatMoney2(l.marginTotalAmount, true)}</td>
                  <td className="border border-foreground p-1 text-right">{formatMoney2(l.sellingTotalValueExclVat, true)}</td>
                  <td className="border border-foreground p-1 text-center">{l.vatRatePercent}%</td>
                  {!isWholesale && <td className="border border-foreground p-1 text-right font-bold">{formatMoney2(l.retailUnitPriceWithVat, true)}</td>}
                  {!isWholesale && <td className="border border-foreground p-1 text-right font-bold">{formatMoney2(l.retailTotalValueWithVat, true)}</td>}
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
              <td className="border border-foreground p-1"></td>
              <td className="border border-foreground p-1">{formatMoney2(doc.totalMarginAmount, true)}</td>
              <td className="border border-foreground p-1">{formatMoney2(doc.totalSellingValueExclVat, true)}</td>
              <td className="border border-foreground p-1"></td>
              {!isWholesale && <td className="border border-foreground p-1"></td>}
              {!isWholesale && <td className="border border-foreground p-1">{formatMoney2(doc.totalRetailValueWithVat, true)}</td>}
            </tr>
          </tfoot>
        </table>

        <div className="my-6 grid grid-cols-2 gap-4 text-xs">
          <div className="rounded border border-border p-3">
            <h4 className="border-b border-border pb-1 font-bold">{t('warehouse.recapCostsAndPurchase')}</h4>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between font-mono"><span>{t('warehouse.totalPurchaseVal')}:</span><strong>{formatMoney2(doc.totalPurchaseValue, true)}</strong></div>
            </div>
          </div>
          <div className="rounded border border-border p-3">
            <h4 className="border-b border-border pb-1 font-bold">{t('warehouse.recapSalesAndTax')}</h4>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between font-mono"><span>{t('warehouse.totalMargin')}:</span><span>{formatMoney2(doc.totalMarginAmount, true)}</span></div>
              <div className="flex justify-between font-mono"><span>{t('warehouse.sellingValueExclVat')}:</span><span>{formatMoney2(doc.totalSellingValueExclVat, true)}</span></div>
              <div className="flex justify-between font-mono"><span>{t('warehouse.embeddedVat')}:</span><span>{formatMoney2(doc.totalEmbeddedVatAmount, true)}</span></div>
              <div className="flex justify-between font-mono font-bold text-sm border-t border-border pt-1">
                <span>{t('warehouse.retailValueWithVat')}:</span><span>{formatMoney2(doc.totalRetailValueWithVat, true)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-3 gap-6 pt-4 text-center text-xs">
          <div><div className="border-b border-foreground h-8 mb-1"></div><p className="font-semibold">{t('warehouse.receivedBy')}</p></div>
          <div><div className="border-b border-foreground h-8 mb-1"></div><p className="font-semibold">{t('warehouse.commissionSignatures')}</p></div>
          <div><div className="border-b border-foreground h-8 mb-1"></div><p className="font-semibold">{t('warehouse.approvedBy')}</p></div>
        </div>
      </div>
    </div>
  );
}
