import { useEffect, useMemo, useRef, useState } from 'react';
import { d } from '../../lib/money';
import { generateUuidV7 } from '../../lib/utils';
import type {
  Item,
  StoreItemPrice,
  StoreLocation,
  TransferDocument,
  VatRate,
} from '../../types/domain';
import {
  buildBlankTransferLine,
  buildTransferLine,
  recomputeTransferDocTotals,
} from './transferUtils';

interface UseTransferEditorOptions {
  initialDoc: TransferDocument;
  storeLocations: StoreLocation[];
  items: Item[];
  vatRates: VatRate[];
  storePrices: StoreItemPrice[];
  onAutoSave?: (doc: TransferDocument) => void;
  onOpenChange: (open: boolean) => void;
}

export function useTransferEditorState({
  initialDoc,
  storeLocations,
  items,
  vatRates,
  storePrices,
  onAutoSave,
  onOpenChange,
}: UseTransferEditorOptions) {
  const [doc, setDoc] = useState<TransferDocument>(initialDoc);
  const [isPrintPreview, setIsPrintPreview] = useState(false);
  const isReadOnly = doc.status !== 'DRAFT';

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (doc.status !== 'DRAFT') return;
    const timer = setTimeout(() => {
      onAutoSave?.(doc);
    }, 400);
    return () => clearTimeout(timer);
  }, [doc, onAutoSave]);

  const handleClose = () => {
    if (doc.status === 'DRAFT') {
      onAutoSave?.(doc);
    }
    onOpenChange(false);
  };

  const storeOptions = useMemo(
    () =>
      storeLocations
        .filter((s) => s.isActive)
        .map((s) => ({ value: s.id, code: s.code, label: s.name, sublabel: s.city })),
    [storeLocations]
  );

  const sourceStore = storeLocations.find((s) => s.id === doc.sourceStoreId);
  const targetStore = storeLocations.find((s) => s.id === doc.targetStoreId);

  const handleAddItem = (item: Item) => {
    if (isReadOnly) return;
    const nextLine = buildTransferLine({
      itemId: item.id,
      quantity: '1.0000',
      sourceStoreId: doc.sourceStoreId,
      targetStoreId: doc.targetStoreId,
      items,
      storePrices,
      vatRates,
    });
    setDoc(recomputeTransferDocTotals(doc, [...doc.lines, nextLine]));
  };

  const handleAddBlankLine = () => {
    if (isReadOnly) return;
    setDoc(recomputeTransferDocTotals(doc, [...doc.lines, buildBlankTransferLine()]));
  };

  const handleSelectItemForLine = (lineId: string, itemId: string) => {
    if (isReadOnly) return;
    if (!itemId) {
      const nextLines = doc.lines.map((l) => (l.id === lineId ? buildBlankTransferLine() : l));
      setDoc(recomputeTransferDocTotals(doc, nextLines));
      return;
    }
    const nextLines = doc.lines.map((l) =>
      l.id === lineId
        ? buildTransferLine({
            id: l.id,
            itemId,
            quantity: d(l.quantity).gt(0) ? l.quantity : '1.0000',
            sourceStoreId: doc.sourceStoreId,
            targetStoreId: doc.targetStoreId,
            items,
            storePrices,
            vatRates,
          })
        : l
    );
    setDoc(recomputeTransferDocTotals(doc, nextLines));
  };

  const handleLineChange = (
    lineId: string,
    field: 'quantity' | 'targetRetailUnitPrice',
    value: string
  ) => {
    if (isReadOnly) return;
    const nextLines = doc.lines.map((line) => {
      if (line.id !== lineId) return line;
      const qty = field === 'quantity' ? value : line.quantity;
      const tgtUnit = field === 'targetRetailUnitPrice' ? value : line.targetRetailUnitPrice;
      return buildTransferLine({
        id: line.id,
        itemId: line.itemId,
        quantity: qty,
        sourceStoreId: doc.sourceStoreId,
        targetStoreId: doc.targetStoreId,
        items,
        storePrices,
        vatRates,
        customTargetRetailPrice: tgtUnit,
      });
    });
    setDoc(recomputeTransferDocTotals(doc, nextLines));
  };

  const handleCopyLine = (idx: number) => {
    if (isReadOnly) return;
    const lineToCopy = doc.lines[idx];
    if (!lineToCopy) return;
    const copied = { ...lineToCopy, id: generateUuidV7() };
    const nextLines = [...doc.lines.slice(0, idx + 1), copied, ...doc.lines.slice(idx + 1)];
    setDoc(recomputeTransferDocTotals(doc, nextLines));
  };

  const handleRemoveLine = (id: string) => {
    if (isReadOnly) return;
    setDoc(recomputeTransferDocTotals(doc, doc.lines.filter((l) => l.id !== id)));
  };

  const priceDifferenceTotal = d(doc.totalTargetRetailValue).minus(d(doc.totalSourceRetailValue));

  return {
    doc,
    setDoc,
    isPrintPreview,
    setIsPrintPreview,
    isReadOnly,
    storeOptions,
    sourceStore,
    targetStore,
    priceDifferenceTotal,
    handleClose,
    handleAddItem,
    handleAddBlankLine,
    handleSelectItemForLine,
    handleLineChange,
    handleCopyLine,
    handleRemoveLine,
  };
}
