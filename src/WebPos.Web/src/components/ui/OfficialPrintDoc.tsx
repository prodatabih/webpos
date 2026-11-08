import { Printer, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { t } from '../../i18n';
import { Button } from './Button';

export interface OfficialPrintDocCompany {
  name: string;
  address?: string;
  city?: string;
  taxIdNumber: string;
  vatIdNumber: string;
  bankAccount?: string;
  phone?: string;
  email?: string;
}

export interface OfficialPrintDocHeader {
  title: string;
  docNumber: string;
  docDate: string;
  postingDate?: string;
  statusText?: string;
}

export interface OfficialPrintDocPartner {
  name: string;
  address?: string;
  city?: string;
  taxIdNumber?: string;
  vatIdNumber?: string;
}

export interface OfficialPrintDocItem {
  ordinal: number;
  code: string;
  name: string;
  uom: string;
  quantity: string | number;
  unitPrice?: string | number;
  discountPercent?: string | number;
  baseAmount?: string | number;
  vatRatePercent?: string | number;
  vatAmount?: string | number;
  totalAmount: string | number;
}

export interface OfficialPrintDocTaxRecap {
  vatRatePercent: string | number;
  turnoverAmount: string | number;
  vatAmount: string | number;
  totalAmount: string | number;
}

export interface OfficialPrintDocProps {
  company: OfficialPrintDocCompany;
  header: OfficialPrintDocHeader;
  partner?: OfficialPrintDocPartner;
  warehouseName?: string;
  items: OfficialPrintDocItem[];
  taxRecap?: OfficialPrintDocTaxRecap[];
  totalAmount: string | number;
  notes?: string;
  commissionMembers?: string[];
  liquidatorName?: string;
  onClose?: () => void;
  className?: string;
}

export function OfficialPrintDoc({
  company,
  header,
  partner,
  warehouseName,
  items,
  taxRecap,
  totalAmount,
  notes,
  commissionMembers = ['1. ___________________', '2. ___________________', '3. ___________________'],
  liquidatorName,
  onClose,
  className,
}: OfficialPrintDocProps) {
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className={cn('flex flex-col gap-4 w-full', className)}>
      <div className="flex items-center justify-between border border-border bg-card p-3 rounded-lg print:hidden">
        <div className="text-xs font-semibold text-foreground">
          {t('printDoc.previewTitle')} — {header.title} ({header.docNumber})
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={handlePrint} className="gap-1.5 cursor-pointer">
            <Printer className="h-3.5 w-3.5" />
            <span>{t('printDoc.printAction')}</span>
          </Button>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose} className="gap-1 cursor-pointer">
              <X className="h-3.5 w-3.5" />
              <span>{t('printDoc.closePreview')}</span>
            </Button>
          )}
        </div>
      </div>

      <div className="w-full max-w-4xl mx-auto bg-card text-card-foreground border border-border p-8 rounded-lg shadow-2xs print:border-none print:shadow-none print:p-0 print:max-w-none print:w-full print:m-0 text-xs">
        <header className="flex justify-between items-start gap-6 pb-4 border-b border-border">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-sm font-bold text-foreground">{company.name}</h1>
            {(company.address || company.city) && (
              <span className="text-muted-foreground">{[company.address, company.city].filter(Boolean).join(', ')}</span>
            )}
            <div className="flex items-center gap-3 mt-1 font-medium text-foreground">
              <span>{t('printDoc.memoJib')}: {company.taxIdNumber}</span>
              <span>{t('printDoc.memoPdv')}: {company.vatIdNumber}</span>
            </div>
            {company.bankAccount && (
              <span className="text-muted-foreground">{t('printDoc.memoAccount')}: {company.bankAccount}</span>
            )}
          </div>

          <div className="text-right flex flex-col gap-1">
            <h2 className="text-base font-extrabold tracking-wide uppercase text-primary">{header.title}</h2>
            <div className="text-sm font-bold text-foreground">{header.docNumber}</div>
            <div className="text-muted-foreground">{t('printDoc.docDate')}: {header.docDate}</div>
            {header.postingDate && (
              <div className="text-muted-foreground">{t('printDoc.postingDate')}: {header.postingDate}</div>
            )}
            {header.statusText && (
              <div className="font-semibold text-foreground uppercase text-[10px]">{header.statusText}</div>
            )}
          </div>
        </header>

        <section className="grid grid-cols-2 gap-4 py-4 border-b border-border">
          <div>
            <div className="font-bold text-muted-foreground uppercase text-[10px] mb-1">{t('printDoc.partner')}</div>
            {partner ? (
              <div className="space-y-0.5 text-foreground">
                <div className="font-semibold">{partner.name}</div>
                {(partner.address || partner.city) && (
                  <div className="text-muted-foreground">{[partner.address, partner.city].filter(Boolean).join(', ')}</div>
                )}
                <div className="text-[11px] text-muted-foreground">
                  {partner.taxIdNumber && <span>{t('printDoc.memoJib')}: {partner.taxIdNumber} </span>}
                  {partner.vatIdNumber && <span>{t('printDoc.memoPdv')}: {partner.vatIdNumber}</span>}
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>

          <div className="text-right">
            <div className="font-bold text-muted-foreground uppercase text-[10px] mb-1">{t('printDoc.warehouse')}</div>
            <div className="font-semibold text-foreground">{warehouseName ?? '—'}</div>
          </div>
        </section>

        <section className="my-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-y border-border bg-muted/40 font-semibold text-muted-foreground">
                <th className="py-1.5 px-2 text-center w-10">{t('printDoc.ordinal')}</th>
                <th className="py-1.5 px-2 w-20">{t('printDoc.code')}</th>
                <th className="py-1.5 px-2">{t('printDoc.name')}</th>
                <th className="py-1.5 px-2 text-center w-12">{t('printDoc.uom')}</th>
                <th className="py-1.5 px-2 text-right w-16">{t('printDoc.quantity')}</th>
                <th className="py-1.5 px-2 text-right w-20">{t('printDoc.price')}</th>
                <th className="py-1.5 px-2 text-right w-14">{t('printDoc.discount')}</th>
                <th className="py-1.5 px-2 text-right w-20">{t('printDoc.baseAmount')}</th>
                <th className="py-1.5 px-2 text-center w-14">{t('printDoc.vatRate')}</th>
                <th className="py-1.5 px-2 text-right w-20">{t('printDoc.vatAmount')}</th>
                <th className="py-1.5 px-2 text-right w-24">{t('printDoc.totalAmount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {items.map((it) => (
                <tr key={`${it.ordinal}-${it.code}`} className="text-foreground">
                  <td className="py-1.5 px-2 text-center text-muted-foreground">{it.ordinal}</td>
                  <td className="py-1.5 px-2 font-mono text-[11px]">{it.code}</td>
                  <td className="py-1.5 px-2 font-medium">{it.name}</td>
                  <td className="py-1.5 px-2 text-center">{it.uom}</td>
                  <td className="py-1.5 px-2 text-right font-mono">{it.quantity}</td>
                  <td className="py-1.5 px-2 text-right font-mono">{it.unitPrice ?? '—'}</td>
                  <td className="py-1.5 px-2 text-right font-mono">{it.discountPercent ?? '0.00'}</td>
                  <td className="py-1.5 px-2 text-right font-mono">{it.baseAmount ?? '—'}</td>
                  <td className="py-1.5 px-2 text-center font-mono">{it.vatRatePercent ?? '17.00'}%</td>
                  <td className="py-1.5 px-2 text-right font-mono">{it.vatAmount ?? '—'}</td>
                  <td className="py-1.5 px-2 text-right font-mono font-bold">{it.totalAmount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6 pt-2 border-t border-border">
          <div>
            {taxRecap && taxRecap.length > 0 && (
              <div className="space-y-1.5">
                <div className="font-bold text-muted-foreground uppercase text-[10px]">{t('printDoc.taxRecap')}</div>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/20 text-muted-foreground font-semibold">
                      <th className="py-1 px-1.5 text-left">{t('printDoc.rate')}</th>
                      <th className="py-1 px-1.5 text-right">{t('printDoc.turnover')}</th>
                      <th className="py-1 px-1.5 text-right">{t('printDoc.vatAmount')}</th>
                      <th className="py-1 px-1.5 text-right">{t('printDoc.totalAmount')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {taxRecap.map((tr) => (
                      <tr key={String(tr.vatRatePercent)} className="text-foreground">
                        <td className="py-1 px-1.5">{tr.vatRatePercent}%</td>
                        <td className="py-1 px-1.5 text-right font-mono">{tr.turnoverAmount}</td>
                        <td className="py-1 px-1.5 text-right font-mono">{tr.vatAmount}</td>
                        <td className="py-1 px-1.5 text-right font-mono font-semibold">{tr.totalAmount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {notes && (
              <div className="mt-3 text-muted-foreground text-[11px]">
                <span className="font-semibold text-foreground">{t('printDoc.notes')}:</span> {notes}
              </div>
            )}
          </div>

          <div className="flex flex-col justify-end items-end gap-2 text-right">
            <div className="text-xs font-semibold text-muted-foreground uppercase">{t('printDoc.docTotal')}</div>
            <div className="text-xl font-black text-foreground">
              {totalAmount} <span className="text-sm font-semibold">{t('common.currencyKm')}</span>
            </div>
          </div>
        </section>

        <footer className="mt-12 pt-6 border-t border-border grid grid-cols-2 gap-8 text-xs break-inside-avoid">
          <div className="space-y-3">
            <div className="font-bold uppercase text-muted-foreground text-[10px]">{t('printDoc.commission')}</div>
            <div className="space-y-2">
              {commissionMembers.map((member, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <span className="text-foreground">{member}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-end text-right space-y-3">
            <div className="font-bold uppercase text-muted-foreground text-[10px]">{t('printDoc.liquidator')}</div>
            <div className="mt-6 border-b border-border w-48 text-center text-foreground font-medium pb-1">
              {liquidatorName ?? ''}
            </div>
            <div className="text-[10px] text-muted-foreground">{t('printDoc.signature')} / {t('printDoc.signatureDate')}</div>
          </div>
        </footer>
      </div>
    </div>
  );
}
