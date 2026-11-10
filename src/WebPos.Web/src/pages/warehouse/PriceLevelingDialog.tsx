import { CheckCircle2, Save, Printer, FileSpreadsheet } from 'lucide-react';
import { t } from '../../i18n';
import { formatMoney2 } from '../../lib/money';
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
  onSaveDraft: (doc: PriceLevelingDocument) => void;
  onPostDocument: (doc: PriceLevelingDocument) => void;
  onAutoSave?: (doc: PriceLevelingDocument) => void;
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
    onAutoSave,
    onOpenChange,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && doc.status === 'DRAFT') {
          onAutoSave?.(doc);
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
            <Button variant="outline" onClick={handleClose}>{t('common.close')}</Button>
            {!isReadOnly && (
              <>
                <Button variant="secondary" onClick={() => onSaveDraft(doc)}>
                  <Save className="h-4 w-4" /><span>{t('common.saveDraft')}</span>
                </Button>
                <Button
                  variant="success"
                  disabled={doc.lines.length === 0 || doc.lines.some((l) => !l.itemId)}
                  onClick={() => onPostDocument(doc)}
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
              {!isReadOnly && (
                <span className="inline-flex items-center gap-1 rounded bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                  <Save className="h-3 w-3" />
                  {t('common.autoSaved')}
                </span>
              )}
            </div>
            {isReadOnly && <span className="text-muted-foreground">{t('messages.postedImmutableError')}</span>}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label={t('warehouse.docNumber')}
              value={doc.docNumber}
              disabled={isReadOnly}
              onChange={(e) => setDoc({ ...doc, docNumber: e.target.value })}
              className="font-mono"
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
            />
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
            onAddItem={handleAddItem}
            onAddBlankLine={handleAddBlankLine}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 rounded-lg border border-border bg-muted/40 p-3 text-xs">
            <div>
              <div className="text-muted-foreground">{t('warehouse.financialEffectStock')}</div>
              <div className="font-mono text-sm font-bold text-primary">{formatMoney2(doc.totalRetailDifference, true)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{t('warehouse.financialEffectVat')}</div>
              <div className="font-mono text-sm font-semibold">{formatMoney2(doc.totalVatDifference, true)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{t('warehouse.financialEffectMargin')}</div>
              <div className="font-mono text-sm font-semibold">{formatMoney2(doc.totalMarginDifference, true)}</div>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
