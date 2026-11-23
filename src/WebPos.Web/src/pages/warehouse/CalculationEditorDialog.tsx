import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Save, Printer, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { t } from '../../i18n';
import { d } from '../../lib/money';
import {
  focusItemPickerInRow,
  useDocumentShortcuts,
} from '../../lib/keyboardGridUtils';
import type { ActionResult } from '../../store/storeTypes';
import type {
  CalculationDocument, Company, Item, Partner, StoreItemPrice, StoreLocation, VatRate,
} from '../../types/domain';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { DocumentStatusBadge } from '../../components/ui/Badge';
import { KeyboardShortcutsBar } from '../../components/ui/KeyboardShortcutsBar';
import { showToast } from '../../components/ui/Toast';
import { CalculationZtrPanel } from './CalculationZtrPanel';
import { CalculationLinesTable } from './CalculationLinesTable';
import { CalculationRecapPanel } from './CalculationRecapPanel';
import { CalculationPrintView } from './CalculationPrintView';
import { CalculationHeaderPanel } from './CalculationHeaderPanel';
import { exportCalculationToExcel } from './calculationExcelExport';
import { useCalculationEditorState } from './useCalculationEditorState';

interface CalculationEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDoc: CalculationDocument;
  company: Company;
  storeLocations: StoreLocation[];
  partners: Partner[];
  items: Item[];
  vatRates: VatRate[];
  storePrices: StoreItemPrice[];
  onSaveDraft: (doc: CalculationDocument) => Promise<ActionResult>;
  onPostDocument: (doc: CalculationDocument) => Promise<ActionResult>;
  onAutoSave?: (doc: CalculationDocument) => Promise<ActionResult>;
}

export function CalculationEditorDialog({
  open,
  onOpenChange,
  initialDoc,
  company,
  storeLocations,
  partners,
  items,
  vatRates,
  storePrices,
  onSaveDraft,
  onPostDocument,
  onAutoSave,
}: CalculationEditorDialogProps) {
  const {
    doc,
    setDoc,
    isPrintPreview,
    setIsPrintPreview,
    isReadOnly,
    currentStore,
    currentPartner,
    supplierOptions,
    storeOptions,
    freight,
    customs,
    handling,
    other,
    totalZtr,
    allocMethod,
    grossInv,
    totalDisc,
    totalQty,
    handleAddItem,
    handleAddBlankLine,
    handleSelectItemForLine,
    handleCopyLine,
    handleRemoveLine,
    handleUpdateLineField,
    handleZtrChange,
    handleAllocationMethodChange,
    handleStoreChange,
  } = useCalculationEditorState({
    initialDoc,
    company,
    storeLocations,
    partners,
    items,
    vatRates,
    storePrices,
  });

  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isSaving, setIsSaving] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [focusedRowIndex, setFocusedRowIndex] = useState(0);
  const isBusy = isSaving || isPosting;

  const isInitialMount = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const canAutoSave = useCallback((candidate: CalculationDocument) => {
    return (
      candidate.status === 'DRAFT' &&
      Boolean(candidate.partnerId) &&
      candidate.lines.some((l) => Boolean(l.itemId))
    );
  }, []);

  const sanitizeForPersist = useCallback((candidate: CalculationDocument): CalculationDocument => {
    return {
      ...candidate,
      lines: candidate.lines.filter((l) => Boolean(l.itemId)),
    };
  }, []);

  const runAutoSave = useCallback(
    async (candidate: CalculationDocument) => {
      if (!onAutoSave || !canAutoSave(candidate)) return;
      setAutoSaveStatus('saving');
      const res = await onAutoSave(sanitizeForPersist(candidate));
      if (res.ok) {
        isDirtyRef.current = false;
        setAutoSaveStatus('saved');
      } else {
        setAutoSaveStatus('error');
      }
    },
    [onAutoSave, canAutoSave, sanitizeForPersist]
  );

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (doc.status !== 'DRAFT' || isBusy) return;
    isDirtyRef.current = true;
    if (!canAutoSave(doc)) {
      setAutoSaveStatus('idle');
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void runAutoSave(doc);
    }, 600);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [doc, isBusy, canAutoSave, runAutoSave]);

  const handleClose = () => {
    if (isBusy) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (doc.status === 'DRAFT' && isDirtyRef.current && canAutoSave(doc)) {
      void runAutoSave(doc);
    }
    onOpenChange(false);
  };

  const handleManualSave = async () => {
    if (isBusy) return;
    if (!doc.partnerId) {
      showToast({ title: 'Odaberite dobavljača prije snimanja kalkulacije.', variant: 'error' });
      return;
    }
    const validLines = doc.lines.filter((l) => Boolean(l.itemId));
    if (validLines.length === 0) {
      showToast({ title: 'Dodajte barem jedan artikal prije snimanja nacrta.', variant: 'error' });
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsSaving(true);
    try {
      const res = await onSaveDraft(sanitizeForPersist(doc));
      if (res.ok) {
        isDirtyRef.current = false;
        setAutoSaveStatus('saved');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualPost = async () => {
    if (isBusy) return;
    if (!doc.partnerId) {
      showToast({ title: 'Odaberite dobavljača prije knjiženja kalkulacije.', variant: 'error' });
      return;
    }
    const validLines = doc.lines.filter((l) => Boolean(l.itemId));
    if (validLines.length === 0) {
      showToast({ title: 'Dodajte barem jedan artikal prije knjiženja dokumenta.', variant: 'error' });
      return;
    }
    if (validLines.some((l) => d(l.quantity).lte(0))) {
      showToast({ title: 'Količina na svim stavkama mora biti veća od nule.', variant: 'error' });
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsPosting(true);
    try {
      await onPostDocument(sanitizeForPersist(doc));
    } finally {
      setIsPosting(false);
    }
  };

  const validLines = doc.lines.filter((l) => Boolean(l.itemId));
  const canPost =
    Boolean(doc.partnerId) &&
    validLines.length > 0 &&
    !validLines.some((l) => d(l.quantity).lte(0));

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
      if (focusedRowIndex >= 0 && focusedRowIndex < doc.lines.length) {
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
      title={`${t('warehouse.calculationWorkspace')} — ${doc.docNumber}`}
      size="full"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsPrintPreview(!isPrintPreview)}>
              <Printer className="h-3.5 w-3.5" />
              <span>{isPrintPreview ? t('warehouse.backToEdit') : t('warehouse.printCalculation')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportCalculationToExcel(doc, items, currentStore.storeType)}>
              <FileSpreadsheet className="h-3.5 w-3.5 text-success" /><span>{t('common.exportExcel')}</span>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isBusy}>{t('common.close')}</Button>
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
                  <CheckCircle2 className="h-4 w-4" /><span>{t('warehouse.confirmCalculation')}</span>
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      {isPrintPreview ? (
        <CalculationPrintView
          doc={doc}
          company={company}
          storeLocation={currentStore}
          partner={currentPartner}
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

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <div className="lg:col-span-3">
              <CalculationHeaderPanel
                doc={doc}
                isReadOnly={isReadOnly}
                supplierOptions={supplierOptions}
                storeOptions={storeOptions}
                onSupplierChange={(val) => setDoc({ ...doc, partnerId: val })}
                onStoreChange={handleStoreChange}
                onFieldChange={(field, val) => setDoc({ ...doc, [field]: val })}
              />
            </div>
            <CalculationZtrPanel
              freight={freight}
              customs={customs}
              handling={handling}
              other={other}
              totalZtr={totalZtr}
              allocationMethod={allocMethod}
              disabled={isReadOnly}
              onZtrChange={handleZtrChange}
              onAllocationMethodChange={handleAllocationMethodChange}
            />
          </div>

          <CalculationLinesTable
            lines={doc.lines}
            items={items}
            storePrices={storePrices}
            activeStoreId={doc.storeId}
            storeType={currentStore.storeType}
            isReadOnly={isReadOnly}
            tbodyRef={tbodyRef}
            searchInputRef={searchInputRef}
            onFocusedRowChange={setFocusedRowIndex}
            onUpdateLineField={handleUpdateLineField}
            onSelectItemForLine={handleSelectItemForLine}
            onRemoveLine={handleRemoveLine}
            onCopyLine={handleCopyLine}
            onAddItem={handleAddItem}
            onAddBlankLine={handleAddBlankLine}
          />

          <CalculationRecapPanel
            itemCount={validLines.length}
            totalQuantity={totalQty}
            grossInvoiceValue={grossInv}
            totalDiscount={totalDisc}
            totalZtr={totalZtr}
            totalPurchaseValue={doc.totalPurchaseValue}
            totalMarginAmount={doc.totalMarginAmount}
            totalVatAmount={doc.totalEmbeddedVatAmount}
            totalRetailValueWithVat={doc.totalRetailValueWithVat}
            totalSellingValueExclVat={doc.totalSellingValueExclVat}
            storeType={currentStore.storeType}
          />

          <KeyboardShortcutsBar />
        </div>
      )}
    </Dialog>
  );
}
