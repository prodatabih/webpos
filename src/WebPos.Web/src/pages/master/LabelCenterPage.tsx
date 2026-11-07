import { useMemo, useState } from 'react';
import { Check, Printer, Tags } from 'lucide-react';
import { t } from '../../i18n';
import { d, formatMoney2, formatQty } from '../../lib/money';
import { formatDateBs } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { showToast } from '../../components/ui/Toast';

export function LabelCenterPage() {
  const {
    activeStoreId,
    storeLocations,
    items,
    storeItemPrices,
    clearLabelPrintFlags,
  } = useAppStore();

  const [onlyPending, setOnlyPending] = useState(true);

  const activeStore = storeLocations.find((s) => s.id === activeStoreId);

  const labelItems = useMemo(() => {
    return storeItemPrices
      .filter((sp) => sp.storeId === activeStoreId)
      .filter((sp) => (onlyPending ? sp.needsLabelPrint : true))
      .map((sp) => {
        const item = items.find((i) => i.id === sp.itemId);
        const netQty = d(item?.netContentQty ?? 1);
        const unitPerBase = netQty.gt(0)
          ? d(sp.retailUnitPriceWithVat).div(netQty)
          : d(sp.retailUnitPriceWithVat);
        return {
          sp,
          item,
          unitPerBaseStr: formatMoney2(unitPerBase, true),
        };
      })
      .filter((x) => Boolean(x.item));
  }, [storeItemPrices, activeStoreId, onlyPending, items]);

  const pendingCount = useMemo(
    () =>
      storeItemPrices.filter((sp) => sp.storeId === activeStoreId && sp.needsLabelPrint)
        .length,
    [storeItemPrices, activeStoreId]
  );

  const handlePrintAndClear = () => {
    const ids = labelItems.map((x) => x.sp.itemId);
    if (ids.length === 0) return;
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
    clearLabelPrintFlags(activeStoreId, ids);
    showToast({ title: t('messages.recordSaved'), variant: 'success' });
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title={t('nav.labelCenter')}
        subtitle={activeStore ? `${activeStore.code} — ${activeStore.name}` : undefined}
        breadcrumbs={[
          { label: t('nav.groupMasterData') },
          { label: t('nav.labelCenter') },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant={onlyPending ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setOnlyPending(true)}
            >
              <Tags className="h-3.5 w-3.5" />
              <span>{t('master.labelQueueCount')} ({pendingCount})</span>
            </Button>
            <Button
              variant={!onlyPending ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setOnlyPending(false)}
            >
              <span>{t('common.all')}</span>
            </Button>
          </div>
        }
        primaryAction={
          <Button
            variant="success"
            onClick={handlePrintAndClear}
            disabled={labelItems.length === 0}
          >
            <Printer className="h-4 w-4" />
            <span>{t('common.print')}</span>
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {labelItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm font-semibold text-foreground">{t('common.noResults')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('common.noResultsDesc')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {labelItems.map(({ sp, item, unitPerBaseStr }) => {
              if (!item) return null;
              return (
                <Card
                  key={sp.id}
                  className="border-2 border-foreground/20 bg-card shadow-xs"
                >
                  <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-bold leading-snug text-foreground">
                        {item.name}
                      </CardTitle>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {t('master.countryOfOrigin')}: {item.countryOfOrigin}
                      </p>
                    </div>
                    {sp.needsLabelPrint && (
                      <Badge variant="warning">{t('common.print')}</Badge>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3 pt-3">
                    <div className="flex items-baseline justify-between border-b border-dashed border-border pb-2.5">
                      <div className="space-y-0.5 text-[11px] text-muted-foreground">
                        <div className="font-mono">
                          {t('master.sku')}: <strong className="text-foreground">{item.sku}</strong>
                        </div>
                        <div className="font-mono">
                          {t('master.barcode')}: {item.primaryBarcode}
                        </div>
                        <div>
                          {t('master.shelfLocation')}: <strong className="font-mono text-foreground">{sp.shelfLocation}</strong>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {t('warehouse.retailPriceWithVat')}
                        </div>
                        <div className="text-2xl font-extrabold font-mono text-foreground tracking-tight">
                          {formatMoney2(sp.retailUnitPriceWithVat, true)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        1 {item.netContentUom} = <strong className="font-mono text-foreground">{unitPerBaseStr}</strong> ({formatQty(item.netContentQty, 2)} {item.netContentUom})
                      </span>
                      <span className="font-mono">{formatDateBs(sp.updatedAt)}</span>
                    </div>

                    <div className="flex justify-end pt-1">
                      {sp.needsLabelPrint && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => clearLabelPrintFlags(activeStoreId, [item.id])}
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>{t('common.confirm')}</span>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default LabelCenterPage;
