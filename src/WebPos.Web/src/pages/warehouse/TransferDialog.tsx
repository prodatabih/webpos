import { CheckCircle2, Save, Printer } from 'lucide-react';
import { t } from '../../i18n';
import { d, formatMoney2 } from '../../lib/money';
import type {
  Company,
  Item,
  StoreItemPrice,
  StoreLocation,
  TransferDocument,
  VatRate,
} from '../../types/domain';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Combobox } from '../../components/ui/Combobox';
import { DocumentStatusBadge } from '../../components/ui/Badge';
import { TransferPrintView } from './TransferPrintView';
import { TransferLinesTable } from './TransferLinesTable';
import { useTransferEditorState } from './useTransferEditorState';

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDoc: TransferDocument;
  company: Company;
  storeLocations: StoreLocation[];
  items: Item[];
  vatRates: VatRate[];
  storePrices: StoreItemPrice[];
  onSaveDraft: (doc: TransferDocument) => void;
  onPostDocument: (doc: TransferDocument) => void;
  onAutoSave?: (doc: TransferDocument) => void;
}

export function TransferDialog({
  open,
  onOpenChange,
  initialDoc,
  company,
  storeLocations,
  items,
  vatRates,
  storePrices,
  onSaveDraft,
  onPostDocument,
  onAutoSave,
}: TransferDialogProps) {
  const {
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
  } = useTransferEditorState({
    initialDoc,
    storeLocations,
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
      title={`${t('nav.transfers')} — ${doc.docNumber}`}
      size="full"
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsPrintPreview(!isPrintPreview)}>
              <Printer className="h-3.5 w-3.5" />
              <span>{isPrintPreview ? t('warehouse.backToEdit') : t('warehouse.printTransfer')}</span>
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
                  disabled={
                    !doc.sourceStoreId ||
                    !doc.targetStoreId ||
                    doc.sourceStoreId === doc.targetStoreId ||
                    doc.lines.length === 0 ||
                    doc.lines.some((l) => !l.itemId || d(l.quantity).lte(0))
                  }
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
        <TransferPrintView
          doc={doc}
          company={company}
          sourceStore={sourceStore}
          targetStore={targetStore}
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
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
            <Combobox
              label={t('warehouse.transferOutStore')}
              options={storeOptions}
              value={doc.sourceStoreId}
              disabled={isReadOnly}
              onChange={(val) => setDoc({ ...doc, sourceStoreId: val })}
            />
            <Combobox
              label={t('warehouse.transferInStore')}
              options={storeOptions}
              value={doc.targetStoreId}
              disabled={isReadOnly}
              onChange={(val) => setDoc({ ...doc, targetStoreId: val })}
            />
          </div>

          <TransferLinesTable
            lines={doc.lines}
            items={items}
            storePrices={storePrices}
            sourceStoreId={doc.sourceStoreId}
            isReadOnly={isReadOnly}
            onSelectItemForLine={handleSelectItemForLine}
            onLineChange={handleLineChange}
            onRemoveLine={handleRemoveLine}
            onCopyLine={handleCopyLine}
            onAddItem={handleAddItem}
            onAddBlankLine={handleAddBlankLine}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 rounded-lg border border-border bg-muted/40 p-3 text-xs">
            <div>
              <div className="text-muted-foreground">{t('warehouse.totalPurchaseVal')}</div>
              <div className="font-mono text-sm font-semibold">{formatMoney2(doc.totalPurchaseValue, true)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{t('warehouse.transferOutStore')}</div>
              <div className="font-mono text-sm font-semibold">{formatMoney2(doc.totalSourceRetailValue, true)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{t('warehouse.transferInStore')}</div>
              <div className="font-mono text-sm font-bold text-success">{formatMoney2(doc.totalTargetRetailValue, true)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{t('warehouse.priceDifference')}</div>
              <div className="font-mono text-sm font-bold text-primary">{formatMoney2(priceDifferenceTotal, true)}</div>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
