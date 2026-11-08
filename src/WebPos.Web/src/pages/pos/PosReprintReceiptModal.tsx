import { Printer } from 'lucide-react';
import { t } from '../../i18n';
import { formatMoney2, formatQty } from '../../lib/money';
import { formatDateTimeBs } from '../../lib/utils';
import type { Company, Item, PosReceipt, StoreLocation } from '../../types/domain';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';

export interface PosReprintReceiptModalProps {
  open: boolean;
  onClose: () => void;
  receipt: PosReceipt;
  company: Company;
  store: StoreLocation;
  items: Item[];
}

export function PosReprintReceiptModal({
  open,
  onClose,
  receipt,
  company,
  store,
  items,
}: PosReprintReceiptModalProps) {
  const handlePrint = () => {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title={`${t('pos.reprintReceipt')} — ${receipt.receiptNumber}`}
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
      <div className="mx-auto max-w-sm rounded border border-border bg-card p-4 font-mono text-xs text-foreground print:border-none print:p-0">
        <div className="border-b border-dashed border-border pb-3 text-center">
          <p className="font-bold text-sm uppercase">{company.name}</p>
          <p>{company.address}, {company.city}</p>
          <p>JIB: {company.taxIdNumber} • PIB: {company.vatIdNumber}</p>
          <p className="mt-1 font-semibold">{store.code} — {store.name}</p>
          <p className="text-[10px] text-destructive uppercase tracking-widest mt-1">*** DUPLIKAT RAČUNA ***</p>
        </div>

        <div className="border-b border-dashed border-border py-2 text-[11px] space-y-0.5">
          <div className="flex justify-between">
            <span>RAČUN BR:</span>
            <span className="font-bold">{receipt.receiptNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>FISKALNI BR (BF):</span>
            <span className="font-bold">{receipt.fiscalNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>VRIJEME:</span>
            <span>{formatDateTimeBs(receipt.issuedAt)}</span>
          </div>
          <div className="flex justify-between">
            <span>KASIR:</span>
            <span>{receipt.cashierName}</span>
          </div>
          <div className="flex justify-between">
            <span>VRSTA:</span>
            <span>{receipt.receiptType === 'REFUND' ? 'REKLAMIRANI RAČUN' : 'PRODAJA'}</span>
          </div>
        </div>

        <div className="border-b border-dashed border-border py-2 space-y-1.5">
          {receipt.lines.map((l) => {
            const it = items.find((x) => x.id === l.itemId);
            return (
              <div key={l.id} className="text-xs">
                <div className="font-semibold">{it?.name ?? l.itemId}</div>
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>{formatQty(l.quantity, 2)} x {formatMoney2(l.retailUnitPriceWithVat, true)}</span>
                  <span className="font-bold text-foreground font-mono">{formatMoney2(l.lineTotalWithVat, true)}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-b border-dashed border-border py-2 space-y-1">
          <div className="flex justify-between">
            <span>OSNOVICA (E 17%):</span>
            <span className="font-mono">{formatMoney2(receipt.totalNetExclVat, true)}</span>
          </div>
          <div className="flex justify-between">
            <span>PDV (17%):</span>
            <span className="font-mono">{formatMoney2(receipt.totalVatAmount, true)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold border-t border-border pt-1">
            <span>UKUPNO ZA UPLATU:</span>
            <span className="font-mono">{formatMoney2(receipt.totalGrossAmount, true)}</span>
          </div>
          <div className="flex justify-between text-[11px] pt-1">
            <span>NAČIN PLAĆANJA ({receipt.paymentMethod}):</span>
            <span className="font-mono">{formatMoney2(receipt.totalGrossAmount, true)}</span>
          </div>
        </div>

        <div className="pt-3 text-center text-[10px] text-muted-foreground">
          <p>HVALA NA POSJETI!</p>
          <p className="mt-1 font-mono">IBFM: FP-2026-0042</p>
        </div>
      </div>
    </Dialog>
  );
}
