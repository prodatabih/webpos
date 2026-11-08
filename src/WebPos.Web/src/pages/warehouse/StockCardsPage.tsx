import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, PackageSearch, Printer, Warehouse } from 'lucide-react';
import { t } from '../../i18n';
import { formatMoney2, formatQty } from '../../lib/money';
import { formatDateTimeBs } from '../../lib/utils';
import { exportToExcel } from '../../lib/exportExcel';
import { useAppStore } from '../../store/useAppStore';
import type { Item, StoreItemPrice } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent } from '../../components/ui/Card';
import { buildStockCardMovements, type StockMovement } from './stockCardUtils';

interface ItemStockRow {
  item: Item;
  price: StoreItemPrice | undefined;
  stockQty: string;
  retailPrice: string;
  totalValue: string;
}

export function StockCardsPage() {
  const {
    activeCompanyId,
    activeStoreId,
    storeLocations,
    items,
    storeItemPrices,
    calculations,
    priceLevelings,
    transfers,
    inventoryCounts,
    otherWarehouseDocs,
    posReceipts,
  } = useAppStore();

  const [selectedStoreId, setSelectedStoreId] = useState(activeStoreId);
  const [onlyWithStock, setOnlyWithStock] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const companyStores = useMemo(
    () => storeLocations.filter((s) => s.companyId === activeCompanyId),
    [storeLocations, activeCompanyId]
  );

  const currentStore = useMemo(
    () => companyStores.find((s) => s.id === selectedStoreId) ?? companyStores[0]!,
    [companyStores, selectedStoreId]
  );

  const stockRows = useMemo<ItemStockRow[]>(() => {
    return items
      .filter((it) => it.companyId === activeCompanyId)
      .map((it) => {
        const p = storeItemPrices.find((sp) => sp.storeId === currentStore.id && sp.itemId === it.id);
        const qty = p?.currentStockQty ?? '0.0000';
        const price = p?.retailUnitPriceWithVat ?? '0.00';
        const val = (Number(qty) * Number(price)).toFixed(2);
        return { item: it, price: p, stockQty: qty, retailPrice: price, totalValue: val };
      })
      .filter((row) => (onlyWithStock ? Number(row.stockQty) > 0 : true));
  }, [items, activeCompanyId, storeItemPrices, currentStore.id, onlyWithStock]);

  const activeItemRow = useMemo(
    () => stockRows.find((r) => r.item.id === selectedItemId) ?? stockRows[0],
    [stockRows, selectedItemId]
  );

  const movements = useMemo<StockMovement[]>(() => {
    if (!activeItemRow) return [];
    return buildStockCardMovements({
      storeId: currentStore.id,
      itemId: activeItemRow.item.id,
      calculations,
      priceLevelings,
      transfers,
      inventoryCounts,
      otherWarehouseDocs,
      posReceipts,
      defaultPrice: activeItemRow.retailPrice,
    });
  }, [activeItemRow, currentStore.id, calculations, priceLevelings, transfers, inventoryCounts, otherWarehouseDocs, posReceipts]);

  const handleExportExcel = () => {
    if (!activeItemRow) return;
    const headers = [t('common.date'), t('warehouse.docSubtype'), t('warehouse.docNumber'), t('common.description'), t('stock.inQty'), t('stock.outQty'), t('stock.balanceQty'), t('stock.unitPrice'), t('stock.balanceValue')];
    const rows = movements.map((m) => [m.date, m.docType, m.docNumber, m.description, Number(m.inQty), Number(m.outQty), Number(m.balanceQty), Number(m.unitPrice), Number(m.totalValue)]);
    exportToExcel(`robna-kartica-${activeItemRow.item.sku}-${currentStore.code}`, `${activeItemRow.item.sku}`, headers, rows);
  };

  const itemColumns = useMemo<ColumnDef<ItemStockRow>[]>(
    () => [
      { accessorKey: 'item.sku', header: t('master.sku'), cell: ({ row }) => <span className="font-mono font-semibold">{row.original.item.sku}</span> },
      { accessorKey: 'item.name', header: t('common.name'), cell: ({ row }) => <span className="font-medium">{row.original.item.name}</span> },
      { accessorKey: 'item.uom', header: t('common.uom'), cell: ({ row }) => <Badge variant="outline">{row.original.item.uom}</Badge> },
      { accessorKey: 'retailPrice', header: t('warehouse.retailPriceWithVat'), cell: ({ row }) => <div className="text-right font-mono">{formatMoney2(row.original.retailPrice, true)}</div> },
      { accessorKey: 'stockQty', header: t('master.currentStock'), cell: ({ row }) => <div className="text-right font-mono font-bold">{formatQty(row.original.stockQty, 2)}</div> },
      { accessorKey: 'totalValue', header: t('warehouse.retailValueWithVat'), cell: ({ row }) => <div className="text-right font-mono text-primary font-semibold">{formatMoney2(row.original.totalValue, true)}</div> },
    ],
    []
  );

  const movementColumns = useMemo<ColumnDef<StockMovement>[]>(
    () => [
      { accessorKey: 'date', header: t('common.date'), cell: ({ row }) => formatDateTimeBs(row.original.date) },
      { accessorKey: 'docType', header: t('warehouse.docSubtype'), cell: ({ row }) => <Badge variant="outline">{row.original.docType}</Badge> },
      { accessorKey: 'docNumber', header: t('warehouse.docNumber'), cell: ({ row }) => <span className="font-mono font-semibold">{row.original.docNumber}</span> },
      { accessorKey: 'description', header: t('common.description'), cell: ({ row }) => <span className="text-muted-foreground">{row.original.description}</span> },
      { accessorKey: 'inQty', header: t('stock.inQty'), cell: ({ row }) => <div className="text-right font-mono text-success font-semibold">{Number(row.original.inQty) > 0 ? formatQty(row.original.inQty, 2) : '-'}</div> },
      { accessorKey: 'outQty', header: t('stock.outQty'), cell: ({ row }) => <div className="text-right font-mono text-destructive font-semibold">{Number(row.original.outQty) > 0 ? formatQty(row.original.outQty, 2) : '-'}</div> },
      { accessorKey: 'balanceQty', header: t('stock.balanceQty'), cell: ({ row }) => <div className="text-right font-mono font-bold">{formatQty(row.original.balanceQty, 2)}</div> },
      { accessorKey: 'unitPrice', header: t('stock.unitPrice'), cell: ({ row }) => <div className="text-right font-mono">{formatMoney2(row.original.unitPrice, true)}</div> },
      { accessorKey: 'totalValue', header: t('stock.balanceValue'), cell: ({ row }) => <div className="text-right font-mono font-semibold text-primary">{formatMoney2(row.original.totalValue, true)}</div> },
    ],
    []
  );

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title={t('stock.title')}
        breadcrumbs={[{ label: t('nav.groupWarehouse') }, { label: t('stock.title') }]}
        actions={
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!activeItemRow}>
            <Download className="h-4 w-4" />
            <span>{t('stock.exportStockCard')}</span>
          </Button>
        }
        primaryAction={
          <Button variant="primary" size="sm" onClick={() => window.print()} disabled={!activeItemRow}>
            <Printer className="h-4 w-4" />
            <span>{t('common.print')}</span>
          </Button>
        }
      />

      <div className="p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-3">
            <Warehouse className="h-5 w-5 text-muted-foreground" />
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="h-8 rounded-md border border-input bg-card px-3 text-xs font-semibold text-foreground"
            >
              {companyStores.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.code} — {st.name} ({st.storeType})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={onlyWithStock}
                onChange={(e) => setOnlyWithStock(e.target.checked)}
                className="rounded border-input"
              />
              <span>{t('stock.onlyWithStock')}</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <PackageSearch className="h-4 w-4" />
              <span>{t('nav.items')}</span>
            </h3>
            <DataTable
              data={stockRows}
              columns={itemColumns}
              pageSize={8}
              exportFileName={`zalihe-${currentStore.code}`}
              onRowClick={(row) => setSelectedItemId(row.item.id)}
            />
          </div>

          <div className="lg:col-span-7 space-y-3">
            {activeItemRow ? (
              <>
                <Card>
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{activeItemRow.item.sku}</Badge>
                        <h4 className="text-sm font-bold">{activeItemRow.item.name}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('common.uom')}: {activeItemRow.item.uom} • {t('app.storeLocation')}: {currentStore.code} ({currentStore.name})
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">{t('master.currentStock')}</div>
                      <div className="text-xl font-bold font-mono text-primary">
                        {formatQty(activeItemRow.stockQty, 2)} {activeItemRow.item.uom}
                      </div>
                      <div className="text-xs font-mono text-muted-foreground">
                        {formatMoney2(activeItemRow.totalValue, true)}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('stock.movementHistory')}
                </h3>
                <DataTable
                  data={movements}
                  columns={movementColumns}
                  pageSize={10}
                  exportFileName={`robna-kartica-${activeItemRow.item.sku}`}
                />
              </>
            ) : (
              <div className="rounded-lg border border-border bg-card p-12 text-center text-xs text-muted-foreground">
                {t('stock.selectItem')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export default StockCardsPage;
