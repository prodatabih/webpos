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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Combobox
          label={t('warehouse.supplier')}
          options={supplierOptions}
          value={doc.partnerId}
          disabled={isReadOnly}
          onChange={onSupplierChange}
        />
        <Input
          label={t('warehouse.supplierInvoiceNumber')}
          value={doc.supplierInvoiceNumber}
          disabled={isReadOnly}
          onChange={(e) => onFieldChange('supplierInvoiceNumber', e.target.value)}
          className="font-mono"
        />
        <Combobox
          label={t('warehouse.targetStore')}
          options={storeOptions}
          value={doc.storeId}
          disabled={isReadOnly}
          onChange={onStoreChange}
        />
        <Input
          label={t('warehouse.supplierInvoiceDate')}
          type="date"
          value={doc.supplierInvoiceDate}
          disabled={isReadOnly}
          onChange={(e) => onFieldChange('supplierInvoiceDate', e.target.value)}
        />
        <Input
          label={t('warehouse.receiptDate')}
          type="date"
          value={doc.receiptDate || doc.docDate}
          disabled={isReadOnly}
          onChange={(e) => onFieldChange('receiptDate', e.target.value)}
        />
        <Input
          label={t('warehouse.dueDate')}
          type="date"
          value={doc.dueDate || doc.docDate}
          disabled={isReadOnly}
          onChange={(e) => onFieldChange('dueDate', e.target.value)}
        />
      </div>
    </div>
  );
}
