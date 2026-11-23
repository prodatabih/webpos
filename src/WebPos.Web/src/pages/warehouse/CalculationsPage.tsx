import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { t } from '../../i18n';
import { generateUuidV7 } from '../../lib/utils';
import { useListNewShortcut } from '../../lib/keyboardGridUtils';
import { EMPTY_COMPANY_FALLBACK } from '../../lib/emptyOrgFallbacks';
import type { CalculationDocument } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { showToast } from '../../components/ui/Toast';
import { CalculationEditorDialog } from './CalculationEditorDialog';
import { getCalculationColumns } from './calculationsColumns';
import { buildBlankCalculationLine } from './useCalculationEditorState';

type ConfirmState =
  | { type: 'post'; doc: CalculationDocument }
  | { type: 'delete'; doc: CalculationDocument }
  | { type: 'reverse'; doc: CalculationDocument }
  | null;

export function CalculationsPage() {
  const store = useAppStore();
  const [editingDoc, setEditingDoc] = useState<CalculationDocument | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const currentStore = store.storeLocations.find((s) => s.id === store.activeStoreId);
  const storeType = currentStore?.storeType ?? 'RETAIL';

  const storeCalcs = useMemo(
    () => store.calculations.filter((c) => c.storeId === store.activeStoreId),
    [store.calculations, store.activeStoreId]
  );

  const handleCreateNew = () => {
    if (!store.activeStoreId) {
      showToast({ title: 'Prvo odaberite ili kreirajte poslovnicu.', variant: 'error' });
      return;
    }
    if (!store.activeFiscalYearId) {
      showToast({
        title: 'Prvo kreirajte poslovnu godinu (Matični podaci -> Poslovni periodi).',
        variant: 'error',
      });
      return;
    }
    const seq = String(storeCalcs.length + 1).padStart(4, '0');
    const today = new Date().toISOString().slice(0, 10);
    const activeYear =
      store.fiscalYears.find((fy) => fy.id === store.activeFiscalYearId)?.year ??
      new Date().getFullYear();
    const newDoc: CalculationDocument = {
      id: generateUuidV7(),
      companyId: store.activeCompanyId,
      fiscalYearId: store.activeFiscalYearId,
      storeId: store.activeStoreId,
      docNumber: `KALK-${activeYear}-${seq}`,
      docDate: today,
      partnerId: store.partners.find((p) => p.isActive && p.partnerType !== 'BUYER')?.id ?? '',
      supplierInvoiceNumber: '',
      supplierInvoiceDate: today,
      receiptDate: today,
      orderNumber: '',
      deliveryNoteNumber: '',
      receiverName: store.currentUserName,
      status: 'DRAFT',
      notes: '',
      lines: [buildBlankCalculationLine(storeType)],
      totalPurchaseValue: '0.00',
      totalMarginAmount: '0.00',
      totalSellingValueExclVat: '0.00',
      totalEmbeddedVatAmount: '0.00',
      totalRetailValueWithVat: '0.00',
      createdBy: store.currentUserName,
      createdAt: new Date().toISOString(),
    };
    setEditingDoc(newDoc);
  };

  useListNewShortcut(handleCreateNew, !editingDoc);

  const executePost = async (docId: string) => {
    const res = await store.postCalculation(docId);
    if (res.ok) {
      showToast({
        title: t('messages.documentPosted'),
        description: res.autoLevelingDocNumber
          ? `${t('warehouse.autoLevelingCreated')}: ${res.autoLevelingDocNumber}`
          : undefined,
        variant: 'success',
      });
    } else {
      showToast({ title: res.error || t('common.errorTitle'), variant: 'error' });
    }
    return res;
  };

  const handleConfirmAction = async (reason?: string) => {
    if (!confirmState) return;
    if (confirmState.type === 'post') {
      const res = await executePost(confirmState.doc.id);
      if (res.ok) setConfirmState(null);
      return;
    }
    if (confirmState.type === 'delete') {
      const res = await store.deleteCalculationDraft(confirmState.doc.id);
      if (res.ok) {
        showToast({ title: 'Nacrt kalkulacije je uspješno obrisan.', variant: 'success' });
        setConfirmState(null);
      } else {
        showToast({ title: res.error || t('common.errorTitle'), variant: 'error' });
      }
      return;
    }
    if (confirmState.type === 'reverse') {
      const res = await store.reverseCalculation(confirmState.doc.id, reason);
      if (res.ok) {
        showToast({ title: t('messages.documentReversed'), variant: 'info' });
        setConfirmState(null);
      } else {
        showToast({ title: res.error || t('common.errorTitle'), variant: 'error' });
      }
    }
  };

  const columns = useMemo(
    () =>
      getCalculationColumns({
        partners: store.partners,
        storeType,
        onEdit: setEditingDoc,
        onPost: (doc) => setConfirmState({ type: 'post', doc }),
        onDelete: (doc) => setConfirmState({ type: 'delete', doc }),
        onReverse: (doc) => setConfirmState({ type: 'reverse', doc }),
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
          company={
            store.companies.find((c) => c.id === store.activeCompanyId) ??
            store.companies[0] ??
            EMPTY_COMPANY_FALLBACK
          }
          storeLocations={store.storeLocations}
          partners={store.partners}
          items={store.items}
          vatRates={store.vatRates}
          storePrices={store.storeItemPrices}
          onSaveDraft={async (draft) => {
            const res = await store.saveCalculationDraft(draft);
            if (res.ok) {
              showToast({ title: t('messages.documentSavedDraft'), variant: 'success' });
              setEditingDoc(null);
            } else {
              showToast({ title: res.error || t('common.errorTitle'), variant: 'error' });
            }
            return res;
          }}
          onPostDocument={async (draft) => {
            const saved = await store.saveCalculationDraft(draft);
            if (!saved.ok) {
              showToast({ title: saved.error || t('common.errorTitle'), variant: 'error' });
              return saved;
            }
            const posted = await executePost(draft.id);
            if (posted.ok) {
              setEditingDoc(null);
            }
            return posted;
          }}
          onAutoSave={async (draft) => {
            if (!draft.partnerId || !draft.lines.some((l) => Boolean(l.itemId))) {
              return { ok: false };
            }
            return store.saveCalculationDraft(draft);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmState)}
        onOpenChange={(open) => !open && setConfirmState(null)}
        title={
          confirmState?.type === 'post'
            ? `Knjiženje kalkulacije ${confirmState.doc.docNumber}`
            : confirmState?.type === 'delete'
            ? `Brisanje nacrta ${confirmState.doc.docNumber}`
            : confirmState?.type === 'reverse'
            ? `Storniranje kalkulacije ${confirmState.doc.docNumber}`
            : ''
        }
        description={
          confirmState?.type === 'post'
            ? 'Da li ste sigurni da želite proknjižiti ovu kalkulaciju? Zalihe, cijene i trgovačka knjiga (KEP) će biti ažurirani.'
            : confirmState?.type === 'delete'
            ? 'Da li ste sigurni da želite trajno obrisati ovaj nacrt kalkulacije?'
            : confirmState?.type === 'reverse'
            ? 'Storniranjem se kreira protuknjiženje i poništavaju efekti dokumenta na zalihama i KEP knjizi.'
            : undefined
        }
        confirmLabel={
          confirmState?.type === 'post'
            ? t('common.postDocument')
            : confirmState?.type === 'delete'
            ? t('common.delete')
            : t('common.reverseDocument')
        }
        variant={confirmState?.type === 'post' ? 'primary' : 'destructive'}
        requireReason={confirmState?.type === 'reverse'}
        reasonLabel={t('warehouse.reversalReason')}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}
export default CalculationsPage;
