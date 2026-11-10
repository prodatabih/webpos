import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Eye, CheckCircle2, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { t } from '../../i18n';
import { d, formatMoney2 } from '../../lib/money';
import { formatDateBs, generateUuidV7 } from '../../lib/utils';
import type { TransferDocument } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { DocumentStatusBadge } from '../../components/ui/Badge';
import { showToast } from '../../components/ui/Toast';
import { TransferDialog } from './TransferDialog';

export function TransfersPage() {
  const store = useAppStore();
  const [editingDoc, setEditingDoc] = useState<TransferDocument | null>(null);

  const storeTransfers = useMemo(
    () =>
      store.transfers.filter(
        (tr) =>
          tr.sourceStoreId === store.activeStoreId || tr.targetStoreId === store.activeStoreId
      ),
    [store.transfers, store.activeStoreId]
  );

  const handleCreateNew = () => {
    const seq = String(store.transfers.length + 1).padStart(4, '0');
    const today = new Date().toISOString().slice(0, 10);
    const otherStore = store.storeLocations.find((s) => s.id !== store.activeStoreId);
    const newDoc: TransferDocument = {
      id: generateUuidV7(),
      companyId: store.activeCompanyId,
      fiscalYearId: store.activeFiscalYearId,
      sourceStoreId: store.activeStoreId,
      targetStoreId: otherStore?.id ?? store.activeStoreId,
      docNumber: `MS-2026-${seq}`,
      docDate: today,
      status: 'DRAFT',
      notes: '',
      lines: [],
      totalPurchaseValue: '0.00',
      totalSourceRetailValue: '0.00',
      totalTargetRetailValue: '0.00',
      createdBy: store.currentUserName,
      createdAt: new Date().toISOString(),
    };
    store.saveTransferDraft(newDoc);
    setEditingDoc(newDoc);
  };

  const handlePost = (docId: string) => {
    const res = store.postTransfer(docId);
    if (res.ok) {
      showToast({ title: t('messages.documentPosted'), variant: 'success' });
    } else if (res.error) {
      showToast({ title: res.error, variant: 'error' });
    }
  };

  const handleReverse = (docId: string) => {
    const res = store.reverseTransfer(docId);
    if (res.ok) {
      showToast({ title: t('messages.documentReversed'), variant: 'info' });
    } else if (res.error) {
      showToast({ title: res.error, variant: 'error' });
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
                <Button variant="success" size="sm" onClick={() => handlePost(tr.id)}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{t('common.postDocument')}</span>
                </Button>
              )}
              {tr.status === 'POSTED' && (
                <Button variant="destructive" size="sm" onClick={() => handleReverse(tr.id)}>
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
          company={store.companies.find((c) => c.id === store.activeCompanyId) ?? store.companies[0]!}
          storeLocations={store.storeLocations}
          items={store.items}
          vatRates={store.vatRates}
          storePrices={store.storeItemPrices}
          onSaveDraft={(draft) => {
            const res = store.saveTransferDraft(draft);
            if (res.ok) {
              showToast({ title: t('messages.documentSavedDraft'), variant: 'success' });
              setEditingDoc(null);
            } else if (res.error) {
              showToast({ title: res.error, variant: 'error' });
            }
          }}
          onPostDocument={(draft) => {
            const saved = store.saveTransferDraft(draft);
            if (!saved.ok) {
              if (saved.error) showToast({ title: saved.error, variant: 'error' });
              return;
            }
            handlePost(draft.id);
            setEditingDoc(null);
          }}
          onAutoSave={(draft) => {
            store.saveTransferDraft(draft);
          }}
        />
      )}
    </div>
  );
}
export default TransfersPage;
