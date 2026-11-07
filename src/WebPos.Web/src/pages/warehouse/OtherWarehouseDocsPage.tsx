import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Eye, CheckCircle2, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { t } from '../../i18n';
import { formatMoney2 } from '../../lib/money';
import { formatDateBs, generateUuidV7 } from '../../lib/utils';
import type { OtherWarehouseDocSubtype, OtherWarehouseDocument } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge, DocumentStatusBadge } from '../../components/ui/Badge';
import { showToast } from '../../components/ui/Toast';
import { OtherWarehouseDocDialog } from './OtherWarehouseDocDialog';

export function OtherWarehouseDocsPage() {
  const store = useAppStore();
  const [editingDoc, setEditingDoc] = useState<OtherWarehouseDocument | null>(null);

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
    const seq = String(storeDocs.length + 1).padStart(4, '0');
    const today = new Date().toISOString().slice(0, 10);
    setEditingDoc({
      id: generateUuidV7(),
      companyId: store.activeCompanyId,
      fiscalYearId: store.activeFiscalYearId,
      storeId: store.activeStoreId,
      docNumber: `ZAP-2026-${seq}`,
      docDate: today,
      subtype: 'WRITEOFF_KALORASTUR',
      status: 'DRAFT',
      notes: '',
      lines: [],
      totalPurchaseValue: '0.00',
      totalRetailValueWithVat: '0.00',
      createdBy: store.currentUserName,
      createdAt: new Date().toISOString(),
    });
  };

  const handlePost = (docId: string) => {
    const res = store.postOtherWarehouseDoc(docId);
    if (res.ok) {
      showToast({ title: t('messages.documentPosted'), variant: 'success' });
    } else if (res.error) {
      showToast({ title: res.error, variant: 'error' });
    }
  };

  const handleReverse = (docId: string) => {
    const res = store.reverseOtherWarehouseDoc(docId);
    if (res.ok) {
      showToast({ title: t('messages.documentReversed'), variant: 'info' });
    } else if (res.error) {
      showToast({ title: res.error, variant: 'error' });
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
                <Button variant="success" size="sm" onClick={() => handlePost(ow.id)}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{t('common.postDocument')}</span>
                </Button>
              )}
              {ow.status === 'POSTED' && (
                <Button variant="destructive" size="sm" onClick={() => handleReverse(ow.id)}>
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
          items={store.items}
          partners={store.partners}
          vatRates={store.vatRates}
          storePrices={store.storeItemPrices}
          onSaveDraft={(draft) => {
            const res = store.saveOtherWarehouseDraft(draft);
            if (res.ok) {
              showToast({ title: t('messages.documentSavedDraft'), variant: 'success' });
              setEditingDoc(null);
            } else if (res.error) {
              showToast({ title: res.error, variant: 'error' });
            }
          }}
          onPostDocument={(draft) => {
            const saved = store.saveOtherWarehouseDraft(draft);
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
export default OtherWarehouseDocsPage;
