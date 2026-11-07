import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Edit2, Plus } from 'lucide-react';
import { t } from '../../i18n';
import { formatMoney2, formatPrice4, formatQty, d } from '../../lib/money';
import { useAppStore } from '../../store/useAppStore';
import type { Item, ItemType } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ItemFormDialog } from './ItemFormDialog';

interface ItemRow extends Item {
  vatCode: string;
  vatRatePercent: string;
  purchasePrice: string;
  retailPrice: string;
  stockQty: string;
  minStockQty: string;
}

export function ItemsPage() {
  const {
    activeCompanyId,
    activeStoreId,
    items,
    vatRates,
    storeItemPrices,
  } = useAppStore();

  const [typeFilter, setTypeFilter] = useState<'ALL' | ItemType>('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const rows = useMemo<ItemRow[]>(() => {
    return items
      .filter((item) => item.companyId === activeCompanyId)
      .filter((item) => (typeFilter === 'ALL' ? true : item.itemType === typeFilter))
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
  }, [items, activeCompanyId, typeFilter, vatRates, storeItemPrices, activeStoreId]);

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
          <span className="font-mono text-muted-foreground">{row.original.primaryBarcode}</span>
        ),
      },
      {
        accessorKey: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{row.original.name}</span>
            <span className="text-[11px] text-muted-foreground">
              {itemTypeLabel(row.original.itemType)} • {row.original.categoryName}
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
        id: 'actions',
        header: t('common.actions'),
        cell: ({ row }) => (
          <div className="flex justify-end">
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
          <Button
            variant="primary"
            onClick={() => {
              setEditingItem(null);
              setDialogOpen(true);
            }}
          >
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
          }
        />
      </div>

      <ItemFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editingItem={editingItem}
      />
    </div>
  );
}

export default ItemsPage;
