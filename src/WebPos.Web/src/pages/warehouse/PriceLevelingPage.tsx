import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Eye, CheckCircle2, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { t } from '../../i18n';
import { formatMoney2 } from '../../lib/money';
import { formatDateBs, generateUuidV7 } from '../../lib/utils';
import { EMPTY_COMPANY_FALLBACK, EMPTY_STORE_FALLBACK } from '../../lib/emptyOrgFallbacks';
import type { PriceLevelingDocument } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { DocumentStatusBadge } from '../../components/ui/Badge';
import { showToast } from '../../components/ui/Toast';
import { PriceLevelingDialog } from './PriceLevelingDialog';

export function PriceLevelingPage() {
  const store = useAppStore();
  const [editingDoc, setEditingDoc] = useState<PriceLevelingDocument | null>(null);

  const storeLevelings = useMemo(
    () => store.priceLevelings.filter((p) => p.storeId === store.activeStoreId),
    [store.priceLevelings, store.activeStoreId]
  );

  const handleCreateNew = () => {
    const seq = String(storeLevelings.length + 1).padStart(4, '0');
    const today = new Date().toISOString().slice(0, 10);
    const newDoc: PriceLevelingDocument = {
      id: generateUuidV7(),
      companyId: store.activeCompanyId,
      fiscalYearId: store.activeFiscalYearId,
      storeId: store.activeStoreId,
      docNumber: `NIV-2026-${seq}`,
      docDate: today,
      status: 'DRAFT',
      reason: '',
      lines: [],
      totalRetailDifference: '0.00',
      totalVatDifference: '0.00',
      totalMarginDifference: '0.00',
      createdBy: store.currentUserName,
      createdAt: new Date().toISOString(),
    };
    store.savePriceLevelingDraft(newDoc);
    setEditingDoc(newDoc);
  };

  const handlePost = (docId: string) => {
    const res = store.postPriceLeveling(docId);
    if (res.ok) {
      showToast({ title: t('messages.documentPosted'), variant: 'success' });
    } else if (res.error) {
      showToast({ title: res.error, variant: 'error' });
    }
  };

  const handleReverse = (docId: string) => {
    const res = store.reversePriceLeveling(docId);
    if (res.ok) {
      showToast({ title: t('messages.documentReversed'), variant: 'info' });
    } else if (res.error) {
      showToast({ title: res.error, variant: 'error' });
    }
  };

  const columns = useMemo<ColumnDef<PriceLevelingDocument>[]>(
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
        accessorKey: 'reason',
        header: t('common.description'),
      },
      {
        accessorKey: 'totalMarginDifference',
        header: t('warehouse.marginDifference'),
        cell: ({ row }) => (
          <span className="font-mono">{formatMoney2(row.original.totalMarginDifference, true)}</span>
        ),
      },
      {
        accessorKey: 'totalVatDifference',
        header: t('warehouse.vatDifference'),
        cell: ({ row }) => (
          <span className="font-mono">{formatMoney2(row.original.totalVatDifference, true)}</span>
        ),
      },
      {
        accessorKey: 'totalRetailDifference',
        header: t('warehouse.priceDifference'),
        cell: ({ row }) => (
          <span className="font-mono font-semibold">
            {formatMoney2(row.original.totalRetailDifference, true)}
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
          const doc = row.original;
          return (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" onClick={() => setEditingDoc(doc)}>
                <Eye className="h-3.5 w-3.5" />
                <span>{doc.status === 'DRAFT' ? t('common.edit') : t('common.view')}</span>
              </Button>
              {doc.status === 'DRAFT' && (
                <Button variant="success" size="sm" onClick={() => handlePost(doc.id)}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{t('common.postDocument')}</span>
                </Button>
              )}
              {doc.status === 'POSTED' && (
                <Button variant="destructive" size="sm" onClick={() => handleReverse(doc.id)}>
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
        title={t('nav.priceLeveling')}
        breadcrumbs={[{ label: t('nav.groupWarehouse') }, { label: t('nav.priceLeveling') }]}
        primaryAction={
          <Button variant="primary" size="sm" onClick={handleCreateNew}>
            <Plus className="h-4 w-4" />
            <span>{t('common.newDocument')}</span>
          </Button>
        }
      />

      <div className="p-6">
        <DataTable
          data={storeLevelings}
          columns={columns}
          exportFileName="price-levelings"
          onRowClick={setEditingDoc}
        />
      </div>

      {editingDoc && (
        <PriceLevelingDialog
          key={editingDoc.id}
          open={Boolean(editingDoc)}
          onOpenChange={(open) => !open && setEditingDoc(null)}
          initialDoc={editingDoc}
          company={store.companies.find((c) => c.id === store.activeCompanyId) ?? store.companies[0] ?? EMPTY_COMPANY_FALLBACK}
          storeLocation={store.storeLocations.find((s) => s.id === store.activeStoreId) ?? store.storeLocations[0] ?? EMPTY_STORE_FALLBACK}
          items={store.items}
          vatRates={store.vatRates}
          storePrices={store.storeItemPrices}
          onSaveDraft={(draft) => {
            const res = store.savePriceLevelingDraft(draft);
            if (res.ok) {
              showToast({ title: t('messages.documentSavedDraft'), variant: 'success' });
              setEditingDoc(null);
            } else if (res.error) {
              showToast({ title: res.error, variant: 'error' });
            }
          }}
          onPostDocument={(draft) => {
            const saved = store.savePriceLevelingDraft(draft);
            if (!saved.ok) {
              if (saved.error) showToast({ title: saved.error, variant: 'error' });
              return;
            }
            handlePost(draft.id);
            setEditingDoc(null);
          }}
          onAutoSave={(draft) => {
            store.savePriceLevelingDraft(draft);
          }}
        />
      )}
    </div>
  );
}
export default PriceLevelingPage;
