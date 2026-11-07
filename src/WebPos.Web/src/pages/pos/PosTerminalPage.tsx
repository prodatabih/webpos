import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, List, Barcode, ReceiptText } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { t } from '../../i18n';
import { d, round4 } from '../../lib/money';
import { generateUuidV7 } from '../../lib/utils';
import type { Item, PaymentMethod } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { showToast } from '../../components/ui/Toast';
import {
  buildPosReceiptFromCart,
  computeCartTotalsAndVat,
  resolveScanInput,
  type PosCartLine,
} from './posScannerUtils';
import { PosTouchCatalog } from './PosTouchCatalog';
import { PosReceiptLinesTable } from './PosReceiptLinesTable';
import { PosPaymentPanel } from './PosPaymentPanel';
import { PosHeldReceiptsDialog } from './PosHeldReceiptsDialog';

export function PosTerminalPage() {
  const navigate = useNavigate();
  const scanInputRef = useRef<HTMLInputElement>(null);
  const store = useAppStore();
  const activeTerminal = store.posTerminals.find((tr) => tr.id === store.activeTerminalId);
  const activeStore = store.storeLocations.find((st) => st.id === store.activeStoreId);

  const [scanText, setScanText] = useState('');
  const [multiplier, setMultiplier] = useState('1');
  const [lines, setLines] = useState<PosCartLine[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [cashReceived, setCashReceived] = useState('0.00');
  const [cardAmount, setCardAmount] = useState('0.00');
  const [wireAmount, setWireAmount] = useState('0.00');
  const [heldDialogOpen, setHeldDialogOpen] = useState(false);

  const appendOrIncrementItem = (item: Item, scannedBarcode: string, qtyToAdd: string) => {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.itemId === item.id);
      if (idx >= 0) {
        return prev.map((l, i) => (i === idx ? { ...l, quantity: round4(d(l.quantity).plus(d(qtyToAdd))) } : l));
      }
      return [...prev, { id: generateUuidV7(), itemId: item.id, scannedBarcode, quantity: qtyToAdd, discountPercent: '0.00' }];
    });
  };

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const resolved = resolveScanInput(scanText, multiplier, store.items, store.itemBarcodes);
    if (!resolved) {
      showToast({ title: t('common.noResults'), variant: 'error' });
      return;
    }
    appendOrIncrementItem(resolved.item, resolved.scannedBarcode, resolved.quantityToAdd);
    setScanText('');
    setMultiplier('1');
    scanInputRef.current?.focus();
  };

  const { totals, vatBreakdown } = useMemo(
    () => computeCartTotalsAndVat(lines, store.items, store.storeItemPrices, store.vatRates, store.activeStoreId),
    [lines, store.items, store.storeItemPrices, store.vatRates, store.activeStoreId]
  );

  const handleHoldReceipt = () => {
    if (lines.length === 0) return;
    store.holdPosReceipt({
      id: generateUuidV7(),
      storeId: store.activeStoreId,
      terminalId: store.activeTerminalId,
      label: `#${store.heldReceipts.length + 1} (${lines.length})`,
      createdAt: new Date().toISOString(),
      partnerId: selectedPartnerId || undefined,
      lines: lines.map((l) => ({ itemId: l.itemId, scannedBarcode: l.scannedBarcode, quantity: l.quantity, discountPercent: l.discountPercent })),
    });
    setLines([]);
    setSelectedPartnerId('');
    showToast({ title: t('messages.receiptHeld'), variant: 'info' });
  };

  const handleIssueReceipt = () => {
    if (lines.length === 0) return;
    const receipt = buildPosReceiptFromCart({
      companyId: store.activeCompanyId,
      fiscalYearId: store.activeFiscalYearId,
      storeId: store.activeStoreId,
      terminalId: store.activeTerminalId,
      activeTerminal,
      partnerId: selectedPartnerId,
      paymentMethod,
      cashReceived,
      cardAmount,
      wireAmount,
      cashierName: store.currentUserName,
      lines,
      totals,
      items: store.items,
      storePrices: store.storeItemPrices,
      vatRates: store.vatRates,
    });
    if (store.issuePosReceipt(receipt).ok) {
      setLines([]);
      setSelectedPartnerId('');
      setCashReceived('0.00');
      setCardAmount('0.00');
      setWireAmount('0.00');
      showToast({ title: t('messages.receiptIssued'), description: `${receipt.receiptNumber} (${receipt.fiscalNumber})`, variant: 'success' });
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); scanInputRef.current?.focus(); }
      else if (e.key === 'F4') { e.preventDefault(); handleHoldReceipt(); }
      else if (e.key === 'F5') { e.preventDefault(); setPaymentMethod('CASH'); }
      else if (e.key === 'F6') { e.preventDefault(); setPaymentMethod('CARD'); }
      else if (e.key === 'F8') { e.preventDefault(); navigate('/pos/receipts'); }
      else if (e.key === 'F10') { e.preventDefault(); handleIssueReceipt(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t('pos.title')}
        subtitle={`${activeStore?.name ?? ''} · ${activeTerminal?.name ?? ''}`}
        breadcrumbs={[{ label: t('nav.groupPos') }, { label: t('nav.posRegister') }]}
        actions={
          <div className="flex items-center gap-1.5">
            <Button variant={store.posWorkMode === 'TABLE' ? 'primary' : 'outline'} size="sm" onClick={() => store.setPosWorkMode('TABLE')}>
              <List className="h-3.5 w-3.5" /><span>{t('pos.modeTable')}</span>
            </Button>
            <Button variant={store.posWorkMode === 'TOUCH' ? 'primary' : 'outline'} size="sm" onClick={() => store.setPosWorkMode('TOUCH')}>
              <LayoutGrid className="h-3.5 w-3.5" /><span>{t('pos.modeTouch')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/pos/receipts')}>
              <ReceiptText className="h-3.5 w-3.5" /><span>{t('nav.posReceipts')}</span>
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <Badge variant="outline">{t('pos.shortcutScan')}</Badge>
          <Badge variant="outline">{t('pos.shortcutQty')}</Badge>
          <Badge variant="outline">{t('pos.shortcutHold')}</Badge>
          <Badge variant="outline">{t('pos.shortcutCash')}</Badge>
          <Badge variant="outline">{t('pos.shortcutCard')}</Badge>
          <Badge variant="outline">{t('pos.shortcutRefund')}</Badge>
          <Badge variant="outline">{t('pos.shortcutPay')}</Badge>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8 flex flex-col gap-4">
            <form onSubmit={handleScanSubmit} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-3">
              <div className="w-28">
                <Input label={t('pos.quantityMultiplier')} type="number" step="0.001" min="0.001" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} className="font-mono text-right" />
              </div>
              <div className="flex-1 min-w-[220px]">
                <Input ref={scanInputRef} label={t('master.barcode')} value={scanText} onChange={(e) => setScanText(e.target.value)} placeholder={t('pos.scanInputPlaceholder')} rightElement={<Barcode className="h-4 w-4" />} />
              </div>
              <Button type="submit" variant="primary">{t('common.add')}</Button>
            </form>

            {store.posWorkMode === 'TOUCH' && (
              <PosTouchCatalog
                items={store.items}
                storePrices={store.storeItemPrices}
                activeStoreId={store.activeStoreId}
                onSelectItem={(item) => appendOrIncrementItem(item, item.primaryBarcode, round4(d(multiplier).gt(0) ? d(multiplier) : 1))}
              />
            )}

            <PosReceiptLinesTable
              lines={lines}
              items={store.items}
              storePrices={store.storeItemPrices}
              activeStoreId={store.activeStoreId}
              totals={totals}
              onUpdateQty={(id, qty) => setLines((prev) => prev.map((l) => (l.id === id ? { ...l, quantity: qty } : l)))}
              onUpdateDiscount={(id, disc) => setLines((prev) => prev.map((l) => (l.id === id ? { ...l, discountPercent: disc } : l)))}
              onRemoveLine={(id) => setLines((prev) => prev.filter((l) => l.id !== id))}
            />
          </div>

          <div className="lg:col-span-4">
            <PosPaymentPanel
              partners={store.partners}
              selectedPartnerId={selectedPartnerId}
              onSelectPartner={setSelectedPartnerId}
              totals={totals}
              vatBreakdown={vatBreakdown}
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
              cashReceived={cashReceived}
              onCashReceivedChange={setCashReceived}
              cardAmount={cardAmount}
              onCardAmountChange={setCardAmount}
              wireAmount={wireAmount}
              onWireAmountChange={setWireAmount}
              hasLines={lines.length > 0}
              heldCount={store.heldReceipts.length}
              onHoldReceipt={handleHoldReceipt}
              onOpenHeldDialog={() => setHeldDialogOpen(true)}
              onClearReceipt={() => setLines([])}
              onIssueReceipt={handleIssueReceipt}
            />
          </div>
        </div>
      </div>

      <PosHeldReceiptsDialog
        open={heldDialogOpen}
        onOpenChange={setHeldDialogOpen}
        heldReceipts={store.heldReceipts}
        onResume={(nextLines, partnerId, heldId) => {
          setLines(nextLines);
          setSelectedPartnerId(partnerId);
          store.removeHeldReceipt(heldId);
        }}
        onRemove={store.removeHeldReceipt}
      />
    </div>
  );
}
export default PosTerminalPage;
