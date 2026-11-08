import { useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { CheckCircle2, Save, Printer, FileSpreadsheet } from 'lucide-react';
import { t } from '../../i18n';
import { calculateCalculationLine, d, round2 } from '../../lib/money';
import { generateUuidV7 } from '../../lib/utils';
import type {
  CalculationDocument,
  Company,
  Item,
  Partner,
  StoreItemPrice,
  StoreLocation,
  VatRate,
} from '../../types/domain';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { DocumentStatusBadge } from '../../components/ui/Badge';
import { CalculationZtrPanel } from './CalculationZtrPanel';
import { CalculationLinesTable } from './CalculationLinesTable';
import { CalculationRecapPanel } from './CalculationRecapPanel';
import { CalculationPrintView } from './CalculationPrintView';
import { CalculationHeaderPanel } from './CalculationHeaderPanel';
import { exportCalculationToExcel } from './calculationExcelExport';
import { recomputeCalculationWithZtr } from './calculationUtils';

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
  onSaveDraft: (doc: CalculationDocument) => void;
  onPostDocument: (doc: CalculationDocument) => void;
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
}: CalculationEditorDialogProps) {
  const [doc, setDoc] = useState<CalculationDocument>(initialDoc);
  const [printMode, setPrintMode] = useState<'NONE' | 'RETAIL' | 'WHOLESALE'>('NONE');
  const isReadOnly = doc.status !== 'DRAFT';

  const currentStore: StoreLocation = storeLocations.find((s) => s.id === doc.storeId) ??
    storeLocations[0] ?? {
      id: doc.storeId,
      companyId: doc.companyId,
      code: 'SKL',
      name: 'Skladište',
      storeType: 'RETAIL',
      address: company.address,
      city: company.city,
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
          sublabel: s.storeType === 'RETAIL' ? t('warehouse.storeTypeMp') : s.storeType === 'WHOLESALE' ? t('warehouse.storeTypeVp') : t('warehouse.storeTypeMat'),
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
    const initCalc = calculateCalculationLine({
      quantity: '10.0000',
      supplierUnitPrice: existingPrice?.purchaseUnitPrice ?? '10.0000',
      discountPercent: '0.00',
      dependentCostPerUnit: '0.0000',
      targetRetailPriceWithVat: existingPrice?.retailUnitPriceWithVat ?? '15.00',
      vatRatePercent: vatRate,
    });
    setDoc(recomputeCalculationWithZtr(doc, [...doc.lines, { id: generateUuidV7(), itemId: item.id, ...initCalc }], totalZtr, allocMethod, freight, customs, handling, other));
  };

  const grossInv = round2(doc.lines.reduce((a, l) => a.plus(d(l.supplierUnitPrice).mul(d(l.quantity))), new Decimal(0)));
  const totalDisc = round2(doc.lines.reduce((a, l) => a.plus(d(l.supplierUnitPrice).minus(d(l.netSupplierUnitPrice)).mul(d(l.quantity))), new Decimal(0)));

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${t('warehouse.calculationWorkspace')} — ${doc.docNumber}`}
      size="full"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPrintMode(printMode === 'RETAIL' ? 'NONE' : 'RETAIL')}>
              <Printer className="h-3.5 w-3.5" /><span>{t('warehouse.printA4RetailCalc')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPrintMode(printMode === 'WHOLESALE' ? 'NONE' : 'WHOLESALE')}>
              <Printer className="h-3.5 w-3.5" /><span>{t('warehouse.printA4WholesaleCalc')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportCalculationToExcel(doc, items)}>
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
                <Button variant="success" disabled={!doc.partnerId || doc.lines.length === 0} onClick={() => onPostDocument(doc)}>
                  <CheckCircle2 className="h-4 w-4" /><span>{t('common.postDocument')}</span>
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      {printMode !== 'NONE' ? (
        <CalculationPrintView
          doc={doc}
          company={company}
          storeLocation={currentStore}
          partner={currentPartner}
          items={items}
          isWholesale={printMode === 'WHOLESALE'}
          onBack={() => setPrintMode('NONE')}
        />
      ) : (
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DocumentStatusBadge status={doc.status} />
              <span className="font-mono text-muted-foreground">{doc.docNumber}</span>
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
                onStoreChange={(val) => setDoc({ ...doc, storeId: val })}
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
              onZtrChange={(field, val) => {
                const nF = field === 'freight' ? val : freight;
                const nC = field === 'customs' ? val : customs;
                const nH = field === 'handling' ? val : handling;
                const nO = field === 'other' ? val : other;
                const nTot = round2(d(nF).plus(d(nC)).plus(d(nH)).plus(d(nO)));
                setDoc({ ...recomputeCalculationWithZtr(doc, doc.lines, nTot, allocMethod, nF, nC, nH, nO), ztrFreight: nF, ztrCustoms: nC, ztrHandling: nH, ztrOther: nO });
              }}
              onAllocationMethodChange={(method) => setDoc(recomputeCalculationWithZtr(doc, doc.lines, totalZtr, method, freight, customs, handling, other))}
            />
          </div>

          <CalculationLinesTable
            lines={doc.lines}
            items={items}
            storePrices={storePrices}
            activeStoreId={doc.storeId}
            isReadOnly={isReadOnly}
            onUpdateLineField={(id, f, val) => setDoc(recomputeCalculationWithZtr(doc, doc.lines, totalZtr, allocMethod, freight, customs, handling, other, id, f, val))}
            onRemoveLine={(id) => setDoc(recomputeCalculationWithZtr(doc, doc.lines.filter((l) => l.id !== id), totalZtr, allocMethod, freight, customs, handling, other))}
            onAddItem={handleAddItem}
          />

          <CalculationRecapPanel
            grossInvoiceValue={grossInv}
            totalDiscount={totalDisc}
            totalZtr={totalZtr}
            totalPurchaseValue={doc.totalPurchaseValue}
            totalMarginAmount={doc.totalMarginAmount}
            totalVatAmount={doc.totalEmbeddedVatAmount}
            totalRetailValueWithVat={doc.totalRetailValueWithVat}
          />
        </div>
      )}
    </Dialog>
  );
}
