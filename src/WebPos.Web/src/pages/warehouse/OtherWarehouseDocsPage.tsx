import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Eye, CheckCircle2, RotateCcw, Trash2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { t } from '../../i18n';
import { formatMoney2 } from '../../lib/money';
import { formatDateBs, generateUuidV7 } from '../../lib/utils';
import { EMPTY_COMPANY_FALLBACK, EMPTY_STORE_FALLBACK } from '../../lib/emptyOrgFallbacks';
import type { OtherWarehouseDocSubtype, OtherWarehouseDocument } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge, DocumentStatusBadge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { showToast } from '../../components/ui/Toast';
import {
  buildBlankOtherWarehouseLine,
  OtherWarehouseDocDialog,
} from './OtherWarehouseDocDialog';

type ConfirmState =
  | { type: 'post'; doc: OtherWarehouseDocument }
  | { type: 'delete'; doc: OtherWarehouseDocument }
  | { type: 'reverse'; doc: OtherWarehouseDocument }
  | null;

export function OtherWarehouseDocsPage() {
  const store = useAppStore();
  const [editingDoc, setEditingDoc] = useState<OtherWarehouseDocument | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const storeDocs = useMemo(
    () => store.otherWarehouseDocs.filter((ow) => ow.storeId === store.activeStoreId),
    [store.otherWarehouseDocs, store.activeStoreId]
  );

  const formatSubtype = (subtype: OtherWarehouseDocSubtype) => {
    if (subtype === 'WRITEOFF_KALORASTUR') return t('warehouse.subtypeWriteoff');
    if (subtype === 'INTERNAL_ISSUE') return t('warehouse.subtypeInternalIssue');
    if (subtype === 'INTERNAL_RECEIPT') return t('warehouse.subtypeInternalReceipt');
    if (subtype === 'SUPPLIER_RETURN') return t('warehouse.subtypeSupplierReturn');
    return t('warehouse.subtypeProduction');
  };

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
    const seq = String(storeDocs.length + 1).padStart(4, '0');
    const today = new Date().toISOString().slice(0, 10);
    const activeYear =
      store.fiscalYears.find((fy) => fy.id === store.activeFiscalYearId)?.year ??
      new Date().getFullYear();
    setEditingDoc({
      id: generateUuidV7(),
      companyId: store.activeCompanyId,
      fiscalYearId: store.activeFiscalYearId,
      storeId: store.activeStoreId,
      docNumber: `ZAP-${activeYear}-${seq}`,
      docDate: today,
      subtype: 'WRITEOFF_KALORASTUR',
      status: 'DRAFT',
      notes: '',
      lines: [buildBlankOtherWarehouseLine()],
      totalPurchaseValue: '0.00',
      totalRetailValueWithVat: '0.00',
      createdBy: store.currentUserName,
      createdAt: new Date().toISOString(),
    });
  };

  const executePost = async (docId: string) => {
    const res = await store.postOtherWarehouseDoc(docId);
    if (res.ok) {
      showToast({ title: t('messages.documentPosted'), variant: 'success' });
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
      const res = await store.deleteOtherWarehouseDraft(confirmState.doc.id);
      if (res.ok) {
        showToast({ title: 'Nacrt internog dokumenta je uspješno obrisan.', variant: 'success' });
        setConfirmState(null);
      } else {
        showToast({ title: res.error || t('common.errorTitle'), variant: 'error' });
      }
      return;
    }
    if (confirmState.type === 'reverse') {
      const res = await store.reverseOtherWarehouseDoc(confirmState.doc.id, reason);
      if (res.ok) {
        showToast({ title: t('messages.documentReversed'), variant: 'info' });
        setConfirmState(null);
      } else {
        showToast({ title: res.error || t('common.errorTitle'), variant: 'error' });
      }
    }
  };

  const columns = useMemo<ColumnDef<OtherWarehouseDocument>[]>(
    () => [
      {
        accessorKey: 'docNumber',
        header: t('warehouse.docNumber'),
        cell: ({ row }) => (
          <span className="font-mono font-semibold text-foreground">{row.original.docNumber}</span>
        ),
      },
      {
        accessorKey: 'docDate',
        header: t('warehouse.docDate'),
        cell: ({ row }) => formatDateBs(row.original.docDate),
      },
      {
        accessorKey: 'subtype',
        header: t('warehouse.docSubtype'),
        cell: ({ row }) => <Badge variant="secondary">{formatSubtype(row.original.subtype)}</Badge>,
      },
      {
        accessorKey: 'notes',
        header: t('common.notes'),
      },
      {
        accessorKey: 'totalPurchaseValue',
        header: t('warehouse.purchaseValue'),
        cell: ({ row }) => (
          <span className="font-mono">{formatMoney2(row.original.totalPurchaseValue, true)}</span>
        ),
      },
      {
        accessorKey: 'totalRetailValueWithVat',
        header: t('warehouse.retailValueWithVat'),
        cell: ({ row }) => (
          <span className="font-mono font-semibold">
            {formatMoney2(row.original.totalRetailValueWithVat, true)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('common.status'),
        cell: ({ row }) => <DocumentStatusBadge status={row.original.status} />,
      },
      {
        id: 'actions',
        header: t('common.actions'),
        cell: ({ row }) => {
          const ow = row.original;
          return (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" onClick={() => setEditingDoc(ow)}>
                <Eye className="h-3.5 w-3.5" />
                <span>{ow.status === 'DRAFT' ? t('common.edit') : t('common.view')}</span>
              </Button>
              {ow.status === 'DRAFT' && (
                <>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => setConfirmState({ type: 'post', doc: ow })}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{t('common.postDocument')}</span>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmState({ type: 'delete', doc: ow })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{t('common.delete')}</span>
                  </Button>
                </>
              )}
              {ow.status === 'POSTED' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmState({ type: 'reverse', doc: ow })}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{t('common.reverseDocument')}</span>
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t('nav.otherWarehouseDocs')}
        breadcrumbs={[
          { label: t('nav.groupWarehouse') },
          { label: t('nav.otherWarehouseDocs') },
        ]}
        primaryAction={
          <Button variant="primary" size="sm" onClick={handleCreateNew}>
            <Plus className="h-4 w-4" />
            <span>{t('common.newDocument')}</span>
          </Button>
        }
      />

      <div className="p-6">
        <DataTable
          data={storeDocs}
          columns={columns}
          exportFileName="other-warehouse-docs"
          onRowClick={setEditingDoc}
        />
      </div>

      {editingDoc && (
        <OtherWarehouseDocDialog
          key={editingDoc.id}
          open={Boolean(editingDoc)}
          onOpenChange={(open) => !open && setEditingDoc(null)}
          initialDoc={editingDoc}
          company={
            store.companies.find((c) => c.id === store.activeCompanyId) ??
            store.companies[0] ??
            EMPTY_COMPANY_FALLBACK
          }
          storeLocation={
            store.storeLocations.find((s) => s.id === store.activeStoreId) ??
            store.storeLocations[0] ??
            EMPTY_STORE_FALLBACK
          }
          items={store.items}
          partners={store.partners}
          vatRates={store.vatRates}
          storePrices={store.storeItemPrices}
          onSaveDraft={async (draft) => {
            const res = await store.saveOtherWarehouseDraft(draft);
            if (res.ok) {
              showToast({ title: t('messages.documentSavedDraft'), variant: 'success' });
              setEditingDoc(null);
            } else {
              showToast({ title: res.error || t('common.errorTitle'), variant: 'error' });
            }
            return res;
          }}
          onPostDocument={async (draft) => {
            const saved = await store.saveOtherWarehouseDraft(draft);
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
            if (!draft.lines.some((l) => Boolean(l.itemId))) {
              return { ok: false };
            }
            return store.saveOtherWarehouseDraft(draft);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmState)}
        onOpenChange={(open) => !open && setConfirmState(null)}
        title={
          confirmState?.type === 'post'
            ? `Knjiženje dokumenta ${confirmState.doc.docNumber}`
            : confirmState?.type === 'delete'
            ? `Brisanje nacrta ${confirmState.doc.docNumber}`
            : confirmState?.type === 'reverse'
            ? `Storniranje dokumenta ${confirmState.doc.docNumber}`
            : ''
        }
        description={
          confirmState?.type === 'post'
            ? 'Da li ste sigurni da želite proknjižiti ovaj interni skladišni dokument? Zalihe i KEP knjiga će biti ažurirani.'
            : confirmState?.type === 'delete'
            ? 'Da li ste sigurni da želite trajno obrisati ovaj nacrt internog dokumenta?'
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
export default OtherWarehouseDocsPage;
