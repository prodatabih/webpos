import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Eye, CheckCircle2, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { t } from '../../i18n';
import { formatMoney2 } from '../../lib/money';
import { formatDateBs, generateUuidV7 } from '../../lib/utils';
import type { InventoryCountDocument } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { DocumentStatusBadge } from '../../components/ui/Badge';
import { showToast } from '../../components/ui/Toast';
import { InventoryCountDialog } from './InventoryCountDialog';

export function InventoryCountPage() {
  const store = useAppStore();
  const [editingDoc, setEditingDoc] = useState<InventoryCountDocument | null>(null);

  const storeCounts = useMemo(
    () => store.inventoryCounts.filter((ic) => ic.storeId === store.activeStoreId),
    [store.inventoryCounts, store.activeStoreId]
  );

  const handleCreateNew = () => {
    const seq = String(storeCounts.length + 1).padStart(4, '0');
    const today = new Date().toISOString().slice(0, 10);
    setEditingDoc({
      id: generateUuidV7(),
      companyId: store.activeCompanyId,
      fiscalYearId: store.activeFiscalYearId,
      storeId: store.activeStoreId,
      docNumber: `POP-2026-${seq}`,
      docDate: today,
      status: 'DRAFT',
      commissionMembers: store.currentUserName,
      notes: '',
      lines: [],
      totalSurplusRetailValue: '0.00',
      totalShortageRetailValue: '0.00',
      createdBy: store.currentUserName,
      createdAt: new Date().toISOString(),
    });
  };

  const handlePost = (docId: string) => {
    const res = store.postInventoryCount(docId);
    if (res.ok) {
      showToast({ title: t('messages.documentPosted'), variant: 'success' });
    } else if (res.error) {
      showToast({ title: res.error, variant: 'error' });
    }
  };

  const handleReverse = (docId: string) => {
    const res = store.reverseInventoryCount(docId);
    if (res.ok) {
      showToast({ title: t('messages.documentReversed'), variant: 'info' });
    } else if (res.error) {
      showToast({ title: res.error, variant: 'error' });
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
                <Button variant="success" size="sm" onClick={() => handlePost(ic.id)}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{t('common.postDocument')}</span>
                </Button>
              )}
              {ic.status === 'POSTED' && (
                <Button variant="destructive" size="sm" onClick={() => handleReverse(ic.id)}>
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
          company={store.companies.find((c) => c.id === store.activeCompanyId) ?? store.companies[0]!}
          storeLocation={store.storeLocations.find((s) => s.id === store.activeStoreId) ?? store.storeLocations[0]!}
          items={store.items}
          vatRates={store.vatRates}
          storePrices={store.storeItemPrices}
          onSaveDraft={(draft) => {
            const res = store.saveInventoryCountDraft(draft);
            if (res.ok) {
              showToast({ title: t('messages.documentSavedDraft'), variant: 'success' });
              setEditingDoc(null);
            } else if (res.error) {
              showToast({ title: res.error, variant: 'error' });
            }
          }}
          onPostDocument={(draft) => {
            const saved = store.saveInventoryCountDraft(draft);
            if (!saved.ok) {
              if (saved.error) showToast({ title: saved.error, variant: 'error' });
              return;
            }
            handlePost(draft.id);
            setEditingDoc(null);
          }}
        />
      )}
    </div>
  );
}
export default InventoryCountPage;
