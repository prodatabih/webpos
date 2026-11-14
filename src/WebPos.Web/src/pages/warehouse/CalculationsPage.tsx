import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { t } from '../../i18n';
import { generateUuidV7 } from '../../lib/utils';
import { EMPTY_COMPANY_FALLBACK } from '../../lib/emptyOrgFallbacks';
import type { CalculationDocument } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../components/ui/Toast';
import { CalculationEditorDialog } from './CalculationEditorDialog';
import { getCalculationColumns } from './calculationsColumns';

export function CalculationsPage() {
  const store = useAppStore();
  const [editingDoc, setEditingDoc] = useState<CalculationDocument | null>(null);

  const currentStore = store.storeLocations.find((s) => s.id === store.activeStoreId);
  const storeType = currentStore?.storeType ?? 'RETAIL';

  const storeCalcs = useMemo(
    () => store.calculations.filter((c) => c.storeId === store.activeStoreId),
    [store.calculations, store.activeStoreId]
  );

  const handleCreateNew = () => {
    const seq = String(storeCalcs.length + 1).padStart(4, '0');
    const today = new Date().toISOString().slice(0, 10);
    const newDoc: CalculationDocument = {
      id: generateUuidV7(),
      companyId: store.activeCompanyId,
      fiscalYearId: store.activeFiscalYearId,
      storeId: store.activeStoreId,
      docNumber: `KALK-2026-${seq}`,
      docDate: today,
      partnerId: store.partners.find((p) => p.partnerType !== 'BUYER')?.id ?? '',
      supplierInvoiceNumber: '',
      supplierInvoiceDate: today,
      receiptDate: today,
      orderNumber: '',
      deliveryNoteNumber: '',
      receiverName: store.currentUserName,
      status: 'DRAFT',
      notes: '',
      lines: [],
      totalPurchaseValue: '0.00',
      totalMarginAmount: '0.00',
      totalSellingValueExclVat: '0.00',
      totalEmbeddedVatAmount: '0.00',
      totalRetailValueWithVat: '0.00',
      createdBy: store.currentUserName,
      createdAt: new Date().toISOString(),
    };
    store.saveCalculationDraft(newDoc);
    setEditingDoc(newDoc);
  };

  const handlePost = (docId: string) => {
    const res = store.postCalculation(docId);
    if (res.ok) {
      showToast({
        title: t('messages.documentPosted'),
        description: res.autoLevelingDocNumber
          ? `${t('warehouse.autoLevelingCreated')}: ${res.autoLevelingDocNumber}`
          : undefined,
        variant: 'success',
      });
    } else if (res.error) {
      showToast({ title: res.error, variant: 'error' });
    }
  };

  const handleReverse = (docId: string) => {
    const res = store.reverseCalculation(docId);
    if (res.ok) {
      showToast({ title: t('messages.documentReversed'), variant: 'info' });
    } else if (res.error) {
      showToast({ title: res.error, variant: 'error' });
    }
  };

  const columns = useMemo(
    () =>
      getCalculationColumns({
        partners: store.partners,
        storeType,
        onEdit: setEditingDoc,
        onPost: handlePost,
        onReverse: handleReverse,
      }),
    [store.partners, storeType]
  );

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t('nav.calculations')}
        breadcrumbs={[{ label: t('nav.groupWarehouse') }, { label: t('nav.calculations') }]}
        primaryAction={
          <Button variant="primary" size="sm" onClick={handleCreateNew}>
            <Plus className="h-4 w-4" />
            <span>{t('common.newDocument')}</span>
          </Button>
        }
      />

      <div className="p-6">
        <DataTable
          data={storeCalcs}
          columns={columns}
          exportFileName="calculations"
          onRowClick={setEditingDoc}
        />
      </div>

      {editingDoc && (
        <CalculationEditorDialog
          key={editingDoc.id}
          open={Boolean(editingDoc)}
          onOpenChange={(open) => !open && setEditingDoc(null)}
          initialDoc={editingDoc}
          company={store.companies.find((c) => c.id === store.activeCompanyId) ?? store.companies[0] ?? EMPTY_COMPANY_FALLBACK}
          storeLocations={store.storeLocations}
          partners={store.partners}
          items={store.items}
          vatRates={store.vatRates}
          storePrices={store.storeItemPrices}
          onSaveDraft={(draft) => {
            const res = store.saveCalculationDraft(draft);
            if (res.ok) {
              showToast({ title: t('messages.documentSavedDraft'), variant: 'success' });
              setEditingDoc(null);
            } else if (res.error) {
              showToast({ title: res.error, variant: 'error' });
            }
          }}
          onPostDocument={(draft) => {
            const saved = store.saveCalculationDraft(draft);
            if (!saved.ok) {
              if (saved.error) showToast({ title: saved.error, variant: 'error' });
              return;
            }
            handlePost(draft.id);
            setEditingDoc(null);
          }}
          onAutoSave={(draft) => {
            store.saveCalculationDraft(draft);
          }}
        />
      )}
    </div>
  );
}
export default CalculationsPage;
