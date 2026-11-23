import { useRef } from 'react';
import { ShoppingCart, Trash2 } from 'lucide-react';
import { t } from '../../i18n';
import { formatMoney2, type PosReceiptTotalsResult } from '../../lib/money';
import type { Item, StoreItemPrice } from '../../types/domain';
import type { PosCartLine } from './posScannerUtils';
import { Button } from '../../components/ui/Button';
import { NumericInput } from '../../components/ui/NumericInput';

interface PosReceiptLinesTableProps {
  lines: PosCartLine[];
  items: Item[];
  storePrices: StoreItemPrice[];
  activeStoreId: string;
  totals: PosReceiptTotalsResult;
  onUpdateQty: (lineId: string, qty: string) => void;
  onUpdateDiscount: (lineId: string, discountPct: string) => void;
  onRemoveLine: (lineId: string) => void;
  onFocusScanner?: () => void;
}

export function PosReceiptLinesTable({
  lines,
  items,
  storePrices,
  activeStoreId,
  totals,
  onUpdateQty,
  onUpdateDiscount,
  onRemoveLine,
  onFocusScanner,
}: PosReceiptLinesTableProps) {
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-14 text-center">
        <ShoppingCart className="h-9 w-9 text-muted-foreground mb-2" />
        <p className="text-sm font-semibold text-foreground">{t('pos.emptyReceiptTitle')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('pos.emptyReceiptDesc')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-xs">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="border-b border-border bg-muted/60 text-muted-foreground">
          <tr>
            <th className="px-3 py-2.5 font-semibold">#</th>
            <th className="px-3 py-2.5 font-semibold">{t('common.name')}</th>
            <th className="px-3 py-2.5 font-semibold text-right w-28">{t('common.quantity')}</th>
            <th className="px-3 py-2.5 font-semibold text-right">
              {t('warehouse.retailPriceWithVat')}
            </th>
            <th className="px-3 py-2.5 font-semibold text-right w-24">
              {t('pos.discountPercent')}
            </th>
            <th className="px-3 py-2.5 font-semibold text-right">{t('common.total')}</th>
            <th className="px-3 py-2.5 font-semibold text-center w-12">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody ref={tbodyRef} className="divide-y divide-border">
          {lines.map((line, idx) => {
            const item = items.find((it) => it.id === line.itemId);
            const priceRec = storePrices.find(
              (p) => p.storeId === activeStoreId && p.itemId === line.itemId
            );
            const unitRetail =
              priceRec?.promoRetailPriceWithVat ?? priceRec?.retailUnitPriceWithVat ?? '0.00';
            const calcLine = totals.lineResults[idx];

            return (
              <tr key={line.id} data-row-index={idx} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-mono text-muted-foreground">{idx + 1}</td>
                <td className="px-3 py-2">
                  <div className="font-medium text-foreground">{item?.name ?? line.itemId}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {item?.sku} · {line.scannedBarcode} · {item?.uom}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <NumericInput
                    decimals={4}
                    min={0.001}
                    data-grid-cell="true"
                    data-pos-field="qty"
                    value={line.quantity}
                    onChange={(val) => onUpdateQty(line.id, val)}
                    onEnterKey={() => {
                      const rowEl = tbodyRef.current?.querySelector<HTMLElement>(
                        `tr[data-row-index="${idx}"]`
                      );
                      const discInput = rowEl?.querySelector<HTMLInputElement>(
                        '[data-pos-field="discount"]'
                      );
                      if (discInput) {
                        discInput.focus();
                        requestAnimationFrame(() => discInput.select());
                      }
                    }}
                    className="h-7 w-24 rounded border border-input bg-background px-2 text-right font-mono text-xs text-foreground"
                  />
                </td>
                <td className="px-3 py-2 text-right font-mono">{formatMoney2(unitRetail, true)}</td>
                <td className="px-3 py-2 text-right">
                  <NumericInput
                    decimals={2}
                    min={0}
                    max={100}
                    data-grid-cell="true"
                    data-pos-field="discount"
                    value={line.discountPercent}
                    onChange={(val) => onUpdateDiscount(line.id, val)}
                    onEnterKey={() => {
                      onFocusScanner?.();
                    }}
                    className="h-7 w-20 rounded border border-input bg-background px-2 text-right font-mono text-xs text-foreground"
                  />
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold text-foreground">
                  {formatMoney2(calcLine?.lineTotalWithVat ?? '0.00', true)}
                </td>
                <td className="px-3 py-2 text-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    tabIndex={-1}
                    onClick={() => onRemoveLine(line.id)}
                    aria-label={t('common.delete')}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
