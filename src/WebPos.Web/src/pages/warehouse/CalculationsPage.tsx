import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Eye, CheckCircle2, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { t } from '../../i18n';
import { formatMoney2 } from '../../lib/money';
import { formatDateBs, generateUuidV7 } from '../../lib/utils';
import type { CalculationDocument } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { DocumentStatusBadge } from '../../components/ui/Badge';
import { showToast } from '../../components/ui/Toast';
import { CalculationEditorDialog } from './CalculationEditorDialog';

export function CalculationsPage() {
  const store = useAppStore();
  const [editingDoc, setEditingDoc] = useState<CalculationDocument | null>(null);

  const storeCalcs = useMemo(
    () => store.calculations.filter((c) => c.storeId === store.activeStoreId),
    [store.calculations, store.activeStoreId]
  );

  const handleCreateNew = () => {
    const seq = String(storeCalcs.length + 1).padStart(4, '0');
    const today = new Date().toISOString().slice(0, 10);
    setEditingDoc({
      id: generateUuidV7(),
      companyId: store.activeCompanyId,
      fiscalYearId: store.activeFiscalYearId,
      storeId: store.activeStoreId,
      docNumber: `KALK-2026-${seq}`,
      docDate: today,
      partnerId: store.partners.find((p) => p.partnerType !== 'BUYER')?.id ?? '',
      supplierInvoiceNumber: '',
      supplierInvoiceDate: today,
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
    });
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

  const columns = useMemo<ColumnDef<CalculationDocument>[]>(
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
        accessorKey: 'partnerId',
        header: t('warehouse.supplier'),
        cell: ({ row }) =>
          store.partners.find((p) => p.id === row.original.partnerId)?.name ?? '-',
      },
      {
        accessorKey: 'supplierInvoiceNumber',
        header: t('warehouse.supplierInvoiceNumber'),
        cell: ({ row }) => <span className="font-mono">{row.original.supplierInvoiceNumber}</span>,
      },
      {
        accessorKey: 'totalPurchaseValue',
        header: t('warehouse.purchaseValue'),
        cell: ({ row }) => (
          <span className="font-mono">{formatMoney2(row.original.totalPurchaseValue, true)}</span>
        ),
      },
      {
        accessorKey: 'totalMarginAmount',
        header: t('warehouse.marginAmount'),
        cell: ({ row }) => (
          <span className="font-mono">{formatMoney2(row.original.totalMarginAmount, true)}</span>
        ),
      },
      {
        accessorKey: 'totalEmbeddedVatAmount',
        header: t('warehouse.embeddedVat'),
        cell: ({ row }) => (
          <span className="font-mono">
            {formatMoney2(row.original.totalEmbeddedVatAmount, true)}
          </span>
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
          const c = row.original;
          return (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" onClick={() => setEditingDoc(c)}>
                <Eye className="h-3.5 w-3.5" />
                <span>{c.status === 'DRAFT' ? t('common.edit') : t('common.view')}</span>
              </Button>
              {c.status === 'DRAFT' && (
                <Button variant="success" size="sm" onClick={() => handlePost(c.id)}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{t('common.postDocument')}</span>
                </Button>
              )}
              {c.status === 'POSTED' && (
                <Button variant="destructive" size="sm" onClick={() => handleReverse(c.id)}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{t('common.reverseDocument')}</span>
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [store.partners]
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
        />
      )}
    </div>
  );
}
export default CalculationsPage;
