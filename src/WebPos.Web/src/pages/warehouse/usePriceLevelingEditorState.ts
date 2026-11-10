import { useEffect, useRef, useState } from 'react';
import { generateUuidV7 } from '../../lib/utils';
import type {
  Item,
  PriceLevelingDocument,
  StoreItemPrice,
  VatRate,
} from '../../types/domain';
import {
  buildBlankLevelingLine,
  buildLevelingLine,
  recomputeLevelingDocTotals,
} from './priceLevelingUtils';

interface UsePriceLevelingEditorOptions {
  initialDoc: PriceLevelingDocument;
  items: Item[];
  vatRates: VatRate[];
  storePrices: StoreItemPrice[];
  onAutoSave?: (doc: PriceLevelingDocument) => void;
  onOpenChange: (open: boolean) => void;
}

export function usePriceLevelingEditorState({
  initialDoc,
  items,
  vatRates,
  storePrices,
  onAutoSave,
  onOpenChange,
}: UsePriceLevelingEditorOptions) {
  const [doc, setDoc] = useState<PriceLevelingDocument>(initialDoc);
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

  const handleAddItem = (item: Item) => {
    if (isReadOnly) return;
    const priceRec = storePrices.find((p) => p.storeId === doc.storeId && p.itemId === item.id);
    const vatRate = vatRates.find((v) => v.id === item.vatRateId)?.ratePercent ?? '17.00';
    const oldMpc = priceRec?.retailUnitPriceWithVat ?? '1.00';
    const nextLine = buildLevelingLine({
      id: generateUuidV7(),
      itemId: item.id,
      stockQuantity: priceRec?.currentStockQty ?? '0.0000',
      oldRetailPriceWithVat: oldMpc,
      newRetailPriceWithVat: oldMpc,
      vatRatePercent: vatRate,
    });
    setDoc(recomputeLevelingDocTotals(doc, [...doc.lines, nextLine]));
  };

  const handleAddBlankLine = () => {
    if (isReadOnly) return;
    setDoc(recomputeLevelingDocTotals(doc, [...doc.lines, buildBlankLevelingLine()]));
  };

  const handleSelectItemForLine = (lineId: string, itemId: string) => {
    if (isReadOnly) return;
    if (!itemId) {
      const nextLines = doc.lines.map((l) => (l.id === lineId ? buildBlankLevelingLine() : l));
      setDoc(recomputeLevelingDocTotals(doc, nextLines));
      return;
    }
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const priceRec = storePrices.find((p) => p.storeId === doc.storeId && p.itemId === item.id);
    const vatRate = vatRates.find((v) => v.id === item.vatRateId)?.ratePercent ?? '17.00';
    const oldMpc = priceRec?.retailUnitPriceWithVat ?? '1.00';
    const nextLines = doc.lines.map((l) =>
      l.id === lineId
        ? buildLevelingLine({
            id: l.id,
            itemId: item.id,
            stockQuantity: priceRec?.currentStockQty ?? '0.0000',
            oldRetailPriceWithVat: oldMpc,
            newRetailPriceWithVat: oldMpc,
            vatRatePercent: vatRate,
          })
        : l
    );
    setDoc(recomputeLevelingDocTotals(doc, nextLines));
  };

  const handleNewPriceChange = (lineId: string, newPriceStr: string) => {
    if (isReadOnly) return;
    const nextLines = doc.lines.map((line) =>
      line.id === lineId ? buildLevelingLine({ ...line, newRetailPriceWithVat: newPriceStr }) : line
    );
    setDoc(recomputeLevelingDocTotals(doc, nextLines));
  };

  const handleCopyLine = (idx: number) => {
    if (isReadOnly) return;
    const lineToCopy = doc.lines[idx];
    if (!lineToCopy) return;
    const copied = { ...lineToCopy, id: generateUuidV7() };
    const nextLines = [...doc.lines.slice(0, idx + 1), copied, ...doc.lines.slice(idx + 1)];
    setDoc(recomputeLevelingDocTotals(doc, nextLines));
  };

  const handleRemoveLine = (id: string) => {
    if (isReadOnly) return;
    setDoc(recomputeLevelingDocTotals(doc, doc.lines.filter((l) => l.id !== id)));
  };

  return {
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
  };
}
