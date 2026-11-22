import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Eye, CheckCircle2, RotateCcw, Trash2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { t } from '../../i18n';
import { formatMoney2 } from '../../lib/money';
import { formatDateBs, generateUuidV7 } from '../../lib/utils';
import { EMPTY_COMPANY_FALLBACK, EMPTY_STORE_FALLBACK } from '../../lib/emptyOrgFallbacks';
import type { InventoryCountDocument } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { DocumentStatusBadge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { showToast } from '../../components/ui/Toast';
import { buildBlankInventoryCountLine, InventoryCountDialog } from './InventoryCountDialog';

type ConfirmState =
  | { type: 'post'; doc: InventoryCountDocument }
  | { type: 'delete'; doc: InventoryCountDocument }
  | { type: 'reverse'; doc: InventoryCountDocument }
  | null;

export function InventoryCountPage() {
  const store = useAppStore();
  const [editingDoc, setEditingDoc] = useState<InventoryCountDocument | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const storeCounts = useMemo(
    () => store.inventoryCounts.filter((ic) => ic.storeId === store.activeStoreId),
    [store.inventoryCounts, store.activeStoreId]
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
    const seq = String(storeCounts.length + 1).padStart(4, '0');
    const today = new Date().toISOString().slice(0, 10);
    const activeYear =
      store.fiscalYears.find((fy) => fy.id === store.activeFiscalYearId)?.year ??
      new Date().getFullYear();
    setEditingDoc({
      id: generateUuidV7(),
      companyId: store.activeCompanyId,
      fiscalYearId: store.activeFiscalYearId,
      storeId: store.activeStoreId,
      docNumber: `POP-${activeYear}-${seq}`,
      docDate: today,
      status: 'DRAFT',
      commissionMembers: store.currentUserName,
      notes: '',
      lines: [buildBlankInventoryCountLine()],
      totalSurplusRetailValue: '0.00',
      totalShortageRetailValue: '0.00',
      totalAllowedWasteValue: '0.00',
      totalUnrecognizedShortageValue: '0.00',
      totalUnrecognizedShortageVat: '0.00',
      createdBy: store.currentUserName,
      createdAt: new Date().toISOString(),
    });
  };

  const executePost = async (docId: string) => {
    const res = await store.postInventoryCount(docId);
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
      const res = await store.deleteInventoryCountDraft(confirmState.doc.id);
      if (res.ok) {
        showToast({ title: 'Nacrt popisa je uspješno obrisan.', variant: 'success' });
        setConfirmState(null);
      } else {
        showToast({ title: res.error || t('common.errorTitle'), variant: 'error' });
      }
      return;
    }
    if (confirmState.type === 'reverse') {
      const res = await store.reverseInventoryCount(confirmState.doc.id, reason);
      if (res.ok) {
        showToast({ title: t('messages.documentReversed'), variant: 'info' });
        setConfirmState(null);
      } else {
        showToast({ title: res.error || t('common.errorTitle'), variant: 'error' });
      }
    }
  };

  const columns = useMemo<ColumnDef<InventoryCountDocument>[]>(
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
        accessorKey: 'notes',
        header: t('common.notes'),
      },
      {
        accessorKey: 'totalSurplusRetailValue',
        header: t('warehouse.surplusValue'),
        cell: ({ row }) => (
          <span className="font-mono text-success">
            {formatMoney2(row.original.totalSurplusRetailValue, true)}
          </span>
        ),
      },
      {
        accessorKey: 'totalShortageRetailValue',
        header: t('warehouse.shortageValue'),
        cell: ({ row }) => (
          <span className="font-mono text-destructive">
            {formatMoney2(row.original.totalShortageRetailValue, true)}
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
          const ic = row.original;
          return (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" onClick={() => setEditingDoc(ic)}>
                <Eye className="h-3.5 w-3.5" />
                <span>{ic.status === 'DRAFT' ? t('common.edit') : t('common.view')}</span>
              </Button>
              {ic.status === 'DRAFT' && (
                <>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => setConfirmState({ type: 'post', doc: ic })}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{t('common.postDocument')}</span>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmState({ type: 'delete', doc: ic })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{t('common.delete')}</span>
                  </Button>
                </>
              )}
              {ic.status === 'POSTED' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmState({ type: 'reverse', doc: ic })}
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
        title={t('nav.inventoryCount')}
        breadcrumbs={[{ label: t('nav.groupWarehouse') }, { label: t('nav.inventoryCount') }]}
        primaryAction={
          <Button variant="primary" size="sm" onClick={handleCreateNew}>
            <Plus className="h-4 w-4" />
            <span>{t('common.newDocument')}</span>
          </Button>
        }
      />

      <div className="p-6">
        <DataTable
          data={storeCounts}
          columns={columns}
          exportFileName="inventory-counts"
          onRowClick={setEditingDoc}
        />
      </div>

      {editingDoc && (
        <InventoryCountDialog
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
          vatRates={store.vatRates}
          storePrices={store.storeItemPrices}
          onSaveDraft={async (draft) => {
            const res = await store.saveInventoryCountDraft(draft);
            if (res.ok) {
              showToast({ title: t('messages.documentSavedDraft'), variant: 'success' });
              setEditingDoc(null);
            } else {
              showToast({ title: res.error || t('common.errorTitle'), variant: 'error' });
            }
            return res;
          }}
          onPostDocument={async (draft) => {
            const saved = await store.saveInventoryCountDraft(draft);
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
            return store.saveInventoryCountDraft(draft);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmState)}
        onOpenChange={(open) => !open && setConfirmState(null)}
        title={
          confirmState?.type === 'post'
            ? `Knjiženje popisa ${confirmState.doc.docNumber}`
            : confirmState?.type === 'delete'
            ? `Brisanje nacrta ${confirmState.doc.docNumber}`
            : confirmState?.type === 'reverse'
            ? `Storniranje popisa ${confirmState.doc.docNumber}`
            : ''
        }
        description={
          confirmState?.type === 'post'
            ? 'Da li ste sigurni da želite proknjižiti ovaj popis robe? Zalihe i KEP knjiga će biti usklađeni sa popisanim količinama.'
            : confirmState?.type === 'delete'
            ? 'Da li ste sigurni da želite trajno obrisati ovaj nacrt popisa?'
            : confirmState?.type === 'reverse'
            ? 'Storniranjem se kreira protuknjiženje i poništavaju inventurni viškovi i manjkovi.'
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
export default InventoryCountPage;
