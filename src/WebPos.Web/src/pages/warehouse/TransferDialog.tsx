import { useRef, useState } from 'react';
import { CheckCircle2, Save, Printer, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { t } from '../../i18n';
import { d, formatMoney2, round2 } from '../../lib/money';
import { exportToExcelSpreadsheet } from '../../lib/excelExport';
import {
  focusItemPickerInRow,
  useDocumentShortcuts,
} from '../../lib/keyboardGridUtils';
import type { ActionResult } from '../../store/storeTypes';
import type {
  Company,
  Item,
  StoreItemPrice,
  StoreLocation,
  TransferDocument,
  VatRate,
} from '../../types/domain';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Combobox } from '../../components/ui/Combobox';
import { DocumentStatusBadge } from '../../components/ui/Badge';
import { KeyboardShortcutsBar } from '../../components/ui/KeyboardShortcutsBar';
import { showToast } from '../../components/ui/Toast';
import { TransferPrintView } from './TransferPrintView';
import { TransferLinesTable } from './TransferLinesTable';
import { useTransferEditorState } from './useTransferEditorState';

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDoc: TransferDocument;
  company: Company;
  storeLocations: StoreLocation[];
  items: Item[];
  vatRates: VatRate[];
  storePrices: StoreItemPrice[];
  onSaveDraft: (doc: TransferDocument) => Promise<ActionResult>;
  onPostDocument: (doc: TransferDocument) => Promise<ActionResult>;
  onAutoSave?: (doc: TransferDocument) => Promise<ActionResult>;
}

function exportTransferToExcel(doc: TransferDocument, items: Item[]): void {
  const validLines = doc.lines.filter((l) => Boolean(l.itemId));
  const diffTotal = round2(d(doc.totalTargetRetailValue).minus(d(doc.totalSourceRetailValue)));
  exportToExcelSpreadsheet({
    fileName: `medjuskladisnica_${doc.docNumber}`,
    sheetName: 'Medjuskladisnica',
    columns: [
      { header: 'R.br', key: 'idx', type: 'number' },
      { header: 'Šifra', key: 'sku' },
      { header: 'Naziv artikla', key: 'name' },
      { header: 'JM', key: 'uom' },
      { header: 'Količina', key: 'quantity', type: 'number', numDecimals: 2 },
      { header: 'Nabavna cijena', key: 'purchaseUnitPrice', type: 'number', numDecimals: 4 },
      { header: 'Ukupno NC', key: 'purchaseTotalValue', type: 'number', numDecimals: 2 },
      { header: 'Izlazna MPC', key: 'sourceRetailUnitPrice', type: 'number', numDecimals: 2 },
      { header: 'Ukupno izlaz MPC', key: 'sourceRetailTotalValue', type: 'number', numDecimals: 2 },
      { header: 'Ulazna MPC', key: 'targetRetailUnitPrice', type: 'number', numDecimals: 2 },
      { header: 'Ukupno ulaz MPC', key: 'targetRetailTotalValue', type: 'number', numDecimals: 2 },
      { header: 'Razlika u cijeni', key: 'priceDiff', type: 'number', numDecimals: 2 },
    ],
    rows: validLines.map((l, idx) => {
      const item = items.find((i) => i.id === l.itemId);
      return {
        idx: idx + 1,
        sku: item?.sku ?? '',
        name: item?.name ?? '',
        uom: item?.uom ?? 'KOM',
        quantity: l.quantity,
        purchaseUnitPrice: l.purchaseUnitPrice,
        purchaseTotalValue: l.purchaseTotalValue,
        sourceRetailUnitPrice: l.sourceRetailUnitPrice,
        sourceRetailTotalValue: l.sourceRetailTotalValue,
        targetRetailUnitPrice: l.targetRetailUnitPrice,
        targetRetailTotalValue: l.targetRetailTotalValue,
        priceDiff: round2(d(l.targetRetailTotalValue).minus(d(l.sourceRetailTotalValue))),
      };
    }),
    summaryRow: {
      name: 'UKUPNO',
      purchaseTotalValue: doc.totalPurchaseValue,
      sourceRetailTotalValue: doc.totalSourceRetailValue,
      targetRetailTotalValue: doc.totalTargetRetailValue,
      priceDiff: diffTotal,
    },
  });
}

export function TransferDialog({
  open,
  onOpenChange,
  initialDoc,
  company,
  storeLocations,
  items,
  vatRates,
  storePrices,
  onSaveDraft,
  onPostDocument,
  onAutoSave,
}: TransferDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [focusedRowIndex, setFocusedRowIndex] = useState(0);
  const isBusy = isSaving || isPosting;
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    doc,
    setDoc,
    isPrintPreview,
    setIsPrintPreview,
    isReadOnly,
    autoSaveStatus,
    storeOptions,
    sourceStore,
    targetStore,
    priceDifferenceTotal,
    sanitizeForPersist,
    cancelPendingAutoSave,
    markSaved,
    handleClose,
    handleAddItem,
    handleAddBlankLine,
    handleSelectItemForLine,
    handleLineChange,
    handleCopyLine,
    handleRemoveLine,
  } = useTransferEditorState({
    initialDoc,
    storeLocations,
    items,
    vatRates,
    storePrices,
    isBusy,
    onAutoSave,
    onOpenChange,
  });

  const validLines = doc.lines.filter((l) => Boolean(l.itemId));
  const hasValidStores =
    Boolean(doc.sourceStoreId) &&
    Boolean(doc.targetStoreId) &&
    doc.sourceStoreId !== doc.targetStoreId;
  const canPost =
    hasValidStores &&
    validLines.length > 0 &&
    !validLines.some((l) => d(l.quantity).lte(0));

  const handleManualSave = async () => {
    if (isBusy) return;
    if (!hasValidStores) {
      showToast({
        title: 'Odaberite različito izlazno i ulazno skladište prije snimanja.',
        variant: 'error',
      });
      return;
    }
    if (validLines.length === 0) {
      showToast({ title: 'Dodajte barem jedan artikal prije snimanja nacrta.', variant: 'error' });
      return;
    }
    cancelPendingAutoSave();
    setIsSaving(true);
    try {
      const res = await onSaveDraft(sanitizeForPersist(doc));
      if (res.ok) markSaved();
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualPost = async () => {
    if (isBusy) return;
    if (!hasValidStores) {
      showToast({
        title: 'Odaberite različito izlazno i ulazno skladište prije knjiženja.',
        variant: 'error',
      });
      return;
    }
    if (validLines.length === 0) {
      showToast({ title: 'Dodajte barem jedan artikal prije knjiženja.', variant: 'error' });
      return;
    }
    if (validLines.some((l) => d(l.quantity).lte(0))) {
      showToast({ title: 'Količina na svim stavkama mora biti veća od nule.', variant: 'error' });
      return;
    }
    cancelPendingAutoSave();
    setIsPosting(true);
    try {
      await onPostDocument(sanitizeForPersist(doc));
    } finally {
      setIsPosting(false);
    }
  };

  useDocumentShortcuts({
    enabled: open,
    isReadOnly: isReadOnly || isPrintPreview,
    onSave: () => {
      if (!isBusy) void handleManualSave();
    },
    onPost: () => {
      if (canPost && !isBusy) void handleManualPost();
    },
    onPrint: () => {
      setIsPrintPreview((prev) => !prev);
    },
    onFocusSearch: () => {
      if (!isReadOnly && !isPrintPreview) {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    },
    onAddRow: () => {
      const nextIdx = doc.lines.length;
      handleAddBlankLine();
      setFocusedRowIndex(nextIdx);
      requestAnimationFrame(() => {
        setTimeout(() => {
          focusItemPickerInRow(tbodyRef.current, nextIdx, true);
        }, 30);
      });
    },
    onDuplicateRow: () => {
      const target = doc.lines[focusedRowIndex];
      if (target?.itemId) {
        handleCopyLine(focusedRowIndex);
      }
    },
    onDeleteRow: () => {
      const target = doc.lines[focusedRowIndex];
      if (target) {
        handleRemoveLine(target.id);
        setFocusedRowIndex(Math.max(0, focusedRowIndex - 1));
      }
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          handleClose();
          return;
        }
        onOpenChange(next);
      }}
      title={`${t('nav.transfers')} — ${doc.docNumber}`}
      size="full"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsPrintPreview(!isPrintPreview)}>
              <Printer className="h-3.5 w-3.5" />
              <span>{isPrintPreview ? t('warehouse.backToEdit') : t('warehouse.printTransfer')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportTransferToExcel(doc, items)}>
              <FileSpreadsheet className="h-3.5 w-3.5 text-success" />
              <span>{t('common.exportExcel')}</span>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isBusy}>
              {t('common.close')}
            </Button>
            {!isReadOnly && (
              <>
                <Button variant="secondary" onClick={handleManualSave} isLoading={isSaving} disabled={isBusy}>
                  <Save className="h-4 w-4" /><span>{t('common.saveDraft')}</span>
                </Button>
                <Button
                  variant="success"
                  disabled={!canPost || isBusy}
                  isLoading={isPosting}
                  onClick={handleManualPost}
                >
                  <CheckCircle2 className="h-4 w-4" /><span>{t('common.postDocument')}</span>
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      {isPrintPreview ? (
        <TransferPrintView
          doc={doc}
          company={company}
          sourceStore={sourceStore}
          targetStore={targetStore}
          items={items}
          onBack={() => setIsPrintPreview(false)}
        />
      ) : (
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DocumentStatusBadge status={doc.status} />
              <span className="font-mono font-bold text-foreground">{doc.docNumber}</span>
              {!isReadOnly && autoSaveStatus === 'saving' && (
                <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <Save className="h-3 w-3 animate-pulse" />
                  {t('common.autoSaving')}
                </span>
              )}
              {!isReadOnly && autoSaveStatus === 'saved' && (
                <span className="inline-flex items-center gap-1 rounded bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                  <Save className="h-3 w-3" />
                  {t('common.autoSaved')}
                </span>
              )}
              {!isReadOnly && autoSaveStatus === 'error' && (
                <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  Nacrt nije sačuvan
                </span>
              )}
            </div>
            {isReadOnly && <span className="text-muted-foreground">{t('messages.postedImmutableError')}</span>}
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Input
                label={t('warehouse.docNumber')}
                value={doc.docNumber}
                disabled={isReadOnly}
                onChange={(e) => setDoc({ ...doc, docNumber: e.target.value })}
                className="font-mono font-semibold"
              />
              <Input
                label={t('warehouse.docDate')}
                type="date"
                value={doc.docDate}
                disabled={isReadOnly}
                onChange={(e) => setDoc({ ...doc, docDate: e.target.value })}
              />
              <Combobox
                label={t('warehouse.transferOutStore')}
                options={storeOptions}
                value={doc.sourceStoreId}
                disabled={isReadOnly}
                onChange={(val) => setDoc({ ...doc, sourceStoreId: val })}
              />
              <Combobox
                label={t('warehouse.transferInStore')}
                options={storeOptions}
                value={doc.targetStoreId}
                disabled={isReadOnly}
                onChange={(val) => setDoc({ ...doc, targetStoreId: val })}
              />
              <Input
                label={t('common.notes')}
                value={doc.notes}
                disabled={isReadOnly}
                onChange={(e) => setDoc({ ...doc, notes: e.target.value })}
                placeholder="Napomena uz prenos..."
              />
            </div>
          </div>

          <TransferLinesTable
            lines={doc.lines}
            items={items}
            storePrices={storePrices}
            sourceStoreId={doc.sourceStoreId}
            isReadOnly={isReadOnly}
            tbodyRef={tbodyRef}
            searchInputRef={searchInputRef}
            onFocusedRowChange={setFocusedRowIndex}
            onSelectItemForLine={handleSelectItemForLine}
            onLineChange={handleLineChange}
            onRemoveLine={handleRemoveLine}
            onCopyLine={handleCopyLine}
            onAddItem={handleAddItem}
            onAddBlankLine={handleAddBlankLine}
          />

          <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-3 text-xs sm:grid-cols-5">
            <div className="rounded-lg border border-border/80 bg-muted/40 p-2.5">
              <div className="text-[11px] text-muted-foreground">{t('warehouse.itemCount')}</div>
              <div className="mt-1 font-mono text-sm font-bold text-foreground">{validLines.length}</div>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/40 p-2.5">
              <div className="text-[11px] text-muted-foreground">{t('warehouse.totalPurchaseVal')}</div>
              <div className="mt-1 font-mono text-sm font-bold text-foreground">
                {formatMoney2(doc.totalPurchaseValue, true)}
              </div>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/40 p-2.5">
              <div className="text-[11px] text-muted-foreground">{t('warehouse.transferOutStore')}</div>
              <div className="mt-1 font-mono text-sm font-bold text-foreground">
                {formatMoney2(doc.totalSourceRetailValue, true)}
              </div>
            </div>
            <div className="rounded-lg border border-success/30 bg-success/5 p-2.5">
              <div className="text-[11px] font-semibold text-success">{t('warehouse.transferInStore')}</div>
              <div className="mt-1 font-mono text-sm font-bold text-success">
                {formatMoney2(doc.totalTargetRetailValue, true)}
              </div>
            </div>
            <div className="rounded-lg border border-primary/40 bg-primary/10 p-2.5">
              <div className="text-[11px] font-bold uppercase text-primary">{t('warehouse.priceDifference')}</div>
              <div className="mt-1 font-mono text-base font-extrabold text-foreground">
                {formatMoney2(priceDifferenceTotal, true)}
              </div>
            </div>
          </div>

          <KeyboardShortcutsBar />
        </div>
      )}
    </Dialog>
  );
}
