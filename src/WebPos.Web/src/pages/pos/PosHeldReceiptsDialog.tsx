import { Play, Trash2 } from 'lucide-react';
import { t } from '../../i18n';
import { formatDateTimeBs, generateUuidV7 } from '../../lib/utils';
import type { HeldPosReceipt } from '../../types/domain';
import type { PosCartLine } from './posScannerUtils';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';

interface PosHeldReceiptsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  heldReceipts: HeldPosReceipt[];
  onResume: (lines: PosCartLine[], partnerId: string, heldId: string) => void;
  onRemove: (heldId: string) => void;
}

export function PosHeldReceiptsDialog({
  open,
  onOpenChange,
  heldReceipts,
  onResume,
  onRemove,
}: PosHeldReceiptsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('pos.heldReceipts')} size="md">
      {heldReceipts.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">{t('common.noResults')}</p>
      ) : (
        <div className="divide-y divide-border">
          {heldReceipts.map((held) => (
            <div key={held.id} className="flex items-center justify-between py-2.5 text-xs">
              <div>
                <div className="font-semibold text-foreground">{held.label}</div>
                <div className="text-muted-foreground">{formatDateTimeBs(held.createdAt)}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const nextLines: PosCartLine[] = held.lines.map((l) => ({
                      id: generateUuidV7(),
                      itemId: l.itemId,
                      scannedBarcode: l.scannedBarcode,
                      quantity: l.quantity,
                      discountPercent: l.discountPercent,
                    }));
                    onResume(nextLines, held.partnerId ?? '', held.id);
                    onOpenChange(false);
                  }}
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>{t('pos.resumeReceipt')}</span>
                </Button>
                <Button variant="destructive" size="icon" onClick={() => onRemove(held.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}
