import { useState, type RefObject } from 'react';
import { Barcode } from 'lucide-react';
import { t } from '../../i18n';
import { formatMoney2 } from '../../lib/money';
import type { Item, StoreItemPrice } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

interface PosScannerFormProps {
  quantity: string;
  setQuantity: (val: string) => void;
  scanText: string;
  setScanText: (val: string) => void;
  searchSuggestions: Item[];
  storePrices: StoreItemPrice[];
  activeStoreId: string;
  scanInputRef: RefObject<HTMLInputElement>;
  onSubmit: (e: React.FormEvent) => void;
  onSelectSuggestion: (item: Item) => void;
}

export function PosScannerForm({
  quantity,
  setQuantity,
  scanText,
  setScanText,
  searchSuggestions,
  storePrices,
  activeStoreId,
  scanInputRef,
  onSubmit,
  onSelectSuggestion,
}: PosScannerFormProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-3 shadow-xs">
      <div className="w-24">
        <Input
          label={t('common.quantity')}
          type="number"
          step="0.001"
          min="0.001"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="font-mono text-right"
        />
      </div>
      <div className="relative flex-1 min-w-[220px]">
        <Input
          ref={scanInputRef}
          label={t('master.barcode')}
          value={scanText}
          onChange={(e) => {
            setScanText(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          placeholder={t('pos.scanInputPlaceholder')}
          rightElement={<Barcode className="h-4 w-4" />}
        />
        {showSuggestions && searchSuggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-16 z-50 max-h-60 overflow-y-auto rounded-lg border border-border bg-popover shadow-xl divide-y divide-border">
            {searchSuggestions.map((item) => {
              const sp = storePrices.find((p) => p.storeId === activeStoreId && p.itemId === item.id);
              const mpc = sp?.promoRetailPriceWithVat ?? sp?.retailUnitPriceWithVat ?? '0.00';
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectSuggestion(item);
                    setShowSuggestions(false);
                  }}
                  className="flex cursor-pointer items-center justify-between p-2.5 text-xs hover:bg-muted/60"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary">{item.sku}</span>
                    <div>
                      <div className="font-semibold text-foreground">{item.name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{item.primaryBarcode} · {item.uom}</div>
                    </div>
                  </div>
                  <div className="text-right font-mono font-bold text-foreground">{formatMoney2(mpc, true)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Button type="submit" variant="primary">{t('common.add')}</Button>
    </form>
  );
}
