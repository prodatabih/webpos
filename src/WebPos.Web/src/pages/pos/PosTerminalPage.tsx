import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Building2, CalendarDays, LayoutGrid, List, ReceiptText } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { t } from '../../i18n';
import { d, round4 } from '../../lib/money';
import { generateUuidV7 } from '../../lib/utils';
import type { Item, PaymentMethod } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../components/ui/Toast';
import {
  buildPosReceiptFromCart, computeCartTotalsAndVat, resolveScanInput, type PosCartLine,
} from './posScannerUtils';
import { PosTouchCatalog } from './PosTouchCatalog';
import { PosReceiptLinesTable } from './PosReceiptLinesTable';
import { PosPaymentPanel } from './PosPaymentPanel';
import { PosHeldReceiptsDialog } from './PosHeldReceiptsDialog';
import { PosScannerForm } from './PosScannerForm';
import { PosShortcutsBanner } from './PosShortcutsBanner';

export function PosTerminalPage() {
  const navigate = useNavigate();
  const scanInputRef = useRef<HTMLInputElement>(null);
  const store = useAppStore();
  const activeTerminal = store.posTerminals.find((tr) => tr.id === store.activeTerminalId);
  const activeStore = store.storeLocations.find((st) => st.id === store.activeStoreId);
  const activeFiscalYear = store.fiscalYears.find((fy) => fy.id === store.activeFiscalYearId);

  const [scanText, setScanText] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [lines, setLines] = useState<PosCartLine[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [cashReceived, setCashReceived] = useState('0.00');
  const [cardAmount, setCardAmount] = useState('0.00');
  const [wireAmount, setWireAmount] = useState('0.00');
  const [heldDialogOpen, setHeldDialogOpen] = useState(false);
  const [issuing, setIssuing] = useState(false);

  const missingContext = useMemo(() => {
    const missing: string[] = [];
    if (!store.activeStoreId || !activeStore) missing.push('aktivna poslovnica');
    if (!store.activeTerminalId || !activeTerminal) missing.push('aktivna POS kasa (terminal)');
    if (!store.activeFiscalYearId || !activeFiscalYear) missing.push('aktivna poslovna godina');
    return missing;
  }, [
    store.activeStoreId,
    activeStore,
    store.activeTerminalId,
    activeTerminal,
    store.activeFiscalYearId,
    activeFiscalYear,
  ]);

  const isPosContextReady = missingContext.length === 0;

  const appendOrIncrementItem = (item: Item, scannedBarcode: string, qtyToAdd: string) => {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.itemId === item.id);
      if (idx >= 0) {
        return prev.map((l, i) => (i === idx ? { ...l, quantity: round4(d(l.quantity).plus(d(qtyToAdd))) } : l));
      }
      return [...prev, { id: generateUuidV7(), itemId: item.id, scannedBarcode, quantity: qtyToAdd, discountPercent: '0.00' }];
    });
  };

  const searchSuggestions = useMemo(() => {
    const q = scanText.trim().toLowerCase();
    if (!q) {
      return store.items.filter((it) => it.isActive).slice(0, 20);
    }
    return store.items
      .filter(
        (it) =>
          it.isActive &&
          (it.name.toLowerCase().includes(q) ||
            it.sku.toLowerCase().includes(q) ||
            it.primaryBarcode.toLowerCase().includes(q) ||
            it.shortName.toLowerCase().includes(q) ||
            it.categoryName.toLowerCase().includes(q))
      )
      .slice(0, 30);
  }, [scanText, store.items]);

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const resolved = resolveScanInput(scanText, quantity, store.items, store.itemBarcodes);
    if (!resolved) {
      showToast({ title: t('common.noResults'), variant: 'error' });
      return;
    }
    appendOrIncrementItem(resolved.item, resolved.scannedBarcode, resolved.quantityToAdd);
    setScanText('');
    setQuantity('1');
    scanInputRef.current?.focus();
  };

  const { totals, vatBreakdown } = useMemo(
    () => computeCartTotalsAndVat(lines, store.items, store.storeItemPrices, store.vatRates, store.activeStoreId),
    [lines, store.items, store.storeItemPrices, store.vatRates, store.activeStoreId]
  );

  const handleHoldReceipt = useCallback(() => {
    if (lines.length === 0 || issuing) return;
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
  }, [lines, issuing, store, selectedPartnerId]);

  const handleIssueReceipt = useCallback(async () => {
    if (lines.length === 0 || issuing) return;
    if (!isPosContextReady) {
      showToast({
        title: 'POS kasa nije podešena',
        description: `Nedostaje: ${missingContext.join(', ')}. Podesite organizaciju i poslovni period prije izdavanja računa.`,
        variant: 'error',
      });
      return;
    }

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

    setIssuing(true);
    try {
      const res = await store.issuePosReceipt(receipt);
      if (res.ok) {
        setLines([]);
        setSelectedPartnerId('');
        setCashReceived('0.00');
        setCardAmount('0.00');
        setWireAmount('0.00');
        showToast({
          title: t('messages.receiptIssued'),
          description: `${receipt.receiptNumber}${receipt.fiscalNumber ? ` (${receipt.fiscalNumber})` : ''}`,
          variant: 'success',
        });
        scanInputRef.current?.focus();
      } else {
        showToast({
          title: 'Izdavanje računa nije uspjelo',
          description: res.error || 'Server nije potvrdio izdavanje POS računa.',
          variant: 'error',
        });
      }
    } finally {
      setIssuing(false);
    }
  }, [
    lines,
    issuing,
    isPosContextReady,
    missingContext,
    store,
    activeTerminal,
    selectedPartnerId,
    paymentMethod,
    cashReceived,
    cardAmount,
    wireAmount,
    totals,
  ]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        scanInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleHoldReceipt();
      } else if (e.key === 'F5') {
        e.preventDefault();
        if (!issuing) setPaymentMethod('CASH');
      } else if (e.key === 'F6') {
        e.preventDefault();
        if (!issuing) setPaymentMethod('CARD');
      } else if (e.key === 'F8') {
        e.preventDefault();
        navigate('/pos/receipts');
      } else if (e.key === 'F10') {
        e.preventDefault();
        void handleIssueReceipt();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleHoldReceipt, handleIssueReceipt, issuing, navigate]);

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t('pos.title')}
        subtitle={`${activeStore?.name ?? 'Poslovnica nije odabrana'} · ${activeTerminal?.name ?? 'Kasa nije odabrana'}`}
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
        {!isPosContextReady && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
              <div>
                <p className="font-semibold text-destructive">
                  Izdavanje POS računa je onemogućeno — nedostaje aktivni kontekst
                </p>
                <p className="mt-0.5 text-xs text-foreground/90">
                  Nedostaje: <span className="font-semibold">{missingContext.join(', ')}</span>. Konfigurišite poslovnicu, POS terminal i aktivnu poslovnu godinu kako biste mogli izdavati račune.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => navigate('/master/organizations')}>
                <Building2 className="h-3.5 w-3.5" />
                <span>Organizacija</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/master/fiscal-periods')}>
                <CalendarDays className="h-3.5 w-3.5" />
                <span>Poslovni periodi</span>
              </Button>
            </div>
          </div>
        )}

        <PosShortcutsBanner />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8 flex flex-col gap-4">
            <PosScannerForm
              quantity={quantity}
              setQuantity={setQuantity}
              scanText={scanText}
              setScanText={setScanText}
              searchSuggestions={searchSuggestions}
              storePrices={store.storeItemPrices}
              activeStoreId={store.activeStoreId}
              scanInputRef={scanInputRef}
              onSubmit={handleScanSubmit}
              onSelectSuggestion={(item) => {
                appendOrIncrementItem(item, item.primaryBarcode, round4(d(quantity).gt(0) ? d(quantity) : 1));
                setScanText('');
                setQuantity('1');
                scanInputRef.current?.focus();
              }}
            />

            {store.posWorkMode === 'TOUCH' && (
              <PosTouchCatalog
                items={store.items}
                storePrices={store.storeItemPrices}
                activeStoreId={store.activeStoreId}
                onSelectItem={(item) => appendOrIncrementItem(item, item.primaryBarcode, round4(d(quantity).gt(0) ? d(quantity) : 1))}
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
              onFocusScanner={() => scanInputRef.current?.focus()}
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
              canIssue={isPosContextReady}
              isIssuing={issuing}
              heldCount={store.heldReceipts.length}
              onHoldReceipt={handleHoldReceipt}
              onOpenHeldDialog={() => setHeldDialogOpen(true)}
              onClearReceipt={() => setLines([])}
              onIssueReceipt={() => void handleIssueReceipt()}
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
