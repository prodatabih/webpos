import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  CheckCircle2,
  Save,
  Barcode,
  Printer,
  FileSpreadsheet,
  Search,
  Copy,
  X,
  PackageCheck,
  AlertCircle,
} from 'lucide-react';
import { t } from '../../i18n';
import { d, formatMoney2, formatQty } from '../../lib/money';
import { generateUuidV7 } from '../../lib/utils';
import type { ActionResult } from '../../store/storeTypes';
import type {
  Company,
  InventoryCountDocument,
  InventoryCountLine,
  Item,
  StoreItemPrice,
  StoreLocation,
  VatRate,
} from '../../types/domain';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { NumericInput } from '../../components/ui/NumericInput';
import { Combobox, type ComboboxOption } from '../../components/ui/Combobox';
import { KeyboardShortcutsBar } from '../../components/ui/KeyboardShortcutsBar';
import { DocumentStatusBadge } from '../../components/ui/Badge';
import { showToast } from '../../components/ui/Toast';
import {
  advanceGridFocus,
  focusFirstNumericCellInRow,
  focusItemPickerInRow,
  useDocumentShortcuts,
} from '../../lib/keyboardGridUtils';
import { InventoryCountPrintView } from './InventoryCountPrintView';
import { InventoryCountRecapPanel } from './InventoryCountRecapPanel';
import {
  buildCountLine,
  exportInventoryCountToExcel,
  recomputeInventoryCountTotals,
} from './inventoryCountUtils';

export function buildBlankInventoryCountLine(): InventoryCountLine {
  return {
    id: generateUuidV7(),
    itemId: '',
    bookQuantity: '0.0000',
    countedQuantity: '0.0000',
    differenceQuantity: '0.0000',
    purchaseUnitPrice: '0.0000',
    retailUnitPriceWithVat: '0.00',
    vatRatePercent: '17.00',
    surplusRetailValue: '0.00',
    shortageRetailValue: '0.00',
    allowedWasteQuantity: '0.0000',
    allowedWasteRetailValue: '0.00',
    unrecognizedShortageQuantity: '0.0000',
    unrecognizedShortageRetailValue: '0.00',
    unrecognizedShortageVat: '0.00',
  };
}

interface InventoryCountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDoc: InventoryCountDocument;
  company: Company;
  storeLocation: StoreLocation;
  items: Item[];
  vatRates: VatRate[];
  storePrices: StoreItemPrice[];
  onSaveDraft: (doc: InventoryCountDocument) => Promise<ActionResult>;
  onPostDocument: (doc: InventoryCountDocument) => Promise<ActionResult>;
  onAutoSave?: (doc: InventoryCountDocument) => Promise<ActionResult>;
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
  onAutoSave,
}: InventoryCountDialogProps) {
  const [doc, setDoc] = useState<InventoryCountDocument>(() =>
    initialDoc.status === 'DRAFT' && initialDoc.lines.length === 0
      ? { ...initialDoc, lines: [buildBlankInventoryCountLine()] }
      : initialDoc
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isScannerMode, setIsScannerMode] = useState(false);
  const [scanText, setScanText] = useState('');
  const [printMode, setPrintMode] = useState<'NONE' | 'ALL' | 'SURPLUS' | 'SHORTAGE'>('NONE');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isSaving, setIsSaving] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  const scanInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const activeRowIndexRef = useRef<number>(0);
  const isInitialMount = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);

  const isReadOnly = doc.status !== 'DRAFT';
  const isBusy = isSaving || isPosting;

  const canAutoSave = useCallback((candidate: InventoryCountDocument) => {
    return candidate.status === 'DRAFT' && candidate.lines.some((l) => Boolean(l.itemId));
  }, []);

  const sanitizeForPersist = useCallback(
    (candidate: InventoryCountDocument): InventoryCountDocument => {
      const valid = candidate.lines.filter((l) => Boolean(l.itemId));
      return recomputeInventoryCountTotals(candidate, valid);
    },
    []
  );

  const cancelPendingAutoSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runAutoSave = useCallback(
    async (candidate: InventoryCountDocument) => {
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
    cancelPendingAutoSave();
    timerRef.current = setTimeout(() => {
      void runAutoSave(doc);
    }, 600);
    return cancelPendingAutoSave;
  }, [doc, isBusy, canAutoSave, cancelPendingAutoSave, runAutoSave]);

  const handleClose = () => {
    if (isBusy) return;
    cancelPendingAutoSave();
    if (doc.status === 'DRAFT' && isDirtyRef.current && canAutoSave(doc)) {
      void runAutoSave(doc);
    }
    onOpenChange(false);
  };

  const comboboxOptions = useMemo<ComboboxOption[]>(
    () =>
      items
        .filter((it) => it.isActive)
        .map((it) => {
          const sp = storePrices.find((p) => p.storeId === doc.storeId && p.itemId === it.id);
          return {
            value: it.id,
            label: it.name,
            code: it.sku,
            barcode: it.primaryBarcode,
            price: sp?.retailUnitPriceWithVat,
            stockQty: sp?.currentStockQty,
            uom: it.uom,
          };
        }),
    [items, storePrices, doc.storeId]
  );

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const active = items.filter((it) => it.isActive);
    if (!q) return active.slice(0, 15);
    return active
      .filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          it.sku.toLowerCase().includes(q) ||
          it.primaryBarcode.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [items, searchTerm]);

  const createLineForItem = (item: Item, lineId?: string, overrideCounted?: string): InventoryCountLine => {
    const priceRec = storePrices.find((p) => p.storeId === doc.storeId && p.itemId === item.id);
    const vatRate = vatRates.find((v) => v.id === item.vatRateId)?.ratePercent ?? '17.00';
    const bookQty = priceRec?.currentStockQty ?? '0.0000';
    return buildCountLine({
      id: lineId ?? generateUuidV7(),
      itemId: item.id,
      bookQuantity: bookQty,
      countedQuantity: overrideCounted ?? bookQty,
      purchaseUnitPrice: priceRec?.purchaseUnitPrice ?? '0.0000',
      retailUnitPriceWithVat: priceRec?.retailUnitPriceWithVat ?? '0.00',
      vatRatePercent: vatRate,
    });
  };

  const handleAddItem = (item: Item) => {
    if (isReadOnly) return;
    const nextLine = createLineForItem(item);
    const baseLines =
      doc.lines.length === 1 && !doc.lines[0]?.itemId ? [nextLine] : [...doc.lines, nextLine];
    setDoc(recomputeInventoryCountTotals(doc, baseLines));
  };

  const handleAddBlankLine = () => {
    if (isReadOnly) return;
    setDoc((prev) => ({ ...prev, lines: [...prev.lines, buildBlankInventoryCountLine()] }));
  };

  const handleAddBlankLineAndFocus = () => {
    if (isReadOnly) return;
    const nextIdx = doc.lines.length;
    setDoc((prev) => ({ ...prev, lines: [...prev.lines, buildBlankInventoryCountLine()] }));
    requestAnimationFrame(() => {
      setTimeout(() => {
        focusItemPickerInRow(tbodyRef.current, nextIdx, true);
      }, 30);
    });
  };

  const getActiveRowIndex = (): number => {
    const activeTr = document.activeElement?.closest?.('tr[data-row-index]');
    if (activeTr) {
      const parsed = Number(activeTr.getAttribute('data-row-index'));
      if (Number.isInteger(parsed) && parsed >= 0 && parsed < doc.lines.length) {
        return parsed;
      }
    }
    return Math.min(activeRowIndexRef.current, Math.max(0, doc.lines.length - 1));
  };

  const handleSelectItemForLine = (lineId: string, itemId: string) => {
    if (isReadOnly) return;
    if (!itemId) {
      const nextLines = doc.lines.map((l) =>
        l.id === lineId ? buildBlankInventoryCountLine() : l
      );
      setDoc(recomputeInventoryCountTotals(doc, nextLines));
      return;
    }
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const nextLines = doc.lines.map((l) => (l.id === lineId ? createLineForItem(item, l.id) : l));
    setDoc(recomputeInventoryCountTotals(doc, nextLines));
  };

  const handleCopyLine = (idx: number) => {
    if (isReadOnly) return;
    const lineToCopy = doc.lines[idx];
    if (!lineToCopy) return;
    const copied = { ...lineToCopy, id: generateUuidV7() };
    const nextLines = [...doc.lines.slice(0, idx + 1), copied, ...doc.lines.slice(idx + 1)];
    setDoc(recomputeInventoryCountTotals(doc, nextLines));
  };

  const handleRemoveLine = (lineId: string) => {
    if (isReadOnly) return;
    setDoc(recomputeInventoryCountTotals(doc, doc.lines.filter((l) => l.id !== lineId)));
  };

  const handleLoadAllStockItems = () => {
    if (isReadOnly) return;
    const existingItemIds = new Set(doc.lines.filter((l) => Boolean(l.itemId)).map((l) => l.itemId));
    const stockLines: InventoryCountLine[] = [];

    for (const sp of storePrices) {
      if (sp.storeId !== doc.storeId) continue;
      if (d(sp.currentStockQty || '0').lte(0)) continue;
      if (existingItemIds.has(sp.itemId)) continue;
      const item = items.find((i) => i.id === sp.itemId && i.isActive);
      if (!item) continue;
      stockLines.push(createLineForItem(item));
      existingItemIds.add(sp.itemId);
    }

    if (stockLines.length === 0) {
      showToast({
        title: 'Nema dodatnih artikala sa pozitivnim stanjem zalihe u odabranom objektu.',
        variant: 'info',
      });
      return;
    }

    const existingFilledLines = doc.lines.filter((l) => Boolean(l.itemId));
    setDoc(recomputeInventoryCountTotals(doc, [...existingFilledLines, ...stockLines]));
    showToast({
      title: `Učitano ${stockLines.length} artikala sa stanjem zalihe.`,
      variant: 'success',
    });
  };

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = scanText.trim().toLowerCase();
    if (!query) return;
    const matched = items.find(
      (i) =>
        i.isActive &&
        (i.primaryBarcode.toLowerCase() === query || i.sku.toLowerCase() === query)
    );
    if (matched) {
      const existingIdx = doc.lines.findIndex((l) => l.itemId === matched.id);
      if (existingIdx >= 0) {
        const nextLines = doc.lines.map((l, idx) =>
          idx === existingIdx
            ? buildCountLine({ ...l, countedQuantity: d(l.countedQuantity).plus(1).toString() })
            : l
        );
        setDoc(recomputeInventoryCountTotals(doc, nextLines));
      } else {
        const nextLine = createLineForItem(matched, undefined, '1.0000');
        const baseLines =
          doc.lines.length === 1 && !doc.lines[0]?.itemId ? [nextLine] : [...doc.lines, nextLine];
        setDoc(recomputeInventoryCountTotals(doc, baseLines));
      }
    } else {
      showToast({ title: `Artikal za kod "${scanText.trim()}" nije pronađen.`, variant: 'error' });
    }
    setScanText('');
    scanInputRef.current?.focus();
  };

  const validLines = doc.lines.filter((l) => Boolean(l.itemId));

  const handleManualSave = async () => {
    if (isBusy) return;
    if (validLines.length === 0) {
      showToast({ title: 'Dodajte barem jedan artikal prije snimanja nacrta.', variant: 'error' });
      return;
    }
    cancelPendingAutoSave();
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
    if (validLines.length === 0) {
      showToast({ title: 'Dodajte barem jedan artikal prije knjiženja popisa.', variant: 'error' });
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
    isReadOnly,
    onSave: () => void handleManualSave(),
    onPost: () => void handleManualPost(),
    onPrint: () => setPrintMode((prev) => (prev === 'ALL' ? 'NONE' : 'ALL')),
    onFocusSearch: () => {
      if (printMode !== 'NONE') return;
      if (isScannerMode && scanInputRef.current) {
        scanInputRef.current.focus();
        scanInputRef.current.select();
      } else if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select();
      }
    },
    onAddRow: () => {
      if (printMode === 'NONE') {
        handleAddBlankLineAndFocus();
      }
    },
    onDuplicateRow: () => {
      if (printMode !== 'NONE') return;
      const idx = getActiveRowIndex();
      if (doc.lines[idx]?.itemId) {
        handleCopyLine(idx);
      }
    },
    onDeleteRow: () => {
      if (printMode !== 'NONE') return;
      const idx = getActiveRowIndex();
      const targetLine = doc.lines[idx];
      if (targetLine) {
        handleRemoveLine(targetLine.id);
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
      title={`${t('nav.inventoryCount')} — ${doc.docNumber}`}
      size="full"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPrintMode(printMode === 'ALL' ? 'NONE' : 'ALL')}>
              <Printer className="h-3.5 w-3.5" />
              <span>{printMode === 'ALL' ? t('warehouse.backToEdit') : t('warehouse.printInventoryList')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPrintMode(printMode === 'SURPLUS' ? 'NONE' : 'SURPLUS')}>
              <Printer className="h-3.5 w-3.5 text-success" /><span>{t('warehouse.printSurplusList')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPrintMode(printMode === 'SHORTAGE' ? 'NONE' : 'SHORTAGE')}>
              <Printer className="h-3.5 w-3.5 text-destructive" /><span>{t('warehouse.printShortageList')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportInventoryCountToExcel(sanitizeForPersist(doc), items)}>
              <FileSpreadsheet className="h-3.5 w-3.5 text-success" /><span>{t('common.exportExcel')}</span>
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
      {printMode !== 'NONE' ? (
        <InventoryCountPrintView
          doc={sanitizeForPersist(doc)}
          company={company}
          storeLocation={storeLocation}
          items={items}
          initialMode={printMode}
          onBack={() => setPrintMode('NONE')}
        />
      ) : (
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
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
            <div className="flex items-center gap-2">
              {!isReadOnly && (
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
              )}
              {isReadOnly && (
                <span className="text-muted-foreground">{t('messages.postedImmutableError')}</span>
              )}
            </div>
          </div>

          {!isReadOnly && <KeyboardShortcutsBar />}

          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                label={t('warehouse.commissionMembers')}
                value={doc.commissionMembers}
                disabled={isReadOnly}
                onChange={(e) => setDoc({ ...doc, commissionMembers: e.target.value })}
              />
              <Input
                label={t('common.notes')}
                value={doc.notes}
                disabled={isReadOnly}
                onChange={(e) => setDoc({ ...doc, notes: e.target.value })}
                placeholder="Napomena uz popis..."
              />
            </div>
          </div>

          {isScannerMode && !isReadOnly && (
            <form
              onSubmit={handleScanSubmit}
              className="flex items-center gap-2 rounded-xl border-2 border-primary/50 bg-primary/5 p-3"
            >
              <Barcode className="h-5 w-5 text-primary" />
              <input
                ref={scanInputRef}
                type="text"
                value={scanText}
                onChange={(e) => setScanText(e.target.value)}
                placeholder={t('warehouse.scanOrTypeBarcode')}
                className="h-9 flex-1 rounded-lg border border-input bg-background px-3 font-mono text-xs focus:ring-1 focus:ring-ring"
              />
              <Button type="submit" variant="primary" size="sm">
                {t('common.add')}
              </Button>
            </form>
          )}

          {!isReadOnly && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1 rounded-xl border border-border bg-card p-2 shadow-xs">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 180)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchTerm.trim() && filteredItems.length > 0) {
                        e.preventDefault();
                        const first = filteredItems[0];
                        if (first) {
                          handleAddItem(first);
                          setSearchTerm('');
                          setShowDropdown(false);
                        }
                      }
                    }}
                    placeholder={t('warehouse.fastItemSearchPlaceholder')}
                    className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                  />
                </div>

                {showDropdown && filteredItems.length > 0 && (
                  <div className="absolute left-0 right-0 top-14 z-50 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-xl divide-y divide-border">
                    {filteredItems.map((item) => {
                      const sp = storePrices.find(
                        (p) => p.storeId === doc.storeId && p.itemId === item.id
                      );
                      return (
                        <div
                          key={item.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleAddItem(item);
                            setSearchTerm('');
                            setShowDropdown(false);
                          }}
                          className="flex cursor-pointer items-center justify-between p-2.5 text-xs hover:bg-muted/60"
                        >
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary">
                              {item.sku}
                            </span>
                            <div>
                              <div className="font-semibold text-foreground">{item.name}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {item.primaryBarcode} · {item.uom}
                              </div>
                            </div>
                          </div>
                          <div className="text-right font-mono">
                            <div className="font-semibold text-success">
                              MPC: {formatMoney2(sp?.retailUnitPriceWithVat ?? '0.00', true)}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {t('master.currentStock')}: {formatQty(sp?.currentStockQty ?? '0', 2)} {item.uom}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Button variant="outline" size="sm" onClick={handleLoadAllStockItems}>
                <PackageCheck className="h-4 w-4 text-primary" />
                <span>Učitaj sve artikle sa stanjem</span>
              </Button>
              <Button variant="secondary" size="sm" onClick={handleAddBlankLineAndFocus}>
                <Plus className="h-4 w-4" />
                <span>{t('warehouse.emptyLine')}</span>
              </Button>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b border-border bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-2 py-2 text-center w-8">#</th>
                  <th className="px-2 py-2 min-w-[220px]">{t('common.name')}</th>
                  <th className="px-2 py-2 text-center w-12">{t('common.uom')}</th>
                  <th className="px-2 py-2 text-right w-20">{t('warehouse.bookQuantity')}</th>
                  <th className="px-2 py-2 text-right w-24 font-bold text-primary">{t('warehouse.countedQuantity')}</th>
                  <th className="px-2 py-2 text-right w-20">{t('warehouse.priceDifference')}</th>
                  <th className="px-2 py-2 text-right w-20">{t('warehouse.retailPriceWithVat')}</th>
                  <th className="px-2 py-2 text-right w-24 text-success">{t('warehouse.surplusValue')}</th>
                  <th className="px-2 py-2 text-right w-24">{t('warehouse.allowedWasteQty')}</th>
                  <th className="px-2 py-2 text-right w-24 text-destructive">{t('warehouse.unrecognizedShortageValue')}</th>
                  <th className="px-2 py-2 text-right w-20">{t('warehouse.unrecognizedShortageVat')}</th>
                  {!isReadOnly && <th className="px-2 py-2 text-center w-16">{t('common.actions')}</th>}
                </tr>
              </thead>
              <tbody ref={tbodyRef} className="divide-y divide-border font-mono text-[11px]">
                {doc.lines.map((line, idx) => {
                  const item = items.find((i) => i.id === line.itemId);
                  const diffDec = d(line.differenceQuantity || '0');
                  const isWasteDisabled = isReadOnly || !line.itemId || diffDec.gte(0);
                  const isLastRow = idx === doc.lines.length - 1;
                  const handleAdvance = (currentEl: HTMLElement) => {
                    advanceGridFocus({
                      tbodyEl: tbodyRef.current,
                      rowIndex: idx,
                      currentEl,
                      isLastRow,
                      hasSelectedItem: Boolean(line.itemId),
                      onAddRow: handleAddBlankLine,
                    });
                  };

                  return (
                    <tr
                      key={line.id}
                      data-row-index={idx}
                      onFocus={() => {
                        activeRowIndexRef.current = idx;
                      }}
                      className="hover:bg-muted/30"
                    >
                      <td className="px-2 py-1.5 text-center text-muted-foreground">{idx + 1}</td>
                      <td className="px-2 py-1.5 font-sans min-w-[220px]">
                        {!line.itemId ? (
                          <Combobox
                            options={comboboxOptions}
                            value=""
                            dataGridItemPicker={true}
                            onAfterSelect={() => focusFirstNumericCellInRow(tbodyRef.current, idx)}
                            onChange={(val) => handleSelectItemForLine(line.id, val)}
                            placeholder={t('warehouse.selectItem')}
                            searchPlaceholder={t('warehouse.searchItemPlaceholder')}
                            className="w-full"
                          />
                        ) : (
                          <div className="flex items-center justify-between gap-1 group">
                            <div>
                              <div className="font-medium text-foreground">{item?.name ?? line.itemId}</div>
                              <div className="font-mono text-[10px] text-muted-foreground">
                                {item?.sku ?? '-'} {item?.primaryBarcode ? `· ${item.primaryBarcode}` : ''}
                              </div>
                            </div>
                            {!isReadOnly && (
                              <button
                                type="button"
                                tabIndex={-1}
                                onClick={() => handleSelectItemForLine(line.id, '')}
                                title={t('warehouse.changeItem')}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                <Search className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center font-sans text-muted-foreground">
                        {item?.uom ?? 'KOM'}
                      </td>
                      <td className="px-2 py-1.5 text-right">{formatQty(line.bookQuantity, 2)}</td>
                      <td className="px-1 py-1.5 text-right">
                        <NumericInput
                          decimals={4}
                          min={0}
                          data-grid-cell="true"
                          disabled={isReadOnly || !line.itemId}
                          value={line.countedQuantity}
                          onChange={(val) =>
                            setDoc((prev) =>
                              recomputeInventoryCountTotals(
                                prev,
                                prev.lines.map((l) =>
                                  l.id === line.id
                                    ? buildCountLine({ ...l, countedQuantity: val })
                                    : l
                                )
                              )
                            )
                          }
                          onEnterKey={(e) => handleAdvance(e.currentTarget)}
                          onTabForward={
                            isWasteDisabled
                              ? (e) => {
                                  if (Boolean(line.itemId)) {
                                    e.preventDefault();
                                    handleAdvance(e.currentTarget);
                                  }
                                }
                              : undefined
                          }
                          className="h-7 w-24 rounded border border-primary/50 bg-background px-1.5 text-right font-mono font-bold text-xs text-foreground"
                        />
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right font-semibold ${
                          diffDec.gt(0)
                            ? 'text-success'
                            : diffDec.lt(0)
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {formatQty(line.differenceQuantity, 2)}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {formatMoney2(line.retailUnitPriceWithVat, true)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold text-success">
                        {formatMoney2(line.surplusRetailValue, true)}
                      </td>
                      <td className="px-1 py-1.5 text-right">
                        <NumericInput
                          decimals={4}
                          min={0}
                          data-grid-cell="true"
                          disabled={isWasteDisabled}
                          value={line.allowedWasteQuantity ?? '0.0000'}
                          onChange={(val) =>
                            setDoc((prev) =>
                              recomputeInventoryCountTotals(
                                prev,
                                prev.lines.map((l) =>
                                  l.id === line.id
                                    ? buildCountLine({ ...l, allowedWasteQuantity: val })
                                    : l
                                )
                              )
                            )
                          }
                          onEnterKey={(e) => handleAdvance(e.currentTarget)}
                          onTabForward={(e) => {
                            if (Boolean(line.itemId)) {
                              e.preventDefault();
                              handleAdvance(e.currentTarget);
                            }
                          }}
                          className="h-7 w-24 rounded border border-input bg-background px-1.5 text-right font-mono text-xs"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold text-destructive">
                        {formatMoney2(
                          line.unrecognizedShortageRetailValue ?? line.shortageRetailValue,
                          true
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right text-muted-foreground">
                        {formatMoney2(line.unrecognizedShortageVat ?? '0.00', true)}
                      </td>
                      {!isReadOnly && (
                        <td className="px-1 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              tabIndex={-1}
                              title={t('warehouse.copyLine')}
                              disabled={!line.itemId}
                              onClick={() => handleCopyLine(idx)}
                            >
                              <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              tabIndex={-1}
                              title={t('warehouse.deleteLine')}
                              onClick={() => handleRemoveLine(line.id)}
                            >
                              <X className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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
