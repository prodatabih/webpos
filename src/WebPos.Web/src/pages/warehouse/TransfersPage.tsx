import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Eye, CheckCircle2, RotateCcw, Trash2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { t } from '../../i18n';
import { d, formatMoney2 } from '../../lib/money';
import { formatDateBs, generateUuidV7 } from '../../lib/utils';
import { useListNewShortcut } from '../../lib/keyboardGridUtils';
import { EMPTY_COMPANY_FALLBACK } from '../../lib/emptyOrgFallbacks';
import type { TransferDocument } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { DocumentStatusBadge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { showToast } from '../../components/ui/Toast';
import { TransferDialog } from './TransferDialog';
import { buildBlankTransferLine } from './transferUtils';

type ConfirmState =
  | { type: 'post'; doc: TransferDocument }
  | { type: 'delete'; doc: TransferDocument }
  | { type: 'reverse'; doc: TransferDocument }
  | null;

export function TransfersPage() {
  const store = useAppStore();
  const [editingDoc, setEditingDoc] = useState<TransferDocument | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const storeTransfers = useMemo(
    () =>
      store.transfers.filter(
        (tr) =>
          tr.sourceStoreId === store.activeStoreId || tr.targetStoreId === store.activeStoreId
      ),
    [store.transfers, store.activeStoreId]
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
    const seq = String(store.transfers.length + 1).padStart(4, '0');
    const today = new Date().toISOString().slice(0, 10);
    const activeYear =
      store.fiscalYears.find((fy) => fy.id === store.activeFiscalYearId)?.year ??
      new Date().getFullYear();
    const otherStore = store.storeLocations.find(
      (s) => s.isActive && s.id !== store.activeStoreId
    );
    const newDoc: TransferDocument = {
      id: generateUuidV7(),
      companyId: store.activeCompanyId,
      fiscalYearId: store.activeFiscalYearId,
      sourceStoreId: store.activeStoreId,
      targetStoreId: otherStore?.id ?? '',
      docNumber: `MS-${activeYear}-${seq}`,
      docDate: today,
      status: 'DRAFT',
      notes: '',
      lines: [buildBlankTransferLine()],
      totalPurchaseValue: '0.00',
      totalSourceRetailValue: '0.00',
      totalTargetRetailValue: '0.00',
      createdBy: store.currentUserName,
      createdAt: new Date().toISOString(),
    };
    setEditingDoc(newDoc);
  };

  useListNewShortcut(handleCreateNew, !editingDoc);

  const executePost = async (docId: string) => {
    const res = await store.postTransfer(docId);
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
      const res = await store.deleteTransferDraft(confirmState.doc.id);
      if (res.ok) {
        showToast({ title: 'Nacrt međuskladišnice je uspješno obrisan.', variant: 'success' });
        setConfirmState(null);
      } else {
        showToast({ title: res.error || t('common.errorTitle'), variant: 'error' });
      }
      return;
    }
    if (confirmState.type === 'reverse') {
      const res = await store.reverseTransfer(confirmState.doc.id, reason);
      if (res.ok) {
        showToast({ title: t('messages.documentReversed'), variant: 'info' });
        setConfirmState(null);
      } else {
        showToast({ title: res.error || t('common.errorTitle'), variant: 'error' });
      }
    }
  };

  const columns = useMemo<ColumnDef<TransferDocument>[]>(
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
        accessorKey: 'sourceStoreId',
        header: t('warehouse.sourceStore'),
        cell: ({ row }) =>
          store.storeLocations.find((s) => s.id === row.original.sourceStoreId)?.name ?? '-',
      },
      {
        accessorKey: 'targetStoreId',
        header: t('warehouse.targetStore'),
        cell: ({ row }) =>
          store.storeLocations.find((s) => s.id === row.original.targetStoreId)?.name ?? '-',
      },
      {
        accessorKey: 'totalSourceRetailValue',
        header: t('warehouse.oldRetailPrice'),
        cell: ({ row }) => (
          <span className="font-mono">
            {formatMoney2(row.original.totalSourceRetailValue, true)}
          </span>
        ),
      },
      {
        accessorKey: 'totalTargetRetailValue',
        header: t('warehouse.newRetailPrice'),
        cell: ({ row }) => (
          <span className="font-mono font-semibold">
            {formatMoney2(row.original.totalTargetRetailValue, true)}
          </span>
        ),
      },
      {
        id: 'priceDiff',
        header: t('warehouse.priceDifference'),
        cell: ({ row }) => {
          const diff = d(row.original.totalTargetRetailValue).minus(
            d(row.original.totalSourceRetailValue)
          );
          return <span className="font-mono">{formatMoney2(diff, true)}</span>;
        },
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
          const tr = row.original;
          return (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" onClick={() => setEditingDoc(tr)}>
                <Eye className="h-3.5 w-3.5" />
                <span>{tr.status === 'DRAFT' ? t('common.edit') : t('common.view')}</span>
              </Button>
              {tr.status === 'DRAFT' && (
                <>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => setConfirmState({ type: 'post', doc: tr })}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{t('common.postDocument')}</span>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmState({ type: 'delete', doc: tr })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{t('common.delete')}</span>
                  </Button>
                </>
              )}
              {tr.status === 'POSTED' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmState({ type: 'reverse', doc: tr })}
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
    [store.storeLocations]
  );

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t('nav.transfers')}
        breadcrumbs={[{ label: t('nav.groupWarehouse') }, { label: t('nav.transfers') }]}
        primaryAction={
          <Button variant="primary" size="sm" onClick={handleCreateNew}>
            <Plus className="h-4 w-4" />
            <span>{t('common.newDocument')}</span>
          </Button>
        }
      />

      <div className="p-6">
        <DataTable
          data={storeTransfers}
          columns={columns}
          exportFileName="transfers"
          onRowClick={setEditingDoc}
        />
      </div>

      {editingDoc && (
        <TransferDialog
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
          items={store.items}
          vatRates={store.vatRates}
          storePrices={store.storeItemPrices}
          onSaveDraft={async (draft) => {
            const res = await store.saveTransferDraft(draft);
            if (res.ok) {
              showToast({ title: t('messages.documentSavedDraft'), variant: 'success' });
              setEditingDoc(null);
            } else {
              showToast({ title: res.error || t('common.errorTitle'), variant: 'error' });
            }
            return res;
          }}
          onPostDocument={async (draft) => {
            const saved = await store.saveTransferDraft(draft);
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
            if (
              !draft.sourceStoreId ||
              !draft.targetStoreId ||
              draft.sourceStoreId === draft.targetStoreId ||
              !draft.lines.some((l) => Boolean(l.itemId))
            ) {
              return { ok: false };
            }
            return store.saveTransferDraft(draft);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmState)}
        onOpenChange={(open) => !open && setConfirmState(null)}
        title={
          confirmState?.type === 'post'
            ? `Knjiženje međuskladišnice ${confirmState.doc.docNumber}`
            : confirmState?.type === 'delete'
            ? `Brisanje nacrta ${confirmState.doc.docNumber}`
            : confirmState?.type === 'reverse'
            ? `Storniranje međuskladišnice ${confirmState.doc.docNumber}`
            : ''
        }
        description={
          confirmState?.type === 'post'
            ? 'Da li ste sigurni da želite proknjižiti ovu međuskladišnicu? Zaliha će biti razdužena sa izlaznog i zadužena na ulaznom skladištu.'
            : confirmState?.type === 'delete'
            ? 'Da li ste sigurni da želite trajno obrisati ovaj nacrt međuskladišnice?'
            : confirmState?.type === 'reverse'
            ? 'Storniranjem se kreira protuknjiženje i poništava prenos robe između skladišta.'
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
export default TransfersPage;
