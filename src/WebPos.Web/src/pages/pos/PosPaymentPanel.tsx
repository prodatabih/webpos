import Decimal from 'decimal.js';
import { Banknote, CreditCard, Landmark, Layers, PauseCircle, Trash2, CheckCircle2 } from 'lucide-react';
import { t } from '../../i18n';
import { d, formatMoney2, round2, type PosReceiptTotalsResult } from '../../lib/money';
import type { Partner, PaymentMethod } from '../../types/domain';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Combobox } from '../../components/ui/Combobox';

interface VatGroupSummary {
  ratePercent: string;
  baseAmount: string;
  vatAmount: string;
}

interface PosPaymentPanelProps {
  partners: Partner[];
  selectedPartnerId: string;
  onSelectPartner: (id: string) => void;
  totals: PosReceiptTotalsResult;
  vatBreakdown: VatGroupSummary[];
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  cashReceived: string;
  onCashReceivedChange: (val: string) => void;
  cardAmount: string;
  onCardAmountChange: (val: string) => void;
  wireAmount: string;
  onWireAmountChange: (val: string) => void;
  hasLines: boolean;
  heldCount: number;
  onHoldReceipt: () => void;
  onOpenHeldDialog: () => void;
  onClearReceipt: () => void;
  onIssueReceipt: () => void;
}

const QUICK_DENOMINATIONS = ['10', '20', '50', '100', '200'];

export function PosPaymentPanel({
  partners,
  selectedPartnerId,
  onSelectPartner,
  totals,
  vatBreakdown,
  paymentMethod,
  onPaymentMethodChange,
  cashReceived,
  onCashReceivedChange,
  cardAmount,
  onCardAmountChange,
  wireAmount,
  onWireAmountChange,
  hasLines,
  heldCount,
  onHoldReceipt,
  onOpenHeldDialog,
  onClearReceipt,
  onIssueReceipt,
}: PosPaymentPanelProps) {
  const buyerOptions = [
    { value: '', label: t('common.selectOption') },
    ...partners
      .filter((p) => p.isActive && (p.partnerType === 'BUYER' || p.partnerType === 'BOTH'))
      .map((p) => ({
        value: p.id,
        code: p.code,
        label: p.name,
        sublabel: `${t('master.taxIdNumber')}: ${p.taxIdNumber}`,
      })),
  ];

  const totalDue = d(totals.totalGrossAmount);
  const cashVal = d(cashReceived);
  const cardVal = paymentMethod === 'COMBINED' ? d(cardAmount) : new Decimal(0);
  const wireVal = paymentMethod === 'COMBINED' ? d(wireAmount) : new Decimal(0);
  const remainingForCash = Decimal.max(new Decimal(0), totalDue.minus(cardVal).minus(wireVal));
  const changeAmount =
    paymentMethod === 'CASH' || paymentMethod === 'COMBINED'
      ? Decimal.max(new Decimal(0), cashVal.minus(remainingForCash))
      : new Decimal(0);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3"><CardTitle>{t('pos.paymentMethod')}</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Combobox label={t('pos.b2bBuyer')} options={buyerOptions} value={selectedPartnerId} onChange={onSelectPartner} />

        <div className="grid grid-cols-2 gap-1.5">
          <Button variant={paymentMethod === 'CASH' ? 'primary' : 'outline'} size="sm" onClick={() => onPaymentMethodChange('CASH')}>
            <Banknote className="h-3.5 w-3.5" /><span>{t('pos.payCash')}</span>
          </Button>
          <Button variant={paymentMethod === 'CARD' ? 'primary' : 'outline'} size="sm" onClick={() => onPaymentMethodChange('CARD')}>
            <CreditCard className="h-3.5 w-3.5" /><span>{t('pos.payCard')}</span>
          </Button>
          <Button variant={paymentMethod === 'WIRE' ? 'primary' : 'outline'} size="sm" onClick={() => onPaymentMethodChange('WIRE')}>
            <Landmark className="h-3.5 w-3.5" /><span>{t('pos.payWire')}</span>
          </Button>
          <Button variant={paymentMethod === 'COMBINED' ? 'primary' : 'outline'} size="sm" onClick={() => onPaymentMethodChange('COMBINED')}>
            <Layers className="h-3.5 w-3.5" /><span>{t('pos.payCombined')}</span>
          </Button>
        </div>

        {(paymentMethod === 'CASH' || paymentMethod === 'COMBINED') && (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
            <Input label={t('pos.cashReceived')} type="number" step="0.01" value={cashReceived} onChange={(e) => onCashReceivedChange(e.target.value)} className="font-mono text-right" />
            <div className="flex items-center gap-1 flex-wrap">
              <Button variant="secondary" size="sm" className="flex-1 font-mono" onClick={() => onCashReceivedChange(round2(remainingForCash))}>
                {formatMoney2(remainingForCash)}
              </Button>
              {QUICK_DENOMINATIONS.map((denom) => (
                <Button key={denom} variant="outline" size="sm" className="font-mono px-2" onClick={() => onCashReceivedChange(round2(denom))}>
                  {denom}
                </Button>
              ))}
            </div>
            {paymentMethod === 'COMBINED' && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Input label={t('pos.payCard')} type="number" step="0.01" value={cardAmount} onChange={(e) => onCardAmountChange(e.target.value)} className="font-mono text-right" />
                <Input label={t('pos.payWire')} type="number" step="0.01" value={wireAmount} onChange={(e) => onWireAmountChange(e.target.value)} className="font-mono text-right" />
              </div>
            )}
            <div className="flex items-center justify-between pt-1 text-xs font-semibold">
              <span className="text-muted-foreground">{t('pos.changeDue')}:</span>
              <span className="font-mono text-sm text-success">{formatMoney2(changeAmount, true)}</span>
            </div>
          </div>
        )}

        <div className="space-y-1.5 rounded-md border border-border bg-muted/20 p-3 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>{t('common.subtotal')}:</span><span className="font-mono">{formatMoney2(totals.subtotalGrossBeforeDiscount, true)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>{t('pos.discountAmount')}:</span><span className="font-mono text-destructive">-{formatMoney2(totals.totalDiscountAmount, true)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>{t('pos.baseExclVat')}:</span><span className="font-mono">{formatMoney2(totals.totalNetExclVat, true)}</span>
          </div>
          {vatBreakdown.map((vb) => (
            <div key={vb.ratePercent} className="flex justify-between text-muted-foreground">
              <span>{t('pos.vatAmount')} ({vb.ratePercent}%):</span><span className="font-mono">{formatMoney2(vb.vatAmount, true)}</span>
            </div>
          ))}
          <div className="flex items-baseline justify-between border-t border-border pt-2.5 mt-2">
            <span className="text-sm font-semibold text-foreground">{t('pos.totalForPayment')}:</span>
            <span className="font-mono text-xl font-bold text-primary">{formatMoney2(totals.totalGrossAmount, true)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <Button variant="success" size="lg" disabled={!hasLines} onClick={onIssueReceipt} className="w-full font-semibold">
            <CheckCircle2 className="h-4 w-4" /><span>{t('pos.issueFiscalReceipt')}</span>
          </Button>
          <div className="grid grid-cols-3 gap-1.5">
            <Button variant="outline" size="sm" disabled={!hasLines} onClick={onHoldReceipt}>
              <PauseCircle className="h-3.5 w-3.5" /><span className="truncate">{t('pos.holdReceipt')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={onOpenHeldDialog}>
              <span className="truncate">{t('pos.heldReceipts')} ({heldCount})</span>
            </Button>
            <Button variant="destructive" size="sm" disabled={!hasLines} onClick={onClearReceipt}>
              <Trash2 className="h-3.5 w-3.5" /><span className="truncate">{t('pos.clearReceipt')}</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
