import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { t } from '../../i18n';
import { formatMoney2, formatPrice4, formatQty, d } from '../../lib/money';
import { useListNewShortcut } from '../../lib/keyboardGridUtils';
import { useAppStore } from '../../store/useAppStore';
import type { Item, ItemType } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { showToast } from '../../components/ui/Toast';
import { ItemFormDialog } from './ItemFormDialog';

interface ItemRow extends Item {
  vatCode: string;
  vatRatePercent: string;
  purchasePrice: string;
  retailPrice: string;
  stockQty: string;
  minStockQty: string;
}

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

export function ItemsPage() {
  const {
    activeCompanyId,
    activeStoreId,
    items,
    vatRates,
    storeItemPrices,
    deleteItem,
  } = useAppStore();

  const [typeFilter, setTypeFilter] = useState<'ALL' | ItemType>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

  const handleCreateNew = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  useListNewShortcut(handleCreateNew, !dialogOpen && !deleteTarget);

  const rows = useMemo<ItemRow[]>(() => {
    return items
      .filter((item) => !item.companyId || !activeCompanyId || item.companyId === activeCompanyId)
      .filter((item) => (typeFilter === 'ALL' ? true : item.itemType === typeFilter))
      .filter((item) => {
        if (statusFilter === 'ACTIVE') return item.isActive;
        if (statusFilter === 'INACTIVE') return !item.isActive;
        return true;
      })
      .map((item) => {
        const vr = vatRates.find((v) => v.id === item.vatRateId);
        const sp = storeItemPrices.find(
          (p) => p.storeId === activeStoreId && p.itemId === item.id
        );
        return {
          ...item,
          vatCode: vr ? `${vr.code} (${formatMoney2(vr.ratePercent)}%)` : item.vatRateId,
          vatRatePercent: vr?.ratePercent ?? '17.00',
          purchasePrice: sp?.purchaseUnitPrice ?? '0.0000',
          retailPrice: sp?.retailUnitPriceWithVat ?? '0.00',
          stockQty: sp?.currentStockQty ?? '0.0000',
          minStockQty: sp?.minStockQty ?? '0.0000',
        };
      });
  }, [items, activeCompanyId, typeFilter, statusFilter, vatRates, storeItemPrices, activeStoreId]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await deleteItem(deleteTarget.id);
    if (!res.ok) {
      showToast({ title: t('common.errorTitle'), description: res.error, variant: 'error' });
      setDeleteTarget(null);
      return;
    }
    const successMsg =
      res.message ||
      (res.deactivated && !res.deleted
        ? `Artikal "${deleteTarget.name}" je deaktiviran jer ima povezane dokumente.`
        : `Artikal "${deleteTarget.name}" je uspješno obrisan.`);
    showToast({ title: successMsg, variant: 'success' });
    setDeleteTarget(null);
  };

  const itemTypeLabel = (it: ItemType): string => {
    if (it === 'GOODS') return t('master.typeGoods');
    if (it === 'SERVICE') return t('master.typeService');
    if (it === 'COMPOSITE') return t('master.typeComposite');
    return t('master.typeRawMaterial');
  };

  const columns = useMemo<ColumnDef<ItemRow>[]>(
    () => [
      {
        accessorKey: 'sku',
        header: t('master.sku'),
        cell: ({ row }) => (
          <span className="font-mono font-semibold text-foreground">{row.original.sku}</span>
        ),
      },
      {
        accessorKey: 'primaryBarcode',
        header: t('master.barcode'),
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground">
            {row.original.primaryBarcode || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{row.original.name}</span>
            <span className="text-[11px] text-muted-foreground">
              {itemTypeLabel(row.original.itemType)}
              {row.original.categoryName ? ` • ${row.original.categoryName}` : ''}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'uom',
        header: t('common.uom'),
        cell: ({ row }) => <Badge variant="outline">{row.original.uom}</Badge>,
      },
      {
        accessorKey: 'vatCode',
        header: t('common.vat'),
        cell: ({ row }) => <span className="font-mono">{row.original.vatCode}</span>,
      },
      {
        accessorKey: 'purchasePrice',
        header: t('warehouse.purchaseUnitPrice'),
        cell: ({ row }) => (
          <div className="text-right font-mono">
            {formatPrice4(row.original.purchasePrice, true)}
          </div>
        ),
      },
      {
        accessorKey: 'retailPrice',
        header: t('warehouse.retailPriceWithVat'),
        cell: ({ row }) => (
          <div className="text-right font-mono font-semibold text-foreground">
            {formatMoney2(row.original.retailPrice, true)}
          </div>
        ),
      },
      {
        accessorKey: 'stockQty',
        header: t('master.currentStock'),
        cell: ({ row }) => {
          const isLow = d(row.original.stockQty).lt(d(row.original.minStockQty));
          return (
            <div className="flex items-center justify-end gap-1.5 font-mono">
              <Badge variant={isLow ? 'warning' : 'success'}>
                {formatQty(row.original.stockQty, 2)}
              </Badge>
            </div>
          );
        },
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
                setEditingItem(row.original);
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
              <span>{row.original.isActive ? 'Obriši / Deaktiviraj' : t('common.delete')}</span>
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
        title={t('nav.items')}
        breadcrumbs={[
          { label: t('nav.groupMasterData') },
          { label: t('nav.items') },
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
          data={rows}
          columns={columns}
          exportFileName="sifarnik-artikala"
          onRowClick={(row) => {
            setEditingItem(row);
            setDialogOpen(true);
          }}
          toolbarExtras={
            <div className="flex items-center gap-2">
              <select
                aria-label={t('master.itemType')}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as 'ALL' | ItemType)}
                className="h-8 rounded-md border border-input bg-card px-2.5 text-xs text-foreground"
              >
                <option value="ALL">{t('common.all')}</option>
                <option value="GOODS">{t('master.typeGoods')}</option>
                <option value="SERVICE">{t('master.typeService')}</option>
                <option value="COMPOSITE">{t('master.typeComposite')}</option>
                <option value="RAW_MATERIAL">{t('master.typeRawMaterial')}</option>
              </select>
              <select
                aria-label={t('common.status')}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="h-8 rounded-md border border-input bg-card px-2.5 text-xs text-foreground"
              >
                <option value="ALL">Svi statusi</option>
                <option value="ACTIVE">{t('common.active')}</option>
                <option value="INACTIVE">{t('common.inactive')}</option>
              </select>
            </div>
          }
        />
      </div>

      <ItemFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editingItem={editingItem}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        variant="destructive"
        title={deleteTarget ? `Obrisati ili deaktivirati artikal "${deleteTarget.name}"?` : ''}
        description="Ako artikal nema povezanih robnih dokumenata niti računa, bit će trajno obrisan. U suprotnom će biti deaktiviran kako bi se sačuvala historija knjiženja."
        confirmLabel="Obriši / Deaktiviraj"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

export default ItemsPage;
