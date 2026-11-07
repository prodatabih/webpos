import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { t } from '../../i18n';
import { formatMoney2, formatQty } from '../../lib/money';
import type { Item, StoreItemPrice } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

interface PosTouchCatalogProps {
  items: Item[];
  storePrices: StoreItemPrice[];
  activeStoreId: string;
  onSelectItem: (item: Item) => void;
}

export function PosTouchCatalog({
  items,
  storePrices,
  activeStoreId,
  onSelectItem,
}: PosTouchCatalogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.isActive && it.categoryName) {
        set.add(it.categoryName);
      }
    });
    return Array.from(set);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(
      (it) =>
        it.isActive && (selectedCategory === 'ALL' || it.categoryName === selectedCategory)
    );
  }, [items, selectedCategory]);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 flex-wrap border-b border-border pb-2.5">
        <Button
          variant={selectedCategory === 'ALL' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory('ALL')}
        >
          {t('common.all')}
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat}
            variant={selectedCategory === cat ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {filteredItems.map((item) => {
          const priceRec = storePrices.find(
            (p) => p.storeId === activeStoreId && p.itemId === item.id
          );
          const effectivePrice =
            priceRec?.promoRetailPriceWithVat ?? priceRec?.retailUnitPriceWithVat ?? '0.00';
          const stockQty = priceRec?.currentStockQty ?? '0.0000';

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectItem(item)}
              className="flex flex-col justify-between rounded-md border border-border bg-background p-3 text-left transition-colors hover:border-primary hover:bg-accent/50 cursor-pointer group"
            >
              <div>
                <div className="flex items-center justify-between gap-1 text-[11px] text-muted-foreground font-mono">
                  <span>{item.sku}</span>
                  <span>
                    {formatQty(stockQty, 2)} {item.uom}
                  </span>
                </div>
                <div className="mt-1 text-xs font-semibold text-foreground line-clamp-2">
                  {item.name}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/60">
                <div className="flex flex-col">
                  <span className="font-mono text-sm font-bold text-primary">
                    {formatMoney2(effectivePrice, true)}
                  </span>
                  {priceRec?.promoRetailPriceWithVat && (
                    <span className="font-mono text-[10px] text-muted-foreground line-through">
                      {formatMoney2(priceRec.retailUnitPriceWithVat, true)}
                    </span>
                  )}
                </div>
                <Badge variant="secondary" className="group-hover:bg-primary group-hover:text-primary-foreground">
                  <Plus className="h-3 w-3" />
                </Badge>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
