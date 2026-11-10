import { useMemo, useRef, useState } from 'react';
import { Plus, CheckCircle2, Save, Barcode, Printer, FileSpreadsheet } from 'lucide-react';
import { t } from '../../i18n';
import { d } from '../../lib/money';
import { generateUuidV7 } from '../../lib/utils';
import type {
  Company,
  InventoryCountDocument,
  Item,
  StoreItemPrice,
  StoreLocation,
  VatRate,
} from '../../types/domain';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Combobox } from '../../components/ui/Combobox';
import { DocumentStatusBadge } from '../../components/ui/Badge';
import { InventoryCountPrintView } from './InventoryCountPrintView';
import { InventoryCountLinesTable } from './InventoryCountLinesTable';
import { InventoryCountRecapPanel } from './InventoryCountRecapPanel';
import { buildCountLine, exportInventoryCountToExcel, recomputeInventoryCountTotals } from './inventoryCountUtils';

interface InventoryCountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDoc: InventoryCountDocument;
  company: Company;
  storeLocation: StoreLocation;
  items: Item[];
  vatRates: VatRate[];
  storePrices: StoreItemPrice[];
  onSaveDraft: (doc: InventoryCountDocument) => void;
  onPostDocument: (doc: InventoryCountDocument) => void;
}

export function InventoryCountDialog({
  open,
  onOpenChange,
  initialDoc,
  company,
  storeLocation,
  items,
  vatRates,
  storePrices,
  onSaveDraft,
  onPostDocument,
}: InventoryCountDialogProps) {
  const [doc, setDoc] = useState<InventoryCountDocument>(initialDoc);
  const [newItemId, setNewItemId] = useState('');
  const [isScannerMode, setIsScannerMode] = useState(false);
  const [scanText, setScanText] = useState('');
  const [printMode, setPrintMode] = useState<'NONE' | 'ALL' | 'SURPLUS' | 'SHORTAGE'>('NONE');
  const scanInputRef = useRef<HTMLInputElement>(null);
  const isReadOnly = doc.status !== 'DRAFT';

  const itemOptions = useMemo(
    () =>
      items
        .filter((it) => it.isActive)
        .map((it) => ({
          value: it.id,
          code: it.sku,
          label: it.name,
          sublabel: `${it.primaryBarcode} · ${it.uom}`,
        })),
    [items]
  );

  const handleAddLine = () => {
    if (isReadOnly || !newItemId) return;
    const item = items.find((i) => i.id === newItemId);
    if (!item) return;
    const priceRec = storePrices.find((p) => p.storeId === doc.storeId && p.itemId === item.id);
    const vatRate = vatRates.find((v) => v.id === item.vatRateId)?.ratePercent ?? '17.00';
    const bookQty = priceRec?.currentStockQty ?? '0.0000';
    const nextLine = buildCountLine({
      id: generateUuidV7(),
      itemId: item.id,
      bookQuantity: bookQty,
      countedQuantity: bookQty,
      purchaseUnitPrice: priceRec?.purchaseUnitPrice ?? '0.0000',
      retailUnitPriceWithVat: priceRec?.retailUnitPriceWithVat ?? '0.00',
      vatRatePercent: vatRate,
    });
    setDoc(recomputeInventoryCountTotals(doc, [...doc.lines, nextLine]));
    setNewItemId('');
  };

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = scanText.trim().toLowerCase();
    if (!query) return;
    const matched = items.find((i) => i.isActive && (i.primaryBarcode.toLowerCase() === query || i.sku.toLowerCase() === query));
    if (matched) {
      const existingIdx = doc.lines.findIndex((l) => l.itemId === matched.id);
      if (existingIdx >= 0) {
        const nextLines = doc.lines.map((l, idx) => (idx === existingIdx ? buildCountLine({ ...l, countedQuantity: d(l.countedQuantity).plus(1).toString() }) : l));
        setDoc(recomputeInventoryCountTotals(doc, nextLines));
      } else {
        const priceRec = storePrices.find((p) => p.storeId === doc.storeId && p.itemId === matched.id);
        const vatRate = vatRates.find((v) => v.id === matched.vatRateId)?.ratePercent ?? '17.00';
        const nextLine = buildCountLine({
          id: generateUuidV7(),
          itemId: matched.id,
          bookQuantity: priceRec?.currentStockQty ?? '0.0000',
          countedQuantity: '1.0000',
          purchaseUnitPrice: priceRec?.purchaseUnitPrice ?? '0.0000',
          retailUnitPriceWithVat: priceRec?.retailUnitPriceWithVat ?? '0.00',
          vatRatePercent: vatRate,
        });
        setDoc(recomputeInventoryCountTotals(doc, [...doc.lines, nextLine]));
      }
    }
    setScanText('');
    scanInputRef.current?.focus();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${t('nav.inventoryCount')} — ${doc.docNumber}`}
      size="full"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPrintMode(printMode === 'ALL' ? 'NONE' : 'ALL')}>
              <Printer className="h-3.5 w-3.5" /><span>{t('warehouse.printInventoryList')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPrintMode(printMode === 'SURPLUS' ? 'NONE' : 'SURPLUS')}>
              <Printer className="h-3.5 w-3.5 text-success" /><span>{t('warehouse.printSurplusList')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPrintMode(printMode === 'SHORTAGE' ? 'NONE' : 'SHORTAGE')}>
              <Printer className="h-3.5 w-3.5 text-destructive" /><span>{t('warehouse.printShortageList')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportInventoryCountToExcel(doc, items)}>
              <FileSpreadsheet className="h-3.5 w-3.5 text-success" /><span>{t('common.exportExcel')}</span>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
            {!isReadOnly && (
              <>
                <Button variant="secondary" onClick={() => onSaveDraft(doc)}>
                  <Save className="h-4 w-4" /><span>{t('common.saveDraft')}</span>
                </Button>
                <Button variant="success" disabled={doc.lines.length === 0} onClick={() => onPostDocument(doc)}>
                  <CheckCircle2 className="h-4 w-4" /><span>{t('common.postDocument')}</span>
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      {printMode !== 'NONE' ? (
        <InventoryCountPrintView
          doc={doc}
          company={company}
          storeLocation={storeLocation}
          items={items}
          initialMode={printMode}
          onBack={() => setPrintMode('NONE')}
        />
      ) : (
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DocumentStatusBadge status={doc.status} />
              <Button
                variant={isScannerMode ? 'primary' : 'outline'}
                size="sm"
                onClick={() => {
                  setIsScannerMode(!isScannerMode);
                  setTimeout(() => scanInputRef.current?.focus(), 100);
                }}
              >
                <Barcode className="h-4 w-4" />
                <span>{t('warehouse.barcodeScannerMode')}</span>
              </Button>
            </div>
            {isReadOnly && <span className="text-muted-foreground">{t('messages.postedImmutableError')}</span>}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input label={t('warehouse.docNumber')} value={doc.docNumber} disabled={isReadOnly} onChange={(e) => setDoc({ ...doc, docNumber: e.target.value })} className="font-mono" />
            <Input label={t('warehouse.docDate')} type="date" value={doc.docDate} disabled={isReadOnly} onChange={(e) => setDoc({ ...doc, docDate: e.target.value })} />
            <Input label={t('warehouse.commissionMembers')} value={doc.commissionMembers} disabled={isReadOnly} onChange={(e) => setDoc({ ...doc, commissionMembers: e.target.value })} />
          </div>

          {isScannerMode && !isReadOnly && (
            <form onSubmit={handleScanSubmit} className="flex items-center gap-2 rounded-lg border-2 border-primary/50 bg-primary/5 p-3">
              <Barcode className="h-5 w-5 text-primary" />
              <input
                ref={scanInputRef}
                type="text"
                value={scanText}
                onChange={(e) => setScanText(e.target.value)}
                placeholder={t('warehouse.scanOrTypeBarcode')}
                className="h-8 flex-1 rounded border border-input bg-background px-3 font-mono text-xs focus:ring-1 focus:ring-ring"
              />
              <Button type="submit" variant="primary" size="sm">{t('common.add')}</Button>
            </form>
          )}

          {!isReadOnly && !isScannerMode && (
            <div className="flex items-end gap-2 rounded-md border border-border bg-muted/30 p-3">
              <div className="flex-1"><Combobox label={t('nav.items')} options={itemOptions} value={newItemId} onChange={setNewItemId} /></div>
              <Button variant="primary" onClick={handleAddLine} disabled={!newItemId}>
                <Plus className="h-4 w-4" /><span>{t('common.add')}</span>
              </Button>
            </div>
          )}

          <InventoryCountLinesTable
            lines={doc.lines}
            items={items}
            isReadOnly={isReadOnly}
            onCountedQtyChange={(id, val) => setDoc(recomputeInventoryCountTotals(doc, doc.lines.map((l) => (l.id === id ? buildCountLine({ ...l, countedQuantity: val }) : l))))}
            onAllowedWasteChange={(id, val) => setDoc(recomputeInventoryCountTotals(doc, doc.lines.map((l) => (l.id === id ? buildCountLine({ ...l, allowedWasteQuantity: val }) : l))))}
            onRemoveLine={(id) => setDoc(recomputeInventoryCountTotals(doc, doc.lines.filter((l) => l.id !== id)))}
          />

          <InventoryCountRecapPanel
            totalSurplusRetailValue={doc.totalSurplusRetailValue}
            totalAllowedWasteValue={doc.totalAllowedWasteValue}
            totalUnrecognizedShortageValue={doc.totalUnrecognizedShortageValue}
            totalShortageRetailValue={doc.totalShortageRetailValue}
            totalUnrecognizedShortageVat={doc.totalUnrecognizedShortageVat}
          />
        </div>
      )}
    </Dialog>
  );
}
