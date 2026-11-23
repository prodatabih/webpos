import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Decimal from 'decimal.js';
import {
  Plus,
  CheckCircle2,
  Save,
  Search,
  Copy,
  X,
  Printer,
  FileSpreadsheet,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { t } from '../../i18n';
import { d, formatMoney2, formatPrice4, formatQty, round2 } from '../../lib/money';
import { formatDateBs, generateUuidV7 } from '../../lib/utils';
import { exportToExcelSpreadsheet } from '../../lib/excelExport';
import type { ActionResult } from '../../store/storeTypes';
import type {
  Company,
  Item,
  OtherWarehouseDocSubtype,
  OtherWarehouseDocument,
  OtherWarehouseLine,
  Partner,
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

export type OtherWarehouseLineWithReason = OtherWarehouseLine & { reason?: string };

export function buildBlankOtherWarehouseLine(): OtherWarehouseLineWithReason {
  return {
    id: generateUuidV7(),
    itemId: '',
    quantity: '1.0000',
    purchaseUnitPrice: '0.0000',
    purchaseTotalValue: '0.00',
    retailUnitPriceWithVat: '0.00',
    retailTotalValueWithVat: '0.00',
    vatRatePercent: '17.00',
    reason: '',
  };
}

function formatSubtypeLabel(subtype: OtherWarehouseDocSubtype): string {
  if (subtype === 'WRITEOFF_KALORASTUR') return t('warehouse.subtypeWriteoff');
  if (subtype === 'INTERNAL_ISSUE') return t('warehouse.subtypeInternalIssue');
  if (subtype === 'INTERNAL_RECEIPT') return t('warehouse.subtypeInternalReceipt');
  if (subtype === 'SUPPLIER_RETURN') return t('warehouse.subtypeSupplierReturn');
  return t('warehouse.subtypeProduction');
}

function exportOtherDocToExcel(doc: OtherWarehouseDocument, items: Item[]): void {
  const validLines = (doc.lines as OtherWarehouseLineWithReason[]).filter((l) => Boolean(l.itemId));
  exportToExcelSpreadsheet({
    fileName: `interni_dokument_${doc.docNumber}`,
    sheetName: 'InterniDokument',
    columns: [
      { header: 'R.br', key: 'idx', type: 'number' },
      { header: 'Šifra', key: 'sku' },
      { header: 'Naziv artikla', key: 'name' },
      { header: 'JM', key: 'uom' },
      { header: 'Količina', key: 'quantity', type: 'number', numDecimals: 2 },
      { header: 'Nabavna cijena', key: 'purchaseUnitPrice', type: 'number', numDecimals: 4 },
      { header: 'Ukupno NC', key: 'purchaseTotalValue', type: 'number', numDecimals: 2 },
      { header: 'MP cijena', key: 'retailUnitPriceWithVat', type: 'number', numDecimals: 2 },
      { header: 'Ukupno MPC', key: 'retailTotalValueWithVat', type: 'number', numDecimals: 2 },
      { header: 'Razlog', key: 'reason' },
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
        retailUnitPriceWithVat: l.retailUnitPriceWithVat,
        retailTotalValueWithVat: l.retailTotalValueWithVat,
        reason: l.reason ?? '',
      };
    }),
    summaryRow: {
      name: 'UKUPNO',
      purchaseTotalValue: doc.totalPurchaseValue,
      retailTotalValueWithVat: doc.totalRetailValueWithVat,
    },
  });
}

interface OtherWarehouseDocDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDoc: OtherWarehouseDocument;
  company?: Company;
  storeLocation?: StoreLocation;
  items: Item[];
  partners: Partner[];
  vatRates: VatRate[];
  storePrices: StoreItemPrice[];
  onSaveDraft: (doc: OtherWarehouseDocument) => Promise<ActionResult>;
  onPostDocument: (doc: OtherWarehouseDocument) => Promise<ActionResult>;
  onAutoSave?: (doc: OtherWarehouseDocument) => Promise<ActionResult>;
}

export function OtherWarehouseDocDialog({
  open,
  onOpenChange,
  initialDoc,
  company,
  storeLocation,
  items,
  partners,
  vatRates,
  storePrices,
  onSaveDraft,
  onPostDocument,
  onAutoSave,
}: OtherWarehouseDocDialogProps) {
  const [doc, setDoc] = useState<OtherWarehouseDocument>(() =>
    initialDoc.status === 'DRAFT' && initialDoc.lines.length === 0
      ? { ...initialDoc, lines: [buildBlankOtherWarehouseLine()] }
      : initialDoc
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isPrintPreview, setIsPrintPreview] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isSaving, setIsSaving] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const activeRowIndexRef = useRef<number>(0);
  const isInitialMount = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);

  const isReadOnly = doc.status !== 'DRAFT';
  const isBusy = isSaving || isPosting;

  const recomputeDocTotals = useCallback(
    (baseDoc: OtherWarehouseDocument, nextLines: OtherWarehouseLineWithReason[]): OtherWarehouseDocument => ({
      ...baseDoc,
      lines: nextLines,
      totalPurchaseValue: round2(
        nextLines.reduce((a, l) => a.plus(d(l.purchaseTotalValue || '0')), new Decimal(0))
      ),
      totalRetailValueWithVat: round2(
        nextLines.reduce((a, l) => a.plus(d(l.retailTotalValueWithVat || '0')), new Decimal(0))
      ),
    }),
    []
  );

  const canAutoSave = useCallback((candidate: OtherWarehouseDocument) => {
    return candidate.status === 'DRAFT' && candidate.lines.some((l) => Boolean(l.itemId));
  }, []);

  const sanitizeForPersist = useCallback(
    (candidate: OtherWarehouseDocument): OtherWarehouseDocument => {
      const validLines = (candidate.lines as OtherWarehouseLineWithReason[]).filter((l) =>
        Boolean(l.itemId)
      );
      return recomputeDocTotals(candidate, validLines);
    },
    [recomputeDocTotals]
  );

  const cancelPendingAutoSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runAutoSave = useCallback(
    async (candidate: OtherWarehouseDocument) => {
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

  const subtypeOptions: Array<{ value: OtherWarehouseDocSubtype; label: string }> = [
    { value: 'WRITEOFF_KALORASTUR', label: t('warehouse.subtypeWriteoff') },
    { value: 'INTERNAL_ISSUE', label: t('warehouse.subtypeInternalIssue') },
    { value: 'INTERNAL_RECEIPT', label: t('warehouse.subtypeInternalReceipt') },
    { value: 'SUPPLIER_RETURN', label: t('warehouse.subtypeSupplierReturn') },
    { value: 'INTERNAL_PRODUCTION', label: t('warehouse.subtypeProduction') },
  ];

  const supplierOptions = useMemo(
    () =>
      partners
        .filter((p) => p.isActive && (p.partnerType === 'SUPPLIER' || p.partnerType === 'BOTH'))
        .map((p) => ({ value: p.id, code: p.code, label: p.name })),
    [partners]
  );

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

  const buildLineForItem = (
    item: Item,
    existingId?: string,
    existingQty?: string,
    existingReason?: string
  ): OtherWarehouseLineWithReason => {
    const priceRec = storePrices.find((p) => p.storeId === doc.storeId && p.itemId === item.id);
    const vatRate = vatRates.find((v) => v.id === item.vatRateId)?.ratePercent ?? '17.00';
    const qtyStr = existingQty && d(existingQty).gt(0) ? existingQty : '1.0000';
    const qty = d(qtyStr);
    const purchUnit = priceRec?.purchaseUnitPrice ?? '0.0000';
    const retailUnit = priceRec?.retailUnitPriceWithVat ?? '0.00';

    return {
      id: existingId ?? generateUuidV7(),
      itemId: item.id,
      quantity: qtyStr,
      purchaseUnitPrice: purchUnit,
      purchaseTotalValue: round2(qty.mul(d(purchUnit))),
      retailUnitPriceWithVat: retailUnit,
      retailTotalValueWithVat: round2(qty.mul(d(retailUnit))),
      vatRatePercent: vatRate,
      reason: existingReason ?? '',
    };
  };

  const handleAddItem = (item: Item) => {
    if (isReadOnly) return;
    const nextLine = buildLineForItem(item);
    const currentLines = doc.lines as OtherWarehouseLineWithReason[];
    const baseLines =
      currentLines.length === 1 && !currentLines[0]?.itemId
        ? [nextLine]
        : [...currentLines, nextLine];
    setDoc(recomputeDocTotals(doc, baseLines));
  };

  const handleAddBlankLine = () => {
    if (isReadOnly) return;
    setDoc((prev) => {
      const currentLines = prev.lines as OtherWarehouseLineWithReason[];
      return recomputeDocTotals(prev, [...currentLines, buildBlankOtherWarehouseLine()]);
    });
  };

  const handleAddBlankLineAndFocus = () => {
    if (isReadOnly) return;
    const nextIdx = doc.lines.length;
    handleAddBlankLine();
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
    const currentLines = doc.lines as OtherWarehouseLineWithReason[];
    if (!itemId) {
      const nextLines = currentLines.map((l) =>
        l.id === lineId ? buildBlankOtherWarehouseLine() : l
      );
      setDoc(recomputeDocTotals(doc, nextLines));
      return;
    }
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const nextLines = currentLines.map((l) =>
      l.id === lineId ? buildLineForItem(item, l.id, l.quantity, l.reason) : l
    );
    setDoc(recomputeDocTotals(doc, nextLines));
  };

  const handleUpdateLineField = (
    lineId: string,
    field: 'quantity' | 'purchaseUnitPrice' | 'retailUnitPriceWithVat' | 'reason',
    val: string
  ) => {
    if (isReadOnly) return;
    setDoc((prev) => {
      const currentLines = prev.lines as OtherWarehouseLineWithReason[];
      const nextLines = currentLines.map((line) => {
        if (line.id !== lineId) return line;
        if (field === 'reason') {
          return { ...line, reason: val };
        }
        const nextQty = field === 'quantity' ? val : line.quantity;
        const nextPurch = field === 'purchaseUnitPrice' ? val : line.purchaseUnitPrice;
        const nextRetail = field === 'retailUnitPriceWithVat' ? val : line.retailUnitPriceWithVat;
        const qtyDec = d(nextQty || '0');
        return {
          ...line,
          quantity: nextQty,
          purchaseUnitPrice: nextPurch,
          purchaseTotalValue: round2(qtyDec.mul(d(nextPurch || '0'))),
          retailUnitPriceWithVat: nextRetail,
          retailTotalValueWithVat: round2(qtyDec.mul(d(nextRetail || '0'))),
        };
      });
      return recomputeDocTotals(prev, nextLines);
    });
  };

  const handleCopyLine = (idx: number) => {
    if (isReadOnly) return;
    const currentLines = doc.lines as OtherWarehouseLineWithReason[];
    const lineToCopy = currentLines[idx];
    if (!lineToCopy) return;
    const copied = { ...lineToCopy, id: generateUuidV7() };
    const nextLines = [...currentLines.slice(0, idx + 1), copied, ...currentLines.slice(idx + 1)];
    setDoc(recomputeDocTotals(doc, nextLines));
  };

  const handleRemoveLine = (lineId: string) => {
    if (isReadOnly) return;
    const currentLines = doc.lines as OtherWarehouseLineWithReason[];
    setDoc(recomputeDocTotals(doc, currentLines.filter((l) => l.id !== lineId)));
  };

  const typedLines = doc.lines as OtherWarehouseLineWithReason[];
  const validLines = typedLines.filter((l) => Boolean(l.itemId));
  const totalQty = validLines
    .reduce((acc, l) => acc.plus(d(l.quantity || '0')), new Decimal(0))
    .toString();
  const canPost = validLines.length > 0 && !validLines.some((l) => d(l.quantity || '0').lte(0));

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
      showToast({ title: 'Dodajte barem jedan artikal prije knjiženja dokumenta.', variant: 'error' });
      return;
    }
    if (validLines.some((l) => d(l.quantity || '0').lte(0))) {
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
    isReadOnly,
    onSave: () => void handleManualSave(),
    onPost: () => void handleManualPost(),
    onPrint: () => setIsPrintPreview((prev) => !prev),
    onFocusSearch: () => {
      if (!isPrintPreview && searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select();
      }
    },
    onAddRow: () => {
      if (!isPrintPreview) {
        handleAddBlankLineAndFocus();
      }
    },
    onDuplicateRow: () => {
      if (isPrintPreview) return;
      const idx = getActiveRowIndex();
      if (typedLines[idx]?.itemId) {
        handleCopyLine(idx);
      }
    },
    onDeleteRow: () => {
      if (isPrintPreview) return;
      const idx = getActiveRowIndex();
      const targetLine = typedLines[idx];
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
      title={`${t('nav.otherWarehouseDocs')} — ${doc.docNumber}`}
      size="full"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsPrintPreview(!isPrintPreview)}>
              <Printer className="h-3.5 w-3.5" />
              <span>{isPrintPreview ? t('warehouse.backToEdit') : t('warehouse.printPreview')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportOtherDocToExcel(doc, items)}>
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
        <div className="space-y-4">
          <div className="no-print flex items-center justify-between rounded-lg border border-border bg-card p-3 shadow-xs">
            <Button variant="outline" size="sm" onClick={() => setIsPrintPreview(false)}>
              <ArrowLeft className="h-4 w-4" />
              <span>{t('warehouse.backToEdit')}</span>
            </Button>
            <Button variant="primary" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              <span>{t('common.print')}</span>
            </Button>
          </div>

          <div className="mx-auto max-w-[1000px] rounded-lg border border-border bg-card p-8 text-foreground shadow-sm">
            <div className="border-b-2 border-foreground pb-4">
              <div className="flex items-start justify-between text-xs">
                <div>
                  <h1 className="text-base font-black uppercase tracking-tight">
                    {company?.name || 'WebPOS ERP'}
                  </h1>
                  {company && (
                    <>
                      <p className="text-muted-foreground">
                        {company.address}, {company.city}
                      </p>
                      <p className="text-muted-foreground">
                        JIB: {company.taxIdNumber} | PDV: {company.vatIdNumber}
                      </p>
                    </>
                  )}
                  {storeLocation && (
                    <p className="mt-1 text-muted-foreground">
                      {t('app.storeLocation')}: <strong className="text-foreground">{storeLocation.code} — {storeLocation.name}</strong>
                    </p>
                  )}
                </div>
                <div className="text-right text-xs">
                  <p className="text-muted-foreground">
                    {t('warehouse.docDate')}:{' '}
                    <strong className="font-mono text-foreground">{formatDateBs(doc.docDate)}</strong>
                  </p>
                  {doc.postingDate && (
                    <p className="mt-0.5 text-muted-foreground">
                      {t('warehouse.postingDate')}:{' '}
                      <strong className="font-mono text-foreground">{formatDateBs(doc.postingDate)}</strong>
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 text-center">
                <h2 className="text-sm font-black uppercase tracking-wider underline">
                  {formatSubtypeLabel(doc.subtype)} — {doc.docNumber}
                </h2>
                {doc.notes && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('common.notes')}: {doc.notes}
                  </p>
                )}
              </div>
            </div>

            <table className="mt-6 w-full border-collapse border border-foreground text-[11px]">
              <thead className="bg-muted/60 font-bold uppercase text-center">
                <tr>
                  <th className="border border-foreground p-1.5 w-8">#</th>
                  <th className="border border-foreground p-1.5 text-left">{t('common.name')}</th>
                  <th className="border border-foreground p-1.5 w-12">{t('common.uom')}</th>
                  <th className="border border-foreground p-1.5 w-20 text-right">{t('common.quantity')}</th>
                  <th className="border border-foreground p-1.5 w-24 text-right">{t('warehouse.purchaseUnitPrice')}</th>
                  <th className="border border-foreground p-1.5 w-24 text-right">{t('warehouse.purchaseValue')}</th>
                  <th className="border border-foreground p-1.5 w-24 text-right">{t('warehouse.retailPriceWithVat')}</th>
                  <th className="border border-foreground p-1.5 w-24 text-right">{t('warehouse.retailValueWithVat')}</th>
                  <th className="border border-foreground p-1.5 text-left">Razlog</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {validLines.map((line, idx) => {
                  const item = items.find((i) => i.id === line.itemId);
                  return (
                    <tr key={line.id}>
                      <td className="border border-foreground p-1.5 text-center">{idx + 1}</td>
                      <td className="border border-foreground p-1.5 font-sans">
                        {item?.sku ? `${item.sku} — ` : ''}{item?.name ?? line.itemId}
                      </td>
                      <td className="border border-foreground p-1.5 text-center font-sans">{item?.uom ?? 'KOM'}</td>
                      <td className="border border-foreground p-1.5 text-right">{formatQty(line.quantity, 2)}</td>
                      <td className="border border-foreground p-1.5 text-right">{formatPrice4(line.purchaseUnitPrice, true)}</td>
                      <td className="border border-foreground p-1.5 text-right">{formatMoney2(line.purchaseTotalValue, true)}</td>
                      <td className="border border-foreground p-1.5 text-right">{formatMoney2(line.retailUnitPriceWithVat, true)}</td>
                      <td className="border border-foreground p-1.5 text-right font-bold">{formatMoney2(line.retailTotalValueWithVat, true)}</td>
                      <td className="border border-foreground p-1.5 font-sans">{line.reason || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/40 font-mono font-bold">
                <tr>
                  <td colSpan={3} className="border border-foreground p-1.5 text-right font-sans uppercase">
                    {t('common.total')}
                  </td>
                  <td className="border border-foreground p-1.5 text-right">{formatQty(totalQty, 2)}</td>
                  <td className="border border-foreground p-1.5" />
                  <td className="border border-foreground p-1.5 text-right">{formatMoney2(doc.totalPurchaseValue, true)}</td>
                  <td className="border border-foreground p-1.5" />
                  <td className="border border-foreground p-1.5 text-right">{formatMoney2(doc.totalRetailValueWithVat, true)}</td>
                  <td className="border border-foreground p-1.5" />
                </tr>
              </tfoot>
            </table>

            <div className="mt-12 grid grid-cols-3 gap-8 text-center text-xs">
              <div>
                <div className="border-t border-foreground pt-2">{t('warehouse.senderSignature')}</div>
              </div>
              <div>
                <div className="border-t border-foreground pt-2">{t('warehouse.receivedBy')}</div>
              </div>
              <div>
                <div className="border-t border-foreground pt-2">{t('warehouse.approvedBy')}</div>
              </div>
            </div>
          </div>
        </div>
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

          {!isReadOnly && <KeyboardShortcutsBar />}

          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <div
              className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${
                doc.subtype === 'SUPPLIER_RETURN' ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
              }`}
            >
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
                label={t('warehouse.docSubtype')}
                options={subtypeOptions}
                value={doc.subtype}
                disabled={isReadOnly}
                onChange={(val) => setDoc({ ...doc, subtype: val as OtherWarehouseDocSubtype })}
              />
              {doc.subtype === 'SUPPLIER_RETURN' && (
                <Combobox
                  label={t('warehouse.supplier')}
                  options={supplierOptions}
                  value={doc.partnerId ?? ''}
                  disabled={isReadOnly}
                  onChange={(val) => setDoc({ ...doc, partnerId: val })}
                />
              )}
              <Input
                label={t('common.notes')}
                value={doc.notes}
                disabled={isReadOnly}
                onChange={(e) => setDoc({ ...doc, notes: e.target.value })}
                placeholder="Napomena dokumenta..."
              />
            </div>
          </div>

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
                            <div className="text-muted-foreground">
                              NC: {formatPrice4(sp?.purchaseUnitPrice ?? '0.0000')}
                            </div>
                            <div className="font-semibold text-success">
                              MPC: {formatMoney2(sp?.retailUnitPriceWithVat ?? '0.00', true)} (
                              {formatQty(sp?.currentStockQty ?? '0', 2)})
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
                  <th className="px-2 py-2 text-right w-24">{t('common.quantity')}</th>
                  <th className="px-2 py-2 text-right w-24">{t('warehouse.purchaseUnitPrice')}</th>
                  <th className="px-2 py-2 text-right w-24 bg-primary/5 text-primary">{t('warehouse.purchaseValue')}</th>
                  <th className="px-2 py-2 text-right w-24">{t('warehouse.retailPriceWithVat')}</th>
                  <th className="px-2 py-2 text-right w-24 bg-success/5 font-bold text-success">{t('warehouse.retailValueWithVat')}</th>
                  <th className="px-2 py-2 min-w-[160px]">Razlog</th>
                  {!isReadOnly && <th className="px-2 py-2 text-center w-16">{t('common.actions')}</th>}
                </tr>
              </thead>
              <tbody ref={tbodyRef} className="divide-y divide-border font-mono text-[11px]">
                {typedLines.map((line, idx) => {
                  const item = items.find((i) => i.id === line.itemId);
                  const isLastRow = idx === typedLines.length - 1;
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
                      <td className="px-1 py-1.5 text-right">
                        <NumericInput
                          decimals={4}
                          min={0}
                          data-grid-cell="true"
                          disabled={isReadOnly || !line.itemId}
                          value={line.quantity}
                          onChange={(val) => handleUpdateLineField(line.id, 'quantity', val)}
                          onEnterKey={(e) => handleAdvance(e.currentTarget)}
                          className="h-7 w-24 rounded border border-input bg-background px-1.5 text-right font-mono font-bold text-xs"
                        />
                      </td>
                      <td className="px-1 py-1.5 text-right">
                        <NumericInput
                          decimals={4}
                          min={0}
                          data-grid-cell="true"
                          disabled={isReadOnly || !line.itemId}
                          value={line.purchaseUnitPrice}
                          onChange={(val) =>
                            handleUpdateLineField(line.id, 'purchaseUnitPrice', val)
                          }
                          onEnterKey={(e) => handleAdvance(e.currentTarget)}
                          className="h-7 w-24 rounded border border-input bg-background px-1.5 text-right font-mono text-xs"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right text-primary bg-primary/5 font-semibold">
                        {formatMoney2(line.purchaseTotalValue, true)}
                      </td>
                      <td className="px-1 py-1.5 text-right">
                        <NumericInput
                          decimals={2}
                          min={0}
                          data-grid-cell="true"
                          disabled={isReadOnly || !line.itemId}
                          value={line.retailUnitPriceWithVat}
                          onChange={(val) =>
                            handleUpdateLineField(line.id, 'retailUnitPriceWithVat', val)
                          }
                          onEnterKey={(e) => handleAdvance(e.currentTarget)}
                          className="h-7 w-24 rounded border border-success/60 bg-background px-1.5 text-right font-mono font-bold text-xs text-success"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right font-bold text-success bg-success/5">
                        {formatMoney2(line.retailTotalValueWithVat, true)}
                      </td>
                      <td className="px-1 py-1.5 font-sans">
                        <input
                          type="text"
                          data-grid-cell="true"
                          disabled={isReadOnly || !line.itemId}
                          value={line.reason ?? ''}
                          onChange={(e) => handleUpdateLineField(line.id, 'reason', e.target.value)}
                          onKeyDown={(e) => {
                            if (
                              (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey) ||
                              (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey)
                            ) {
                              if (Boolean(line.itemId)) {
                                e.preventDefault();
                                handleAdvance(e.currentTarget);
                              }
                            }
                          }}
                          placeholder="Razlog stavke..."
                          className="h-7 w-full min-w-[140px] rounded border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground"
                        />
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

          <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-3 text-xs sm:grid-cols-4">
            <div className="rounded-lg border border-border/80 bg-muted/40 p-2.5">
              <div className="text-[11px] text-muted-foreground">{t('warehouse.itemCount')}</div>
              <div className="mt-1 font-mono text-sm font-bold text-foreground">{validLines.length}</div>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/40 p-2.5">
              <div className="text-[11px] text-muted-foreground">{t('warehouse.totalQuantity')}</div>
              <div className="mt-1 font-mono text-sm font-bold text-foreground">{formatQty(totalQty, 2)}</div>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5">
              <div className="text-[11px] font-semibold text-primary">{t('warehouse.totalPurchaseVal')}</div>
              <div className="mt-1 font-mono text-sm font-bold text-foreground">
                {formatMoney2(doc.totalPurchaseValue, true)}
              </div>
            </div>
            <div className="rounded-lg border border-success/40 bg-success/10 p-2.5">
              <div className="text-[11px] font-bold uppercase text-success">{t('warehouse.retailValueWithVat')}</div>
              <div className="mt-1 font-mono text-base font-extrabold text-foreground">
                {formatMoney2(doc.totalRetailValueWithVat, true)}
              </div>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
