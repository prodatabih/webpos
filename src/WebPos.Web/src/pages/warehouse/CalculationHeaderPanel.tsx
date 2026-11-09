import { t } from '../../i18n';
import type { CalculationDocument } from '../../types/domain';
import { Combobox } from '../../components/ui/Combobox';
import { Input } from '../../components/ui/Input';

interface CalculationHeaderPanelProps {
  doc: CalculationDocument;
  isReadOnly: boolean;
  supplierOptions: Array<{ value: string; label: string; code?: string; sublabel?: string }>;
  storeOptions: Array<{ value: string; label: string; code?: string; sublabel?: string }>;
  onSupplierChange: (val: string) => void;
  onStoreChange: (val: string) => void;
  onFieldChange: (field: keyof CalculationDocument, value: string) => void;
}

export function CalculationHeaderPanel({
  doc,
  isReadOnly,
  supplierOptions,
  storeOptions,
  onSupplierChange,
  onStoreChange,
  onFieldChange,
}: CalculationHeaderPanelProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Combobox
            label={t('warehouse.supplier')}
            options={supplierOptions}
            value={doc.partnerId}
            disabled={isReadOnly}
            onChange={onSupplierChange}
          />
        </div>
        <Input
          label={t('warehouse.docNumber')}
          value={doc.docNumber}
          disabled={isReadOnly}
          onChange={(e) => onFieldChange('docNumber', e.target.value)}
          className="font-mono font-semibold"
        />
        <Input
          label={t('warehouse.receiptDate')}
          type="date"
          value={doc.receiptDate || doc.docDate}
          disabled={isReadOnly}
          onChange={(e) => onFieldChange('receiptDate', e.target.value)}
        />

        <Combobox
          label={t('warehouse.targetStore')}
          options={storeOptions}
          value={doc.storeId}
          disabled={isReadOnly}
          onChange={onStoreChange}
        />
        <Input
          label={t('warehouse.supplierInvoiceNumber')}
          value={doc.supplierInvoiceNumber}
          disabled={isReadOnly}
          onChange={(e) => onFieldChange('supplierInvoiceNumber', e.target.value)}
          className="font-mono"
        />
        <Input
          label={t('warehouse.orderNumber')}
          value={doc.orderNumber ?? ''}
          disabled={isReadOnly}
          onChange={(e) => onFieldChange('orderNumber', e.target.value)}
          className="font-mono"
        />
        <Input
          label={t('warehouse.deliveryNoteNumber')}
          value={doc.deliveryNoteNumber ?? ''}
          disabled={isReadOnly}
          onChange={(e) => onFieldChange('deliveryNoteNumber', e.target.value)}
          className="font-mono"
        />

        <Input
          label={t('warehouse.supplierInvoiceDate')}
          type="date"
          value={doc.supplierInvoiceDate}
          disabled={isReadOnly}
          onChange={(e) => onFieldChange('supplierInvoiceDate', e.target.value)}
        />
        <Input
          label={t('warehouse.dueDate')}
          type="date"
          value={doc.dueDate || doc.docDate}
          disabled={isReadOnly}
          onChange={(e) => onFieldChange('dueDate', e.target.value)}
        />
        <Input
          label={t('warehouse.receiverName')}
          value={doc.receiverName ?? doc.createdBy}
          disabled={isReadOnly}
          onChange={(e) => onFieldChange('receiverName', e.target.value)}
        />
        <Input
          label={t('common.notes')}
          value={doc.notes}
          disabled={isReadOnly}
          onChange={(e) => onFieldChange('notes', e.target.value)}
        />
      </div>
    </div>
  );
}
