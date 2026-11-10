import { useEffect, useRef } from 'react';
import { CheckCircle2, Save, Printer, FileSpreadsheet } from 'lucide-react';
import { t } from '../../i18n';
import type {
  CalculationDocument, Company, Item, Partner, StoreItemPrice, StoreLocation, VatRate,
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
  onSaveDraft: (doc: CalculationDocument) => void;
  onPostDocument: (doc: CalculationDocument) => void;
  onAutoSave?: (doc: CalculationDocument) => void;
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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && doc.status === 'DRAFT') {
          onAutoSave?.(doc);
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
            <Button variant="outline" onClick={handleClose}>{t('common.close')}</Button>
            {!isReadOnly && (
              <>
                <Button variant="secondary" onClick={() => onSaveDraft(doc)}>
                  <Save className="h-4 w-4" /><span>{t('common.saveDraft')}</span>
                </Button>
                <Button
                  variant="success"
                  disabled={!doc.partnerId || doc.lines.length === 0 || doc.lines.some((l) => !l.itemId)}
                  onClick={() => onPostDocument(doc)}
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
              {!isReadOnly && (
                <span className="inline-flex items-center gap-1 rounded bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                  <Save className="h-3 w-3" />
                  {t('common.autoSaved')}
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
            onUpdateLineField={handleUpdateLineField}
            onSelectItemForLine={handleSelectItemForLine}
            onRemoveLine={handleRemoveLine}
            onCopyLine={handleCopyLine}
            onAddItem={handleAddItem}
            onAddBlankLine={handleAddBlankLine}
          />

          <CalculationRecapPanel
            itemCount={doc.lines.length}
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
        </div>
      )}
    </Dialog>
  );
}
