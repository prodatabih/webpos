import { useCallback, useRef, useState } from 'react';
import { CheckCircle2, Save, Printer, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { t } from '../../i18n';
import { formatMoney2 } from '../../lib/money';
import type { ActionResult } from '../../store/storeTypes';
import type {
  Company,
  Item,
  PriceLevelingDocument,
  StoreItemPrice,
  StoreLocation,
  VatRate,
} from '../../types/domain';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DocumentStatusBadge } from '../../components/ui/Badge';
import { showToast } from '../../components/ui/Toast';
import { PriceLevelingPrintView } from './PriceLevelingPrintView';
import { PriceLevelingLinesTable } from './PriceLevelingLinesTable';
import { exportPriceLevelingToExcel } from './priceLevelingExcelExport';
import { usePriceLevelingEditorState } from './usePriceLevelingEditorState';

interface PriceLevelingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDoc: PriceLevelingDocument;
  company: Company;
  storeLocation: StoreLocation;
  items: Item[];
  vatRates: VatRate[];
  storePrices: StoreItemPrice[];
  onSaveDraft: (doc: PriceLevelingDocument) => Promise<ActionResult>;
  onPostDocument: (doc: PriceLevelingDocument) => Promise<ActionResult>;
  onAutoSave?: (doc: PriceLevelingDocument) => Promise<ActionResult>;
}

export function PriceLevelingDialog({
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
  onAutoSave,
}: PriceLevelingDialogProps) {
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isSaving, setIsSaving] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const isBusy = isSaving || isPosting;
  const isBusyRef = useRef(false);
  isBusyRef.current = isBusy;
  const lastSavedSignatureRef = useRef<string | null>(null);

  const sanitizeForPersist = useCallback((candidate: PriceLevelingDocument): PriceLevelingDocument => {
    return {
      ...candidate,
      lines: candidate.lines.filter((l) => Boolean(l.itemId)),
    };
  }, []);

  const guardedAutoSave = useCallback(
    (candidate: PriceLevelingDocument) => {
      if (!onAutoSave || isBusyRef.current || candidate.status !== 'DRAFT') return;
      const validLines = candidate.lines.filter((l) => Boolean(l.itemId));
      if (validLines.length === 0) {
        setAutoSaveStatus('idle');
        return;
      }
      const sanitized = { ...candidate, lines: validLines };
      const sig = JSON.stringify({
        docNumber: sanitized.docNumber,
        docDate: sanitized.docDate,
        reason: sanitized.reason,
        lines: sanitized.lines,
      });
      if (sig === lastSavedSignatureRef.current) return;

      setAutoSaveStatus('saving');
      void onAutoSave(sanitized).then((res) => {
        if (res.ok) {
          lastSavedSignatureRef.current = sig;
          setAutoSaveStatus('saved');
        } else {
          setAutoSaveStatus('error');
        }
      });
    },
    [onAutoSave]
  );

  const {
    doc,
    setDoc,
    isPrintPreview,
    setIsPrintPreview,
    isReadOnly,
    handleClose,
    handleAddItem,
    handleAddBlankLine,
    handleSelectItemForLine,
    handleNewPriceChange,
    handleCopyLine,
    handleRemoveLine,
  } = usePriceLevelingEditorState({
    initialDoc,
    items,
    vatRates,
    storePrices,
    onAutoSave: guardedAutoSave,
    onOpenChange,
  });

  const validLines = doc.lines.filter((l) => Boolean(l.itemId));

  const handleAddItemSmart = (item: Item) => {
    const firstLine = doc.lines[0];
    if (doc.lines.length === 1 && firstLine && !firstLine.itemId) {
      handleSelectItemForLine(firstLine.id, item.id);
      return;
    }
    handleAddItem(item);
  };

  const handleManualSave = async () => {
    if (isBusy) return;
    if (validLines.length === 0) {
      showToast({ title: 'Dodajte barem jedan artikal prije snimanja nacrta.', variant: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const sanitized = sanitizeForPersist(doc);
      const res = await onSaveDraft(sanitized);
      if (res.ok) {
        lastSavedSignatureRef.current = JSON.stringify({
          docNumber: sanitized.docNumber,
          docDate: sanitized.docDate,
          reason: sanitized.reason,
          lines: sanitized.lines,
        });
        setAutoSaveStatus('saved');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualPost = async () => {
    if (isBusy) return;
    if (validLines.length === 0) {
      showToast({ title: 'Dodajte barem jedan artikal prije knjiženja nivelacije.', variant: 'error' });
      return;
    }
    setIsPosting(true);
    try {
      await onPostDocument(sanitizeForPersist(doc));
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          if (isBusy) return;
          handleClose();
          return;
        }
        onOpenChange(next);
      }}
      title={`${t('nav.priceLeveling')} — ${doc.docNumber}`}
      size="full"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsPrintPreview(!isPrintPreview)}>
              <Printer className="h-3.5 w-3.5" />
              <span>{isPrintPreview ? t('warehouse.backToEdit') : t('warehouse.printLeveling')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportPriceLevelingToExcel(doc, items)}>
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
                  disabled={validLines.length === 0 || isBusy}
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
        <PriceLevelingPrintView
          doc={doc}
          company={company}
          storeLocation={storeLocation}
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
              <Input
                label={t('common.description')}
                value={doc.reason}
                disabled={isReadOnly}
                onChange={(e) => setDoc({ ...doc, reason: e.target.value })}
                placeholder="Razlog promjene cijena..."
              />
            </div>
          </div>

          <PriceLevelingLinesTable
            lines={doc.lines}
            items={items}
            storePrices={storePrices}
            activeStoreId={doc.storeId}
            isReadOnly={isReadOnly}
            onSelectItemForLine={handleSelectItemForLine}
            onNewPriceChange={handleNewPriceChange}
            onRemoveLine={handleRemoveLine}
            onCopyLine={handleCopyLine}
            onAddItem={handleAddItemSmart}
            onAddBlankLine={handleAddBlankLine}
          />

          <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-3 text-xs sm:grid-cols-4">
            <div className="rounded-lg border border-border/80 bg-muted/40 p-2.5">
              <div className="text-[11px] text-muted-foreground">{t('warehouse.itemCount')}</div>
              <div className="mt-1 font-mono text-sm font-bold text-foreground">{validLines.length}</div>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/40 p-2.5">
              <div className="text-[11px] text-muted-foreground">{t('warehouse.financialEffectMargin')}</div>
              <div className="mt-1 font-mono text-sm font-bold text-info">
                {formatMoney2(doc.totalMarginDifference, true)}
              </div>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/40 p-2.5">
              <div className="text-[11px] text-muted-foreground">{t('warehouse.financialEffectVat')}</div>
              <div className="mt-1 font-mono text-sm font-bold text-foreground">
                {formatMoney2(doc.totalVatDifference, true)}
              </div>
            </div>
            <div className="rounded-lg border border-primary/40 bg-primary/10 p-2.5">
              <div className="text-[11px] font-bold uppercase text-primary">{t('warehouse.financialEffectStock')}</div>
              <div className="mt-1 font-mono text-base font-extrabold text-foreground">
                {formatMoney2(doc.totalRetailDifference, true)}
              </div>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
