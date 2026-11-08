import { Printer } from 'lucide-react';
import { t } from '../../i18n';
import { formatMoney2, formatPrice4, formatQty } from '../../lib/money';
import { formatDateBs, formatDateTimeBs } from '../../lib/utils';
import { amountToWordsBs } from '../../lib/numberToWordsBs';
import type { Company, Item, Partner, PosReceipt } from '../../types/domain';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';

export interface PosTaxInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  receipt: PosReceipt;
  company: Company;
  partner?: Partner;
  items: Item[];
}

export function PosTaxInvoiceModal({
  open,
  onClose,
  receipt,
  company,
  partner,
  items,
}: PosTaxInvoiceModalProps) {
  const invoiceNumber = `FAK-${receipt.receiptNumber}`;
  const issueDate = receipt.issuedAt.slice(0, 10);
  const wordsAmount = amountToWordsBs(receipt.totalGrossAmount);

  const handlePrint = () => {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      title={`${t('pos.taxInvoiceTitle')} — ${invoiceNumber}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.close')}
          </Button>
          <Button variant="primary" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            <span>{t('common.print')}</span>
          </Button>
        </>
      }
    >
      <div className="space-y-6 text-foreground print:text-black">
        <div className="border-b border-border pb-4 flex justify-between items-start">
          <div>
            <h2 className="text-base font-bold uppercase tracking-tight">{company.name}</h2>
            <p className="text-xs text-muted-foreground">{company.address}, {company.city}</p>
            <div className="flex gap-4 mt-1 text-xs font-mono">
              <span>{t('master.taxIdNumber')}: {company.taxIdNumber}</span>
              <span>{t('master.vatIdNumber')}: {company.vatIdNumber}</span>
            </div>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">
              {t('printDoc.memoAccount')}: {company.bankAccount}
            </p>
          </div>
          <div className="text-right">
            <h3 className="text-sm font-bold uppercase">{t('pos.b2bTaxInvoice')}</h3>
            <p className="text-sm font-mono font-bold mt-1 text-primary">{invoiceNumber}</p>
            <p className="text-xs text-muted-foreground font-mono">
              {t('pos.fiscalReceiptRef')}: {receipt.fiscalNumber}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 rounded-lg border border-border bg-muted/20">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {t('pos.buyerDetails')}
            </span>
            {partner ? (
              <div className="mt-1 text-xs space-y-0.5">
                <p className="font-bold text-foreground">{partner.name}</p>
                <p className="text-muted-foreground">{partner.address}, {partner.city}</p>
                <div className="flex gap-3 font-mono">
                  <span>{t('master.taxIdNumber')}: {partner.taxIdNumber}</span>
                  <span>{t('master.vatIdNumber')}: {partner.vatIdNumber}</span>
                </div>
              </div>
            ) : (
              <div className="mt-1 text-xs text-muted-foreground italic">
                Krajnji kupac — Maloprodajni račun
              </div>
            )}
          </div>
          <div className="sm:text-right text-xs space-y-1">
            <div>
              <span className="text-muted-foreground">{t('pos.invoiceDate')}: </span>
              <span className="font-mono font-medium">{formatDateBs(issueDate)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('pos.deliveryDate')}: </span>
              <span className="font-mono font-medium">{formatDateTimeBs(receipt.issuedAt)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('pos.paymentMethod')}: </span>
              <span className="font-semibold">{receipt.paymentMethod}</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-border">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="p-2 font-semibold w-10 text-center">{t('printDoc.ordinal')}</th>
                <th className="p-2 font-semibold w-24">{t('master.sku')}</th>
                <th className="p-2 font-semibold">{t('common.name')}</th>
                <th className="p-2 font-semibold w-12">{t('common.uom')}</th>
                <th className="p-2 font-semibold text-right w-16">{t('common.quantity')}</th>
                <th className="p-2 font-semibold text-right w-24">{t('warehouse.sellingPriceExclVat')}</th>
                <th className="p-2 font-semibold text-right w-14">{t('pos.discountPercent')}</th>
                <th className="p-2 font-semibold text-right w-24">{t('pos.baseExclVat')}</th>
                <th className="p-2 font-semibold text-right w-14">{t('common.vat')}</th>
                <th className="p-2 font-semibold text-right w-24">{t('pos.vatAmount')}</th>
                <th className="p-2 font-semibold text-right w-24">{t('common.total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {receipt.lines.map((line, idx) => {
                const it = items.find((x) => x.id === line.itemId);
                const unitExcl = Number(line.quantity) > 0 ? (Number(line.lineNetExclVat) / Number(line.quantity)).toFixed(4) : '0.0000';
                return (
                  <tr key={line.id}>
                    <td className="p-2 text-center font-mono text-muted-foreground">{idx + 1}.</td>
                    <td className="p-2 font-mono font-medium">{it?.sku ?? '-'}</td>
                    <td className="p-2 font-medium">{it?.name ?? line.scannedBarcode}</td>
                    <td className="p-2">{it?.uom ?? 'kom'}</td>
                    <td className="p-2 text-right font-mono">{formatQty(line.quantity, 2)}</td>
                    <td className="p-2 text-right font-mono">{formatPrice4(unitExcl, true)}</td>
                    <td className="p-2 text-right font-mono">{line.discountPercent}%</td>
                    <td className="p-2 text-right font-mono">{formatMoney2(line.lineNetExclVat, true)}</td>
                    <td className="p-2 text-right font-mono">{line.vatRatePercent}%</td>
                    <td className="p-2 text-right font-mono">{formatMoney2(line.lineVatAmount, true)}</td>
                    <td className="p-2 text-right font-mono font-semibold">{formatMoney2(line.lineTotalWithVat, true)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/40 font-bold border-t-2 border-border">
              <tr>
                <td colSpan={7} className="p-2 text-right uppercase text-[11px]">{t('common.total')}</td>
                <td className="p-2 text-right font-mono">{formatMoney2(receipt.totalNetExclVat, true)}</td>
                <td className="p-2 text-right font-mono">-</td>
                <td className="p-2 text-right font-mono">{formatMoney2(receipt.totalVatAmount, true)}</td>
                <td className="p-2 text-right font-mono text-primary">{formatMoney2(receipt.totalGrossAmount, true)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-muted-foreground">{t('pos.amountInWords')}:</p>
            <p className="font-medium italic">{wordsAmount}</p>
            <p className="text-[11px] text-muted-foreground pt-2">
              Oslobođeno / Obračunat PDV po stopi od 17% u skladu sa Zakonom o porezu na dodatu vrijednost BiH.
            </p>
          </div>
          <div className="w-full sm:w-64 border border-border p-3 rounded-lg bg-card text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('pos.baseExclVat')}:</span>
              <span className="font-mono font-semibold">{formatMoney2(receipt.totalNetExclVat, true)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('pos.vatAmount')} (17%):</span>
              <span className="font-mono font-semibold">{formatMoney2(receipt.totalVatAmount, true)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5 font-bold text-sm">
              <span>{t('common.total')}:</span>
              <span className="font-mono text-primary">{formatMoney2(receipt.totalGrossAmount, true)}</span>
            </div>
          </div>
        </div>

        <div className="pt-8 grid grid-cols-2 gap-12 text-center text-xs">
          <div className="border-t border-border pt-2">
            <p className="font-semibold">{t('pos.issuedBy')}</p>
            <p className="text-muted-foreground mt-0.5">{receipt.cashierName}</p>
            <p className="text-[11px] text-muted-foreground mt-8">M.P. / Potpis</p>
          </div>
          <div className="border-t border-border pt-2">
            <p className="font-semibold">{t('pos.receivedBy')}</p>
            <p className="text-muted-foreground mt-0.5">{partner?.name ?? 'Kupac'}</p>
            <p className="text-[11px] text-muted-foreground mt-8">Potpis ovlaštenog lica</p>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
