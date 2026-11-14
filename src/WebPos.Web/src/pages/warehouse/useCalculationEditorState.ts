import { useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { calculateCalculationLine, d, round2 } from '../../lib/money';
import { generateUuidV7 } from '../../lib/utils';
import type {
  CalculationDocument, Company, Item, Partner, StoreItemPrice, StoreLocation, VatRate,
} from '../../types/domain';
import { recomputeCalculationWithZtr, type CalculationLineField } from './calculationUtils';
import { t } from '../../i18n';

interface UseCalculationEditorOptions {
  initialDoc: CalculationDocument;
  company: Company;
  storeLocations: StoreLocation[];
  partners: Partner[];
  items: Item[];
  vatRates: VatRate[];
  storePrices: StoreItemPrice[];
}

export function useCalculationEditorState({
  initialDoc,
  company,
  storeLocations,
  partners,
  items,
  vatRates,
  storePrices,
}: UseCalculationEditorOptions) {
  const [doc, setDoc] = useState<CalculationDocument>(initialDoc);
  const [isPrintPreview, setIsPrintPreview] = useState(false);
  const isReadOnly = doc.status !== 'DRAFT';

  const currentStore = storeLocations.find((s) => s.id === doc.storeId) ?? storeLocations[0] ?? {
    id: doc.storeId,
    companyId: doc.companyId,
    code: 'SKL',
    name: 'Skladište',
    storeType: 'RETAIL' as const,
    address: company?.address ?? '',
    city: company?.city ?? '',
    isActive: true,
  };
  const currentPartner = partners.find((p) => p.id === doc.partnerId);

  const supplierOptions = useMemo(
    () =>
      partners
        .filter((p) => p.isActive && (p.partnerType === 'SUPPLIER' || p.partnerType === 'BOTH'))
        .map((p) => ({
          value: p.id,
          code: p.code,
          label: p.name,
          sublabel: `${t('master.taxIdNumber')}: ${p.taxIdNumber}`,
        })),
    [partners]
  );

  const storeOptions = useMemo(
    () =>
      storeLocations
        .filter((s) => s.isActive)
        .map((s) => ({
          value: s.id,
          code: s.code,
          label: s.name,
          sublabel:
            s.storeType === 'RETAIL'
              ? t('warehouse.storeTypeMp')
              : s.storeType === 'WHOLESALE'
              ? t('warehouse.storeTypeVp')
              : t('warehouse.storeTypeMat'),
        })),
    [storeLocations]
  );

  const freight = doc.ztrFreight ?? '0.00';
  const customs = doc.ztrCustoms ?? '0.00';
  const handling = doc.ztrHandling ?? '0.00';
  const other = doc.ztrOther ?? '0.00';
  const totalZtr = round2(d(freight).plus(d(customs)).plus(d(handling)).plus(d(other)));
  const allocMethod = doc.ztrAllocationMethod ?? 'VALUE';

  const handleAddItem = (item: Item) => {
    const existingPrice = storePrices.find((p) => p.storeId === doc.storeId && p.itemId === item.id);
    const vatRate = vatRates.find((v) => v.id === item.vatRateId)?.ratePercent ?? '17.00';
    const isRaw = currentStore.storeType === 'RAW_MATERIAL' || currentStore.storeType === 'PRODUCTION';
    const isWholesale = currentStore.storeType === 'WHOLESALE';
    const supPrice = existingPrice?.purchaseUnitPrice ?? '10.0000';
    const initCalc = calculateCalculationLine({
      quantity: '1.0000',
      supplierUnitPrice: supPrice,
      discountPercent: '0.00',
      dependentCostPerUnit: '0.0000',
      targetRetailPriceWithVat: isRaw ? supPrice : isWholesale ? undefined : (existingPrice?.retailUnitPriceWithVat ?? '15.00'),
      targetSellingPriceExclVat: isWholesale ? (existingPrice?.wholesaleUnitPriceExclVat ?? supPrice) : undefined,
      vatRatePercent: isRaw ? '0.00' : vatRate,
    });
    setDoc(recomputeCalculationWithZtr(doc, [...doc.lines, { id: generateUuidV7(), itemId: item.id, ...initCalc }], totalZtr, allocMethod, freight, customs, handling, other, currentStore.storeType));
  };

  const handleAddBlankLine = () => {
    const blank = {
      id: generateUuidV7(),
      itemId: '',
      quantity: '1.0000',
      supplierUnitPrice: '0.0000',
      discountPercent: '0.00',
      netSupplierUnitPrice: '0.0000',
      dependentCostPerUnit: '0.0000',
      purchaseUnitPrice: '0.0000',
      purchaseTotalValue: '0.00',
      marginPercent: '0.00',
      marginUnitAmount: '0.0000',
      marginTotalAmount: '0.00',
      sellingUnitPriceExclVat: '0.0000',
      sellingTotalValueExclVat: '0.00',
      vatRatePercent: currentStore.storeType === 'RAW_MATERIAL' ? '0.00' : '17.00',
      embeddedVatUnitAmount: '0.0000',
      embeddedVatTotalAmount: '0.00',
      retailUnitPriceWithVat: '0.00',
      retailTotalValueWithVat: '0.00',
    };
    setDoc((prev) => ({ ...prev, lines: [...prev.lines, blank] }));
  };

  const handleSelectItemForLine = (lineId: string, itemId: string) => {
    if (!itemId) {
      setDoc((prev) => ({ ...prev, lines: prev.lines.map((l) => (l.id === lineId ? { ...l, itemId: '' } : l)) }));
      return;
    }
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const existingPrice = storePrices.find((p) => p.storeId === doc.storeId && p.itemId === item.id);
    const vatRate = vatRates.find((v) => v.id === item.vatRateId)?.ratePercent ?? '17.00';
    const isRaw = currentStore.storeType === 'RAW_MATERIAL' || currentStore.storeType === 'PRODUCTION';
    const isWholesale = currentStore.storeType === 'WHOLESALE';
    const supPrice = existingPrice?.purchaseUnitPrice ?? '10.0000';
    const nextLines = doc.lines.map((l) => {
      if (l.id !== lineId) return l;
      const initCalc = calculateCalculationLine({
        quantity: d(l.quantity).gt(0) ? l.quantity : '1.0000',
        supplierUnitPrice: supPrice,
        discountPercent: l.discountPercent || '0.00',
        dependentCostPerUnit: l.dependentCostPerUnit || '0.0000',
        targetRetailPriceWithVat: isRaw ? supPrice : isWholesale ? undefined : (existingPrice?.retailUnitPriceWithVat ?? '15.00'),
        targetSellingPriceExclVat: isWholesale ? (existingPrice?.wholesaleUnitPriceExclVat ?? supPrice) : undefined,
        vatRatePercent: isRaw ? '0.00' : vatRate,
      });
      return { id: l.id, itemId: item.id, ...initCalc };
    });
    setDoc(recomputeCalculationWithZtr(doc, nextLines, totalZtr, allocMethod, freight, customs, handling, other, currentStore.storeType));
  };

  const handleCopyLine = (idx: number) => {
    const lineToCopy = doc.lines[idx];
    if (!lineToCopy) return;
    const copied = { ...lineToCopy, id: generateUuidV7() };
    const nextLines = [...doc.lines.slice(0, idx + 1), copied, ...doc.lines.slice(idx + 1)];
    setDoc(recomputeCalculationWithZtr(doc, nextLines, totalZtr, allocMethod, freight, customs, handling, other, currentStore.storeType));
  };

  const handleRemoveLine = (id: string) => {
    setDoc(recomputeCalculationWithZtr(doc, doc.lines.filter((l) => l.id !== id), totalZtr, allocMethod, freight, customs, handling, other, currentStore.storeType));
  };

  const handleUpdateLineField = (id: string, field: CalculationLineField, val: string) => {
    setDoc(recomputeCalculationWithZtr(doc, doc.lines, totalZtr, allocMethod, freight, customs, handling, other, currentStore.storeType, id, field, val));
  };

  const handleZtrChange = (field: 'freight' | 'customs' | 'handling' | 'other', val: string) => {
    const nF = field === 'freight' ? val : freight;
    const nC = field === 'customs' ? val : customs;
    const nH = field === 'handling' ? val : handling;
    const nO = field === 'other' ? val : other;
    const nTot = round2(d(nF).plus(d(nC)).plus(d(nH)).plus(d(nO)));
    setDoc({
      ...recomputeCalculationWithZtr(doc, doc.lines, nTot, allocMethod, nF, nC, nH, nO, currentStore.storeType),
      ztrFreight: nF,
      ztrCustoms: nC,
      ztrHandling: nH,
      ztrOther: nO,
    });
  };

  const handleAllocationMethodChange = (method: 'VALUE' | 'QUANTITY') => {
    setDoc(recomputeCalculationWithZtr(doc, doc.lines, totalZtr, method, freight, customs, handling, other, currentStore.storeType));
  };

  const handleStoreChange = (val: string) => {
    const nStore = storeLocations.find((s) => s.id === val);
    const st = nStore?.storeType ?? 'RETAIL';
    setDoc(recomputeCalculationWithZtr({ ...doc, storeId: val }, doc.lines, totalZtr, allocMethod, freight, customs, handling, other, st));
  };

  const grossInv = round2(doc.lines.reduce((a, l) => a.plus(d(l.supplierUnitPrice).mul(d(l.quantity))), new Decimal(0)));
  const totalDisc = round2(doc.lines.reduce((a, l) => a.plus(d(l.supplierUnitPrice).minus(d(l.netSupplierUnitPrice)).mul(d(l.quantity))), new Decimal(0)));
  const totalQty = doc.lines.reduce((a, l) => a.plus(d(l.quantity)), new Decimal(0)).toString();

  return {
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
  };
}
