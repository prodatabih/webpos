import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { t } from '../../i18n';
import { formatMoney2 } from '../../lib/money';
import { useListNewShortcut } from '../../lib/keyboardGridUtils';
import { useAppStore } from '../../store/useAppStore';
import type { Partner, PartnerType } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { showToast } from '../../components/ui/Toast';
import { PartnerFormDialog } from './PartnerFormDialog';

export function PartnersPage() {
  const { activeCompanyId, partners, deletePartner } = useAppStore();
  const [typeFilter, setTypeFilter] = useState<'ALL' | PartnerType>('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Partner | null>(null);

  const handleCreateNew = () => {
    setEditingPartner(null);
    setDialogOpen(true);
  };

  useListNewShortcut(handleCreateNew, !dialogOpen && !deleteTarget);

  const filteredPartners = useMemo(() => {
    return partners
      .filter((p) => !p.companyId || !activeCompanyId || p.companyId === activeCompanyId)
      .filter((p) => (typeFilter === 'ALL' ? true : p.partnerType === typeFilter));
  }, [partners, activeCompanyId, typeFilter]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await deletePartner(deleteTarget.id);
    if (!res.ok) {
      showToast({ title: t('common.errorTitle'), description: res.error, variant: 'error' });
      setDeleteTarget(null);
      return;
    }
    showToast({ title: 'Poslovni partner je uspješno obrisan.', variant: 'success' });
    setDeleteTarget(null);
  };

  const partnerTypeBadge = (pt: PartnerType) => {
    if (pt === 'SUPPLIER') {
      return <Badge variant="secondary">{t('master.partnerSupplier')}</Badge>;
    }
    if (pt === 'BUYER') {
      return <Badge variant="default">{t('master.partnerBuyer')}</Badge>;
    }
    return <Badge variant="outline">{t('master.partnerBoth')}</Badge>;
  };

  const columns = useMemo<ColumnDef<Partner>[]>(
    () => [
      {
        accessorKey: 'code',
        header: t('common.code'),
        cell: ({ row }) => (
          <span className="font-mono font-semibold text-foreground">{row.original.code}</span>
        ),
      },
      {
        accessorKey: 'name',
        header: t('common.name'),
        cell: ({ row }) => {
          const location = [row.original.address, row.original.city]
            .filter((v) => v && v.trim())
            .join(', ');
          return (
            <div className="flex flex-col">
              <span className="font-medium text-foreground">{row.original.name}</span>
              {location && (
                <span className="text-[11px] text-muted-foreground">{location}</span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'partnerType',
        header: t('master.partnerType'),
        cell: ({ row }) => partnerTypeBadge(row.original.partnerType),
      },
      {
        accessorKey: 'taxIdNumber',
        header: t('master.taxIdNumber'),
        cell: ({ row }) => (
          <span className="font-mono">{row.original.taxIdNumber || '-'}</span>
        ),
      },
      {
        accessorKey: 'vatIdNumber',
        header: t('master.vatIdNumber'),
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground">
            {row.original.vatIdNumber || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'paymentTermsDays',
        header: t('master.paymentTermsDays'),
        cell: ({ row }) => (
          <div className="text-right font-mono">{row.original.paymentTermsDays}</div>
        ),
      },
      {
        accessorKey: 'creditLimit',
        header: t('master.creditLimit'),
        cell: ({ row }) => (
          <div className="text-right font-mono font-semibold">
            {formatMoney2(row.original.creditLimit, true)}
          </div>
        ),
      },
      {
        accessorKey: 'isActive',
        header: t('common.status'),
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'success' : 'secondary'}>
            {row.original.isActive ? t('common.active') : t('common.inactive')}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: t('common.actions'),
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setEditingPartner(row.original);
                setDialogOpen(true);
              }}
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span>{t('common.edit')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(row.original);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{t('common.delete')}</span>
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title={t('nav.partners')}
        breadcrumbs={[
          { label: t('nav.groupMasterData') },
          { label: t('nav.partners') },
        ]}
        primaryAction={
          <Button variant="primary" onClick={handleCreateNew}>
            <Plus className="h-4 w-4" />
            <span>{t('common.create')}</span>
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        <DataTable
          data={filteredPartners}
          columns={columns}
          exportFileName="poslovni-partneri"
          onRowClick={(row) => {
            setEditingPartner(row);
            setDialogOpen(true);
          }}
          toolbarExtras={
            <select
              aria-label={t('master.partnerType')}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'ALL' | PartnerType)}
              className="h-8 rounded-md border border-input bg-card px-2.5 text-xs text-foreground"
            >
              <option value="ALL">{t('common.all')}</option>
              <option value="SUPPLIER">{t('master.partnerSupplier')}</option>
              <option value="BUYER">{t('master.partnerBuyer')}</option>
              <option value="BOTH">{t('master.partnerBoth')}</option>
            </select>
          }
        />
      </div>

      <PartnerFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editingPartner={editingPartner}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        variant="destructive"
        title={deleteTarget ? `Obrisati partnera "${deleteTarget.name}"?` : ''}
        description="Brisanje poslovnog partnera je nepovratno i moguće je samo ako partner nema povezanih dokumenata ili računa."
        confirmLabel={t('common.delete')}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

export default PartnersPage;
