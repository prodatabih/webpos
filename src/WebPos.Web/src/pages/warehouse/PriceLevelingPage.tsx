import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Eye, CheckCircle2, RotateCcw, Trash2 } from 'lucide-react';
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
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { showToast } from '../../components/ui/Toast';
import { PriceLevelingDialog } from './PriceLevelingDialog';
import { buildBlankLevelingLine } from './priceLevelingUtils';

type ConfirmState =
  | { type: 'post'; doc: PriceLevelingDocument }
  | { type: 'delete'; doc: PriceLevelingDocument }
  | { type: 'reverse'; doc: PriceLevelingDocument }
  | null;

export function PriceLevelingPage() {
  const store = useAppStore();
  const [editingDoc, setEditingDoc] = useState<PriceLevelingDocument | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const storeLevelings = useMemo(
    () => store.priceLevelings.filter((p) => p.storeId === store.activeStoreId),
    [store.priceLevelings, store.activeStoreId]
  );

  const handleOpenDoc = (doc: PriceLevelingDocument) => {
    if (doc.status === 'DRAFT' && doc.lines.length === 0) {
      setEditingDoc({ ...doc, lines: [buildBlankLevelingLine()] });
    } else {
      setEditingDoc(doc);
    }
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
    const seq = String(storeLevelings.length + 1).padStart(4, '0');
    const today = new Date().toISOString().slice(0, 10);
    const activeYear =
      store.fiscalYears.find((fy) => fy.id === store.activeFiscalYearId)?.year ??
      new Date().getFullYear();
    const newDoc: PriceLevelingDocument = {
      id: generateUuidV7(),
      companyId: store.activeCompanyId,
      fiscalYearId: store.activeFiscalYearId,
      storeId: store.activeStoreId,
      docNumber: `NIV-${activeYear}-${seq}`,
      docDate: today,
      status: 'DRAFT',
      reason: '',
      lines: [buildBlankLevelingLine()],
      totalRetailDifference: '0.00',
      totalVatDifference: '0.00',
      totalMarginDifference: '0.00',
      createdBy: store.currentUserName,
      createdAt: new Date().toISOString(),
    };
    setEditingDoc(newDoc);
  };

  const executePost = async (docId: string) => {
    const res = await store.postPriceLeveling(docId);
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
      const res = await store.deletePriceLevelingDraft(confirmState.doc.id);
      if (res.ok) {
        showToast({ title: 'Nacrt nivelacije je uspješno obrisan.', variant: 'success' });
        setConfirmState(null);
      } else {
        showToast({ title: res.error || t('common.errorTitle'), variant: 'error' });
      }
      return;
    }
    if (confirmState.type === 'reverse') {
      const res = await store.reversePriceLeveling(confirmState.doc.id, reason);
      if (res.ok) {
        showToast({ title: t('messages.documentReversed'), variant: 'info' });
        setConfirmState(null);
      } else {
        showToast({ title: res.error || t('common.errorTitle'), variant: 'error' });
      }
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
              <Button variant="ghost" size="sm" onClick={() => handleOpenDoc(doc)}>
                <Eye className="h-3.5 w-3.5" />
                <span>{doc.status === 'DRAFT' ? t('common.edit') : t('common.view')}</span>
              </Button>
              {doc.status === 'DRAFT' && (
                <>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => setConfirmState({ type: 'post', doc })}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{t('common.postDocument')}</span>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmState({ type: 'delete', doc })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{t('common.delete')}</span>
                  </Button>
                </>
              )}
              {doc.status === 'POSTED' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmState({ type: 'reverse', doc })}
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
          onRowClick={handleOpenDoc}
        />
      </div>

      {editingDoc && (
        <PriceLevelingDialog
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
            const res = await store.savePriceLevelingDraft(draft);
            if (res.ok) {
              showToast({ title: t('messages.documentSavedDraft'), variant: 'success' });
              setEditingDoc(null);
            } else {
              showToast({ title: res.error || t('common.errorTitle'), variant: 'error' });
            }
            return res;
          }}
          onPostDocument={async (draft) => {
            const saved = await store.savePriceLevelingDraft(draft);
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
            return store.savePriceLevelingDraft(draft);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmState)}
        onOpenChange={(open) => !open && setConfirmState(null)}
        title={
          confirmState?.type === 'post'
            ? `Knjiženje nivelacije ${confirmState.doc.docNumber}`
            : confirmState?.type === 'delete'
            ? `Brisanje nacrta ${confirmState.doc.docNumber}`
            : confirmState?.type === 'reverse'
            ? `Storniranje nivelacije ${confirmState.doc.docNumber}`
            : ''
        }
        description={
          confirmState?.type === 'post'
            ? 'Da li ste sigurni da želite proknjižiti ovu nivelaciju cijena? Maloprodajne cijene i KEP knjiga će biti ažurirani.'
            : confirmState?.type === 'delete'
            ? 'Da li ste sigurni da želite trajno obrisati ovaj nacrt nivelacije?'
            : confirmState?.type === 'reverse'
            ? 'Storniranjem se kreira protuknjiženje i poništavaju efekti nivelacije.'
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
export default PriceLevelingPage;
