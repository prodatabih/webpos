import { useEffect, useId, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { t } from '../../i18n';
import { cn } from '../../lib/utils';
import { Dialog } from './Dialog';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'destructive' | 'primary';
  requireReason?: boolean;
  reasonLabel?: string;
  loading?: boolean;
  onConfirm: (reason?: string) => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = 'primary',
  requireReason = false,
  reasonLabel,
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const reasonId = useId();

  useEffect(() => {
    if (!open) {
      setReason('');
      setReasonError(null);
      setSubmitting(false);
    }
  }, [open]);

  const isBusy = loading || submitting;

  const handleClose = () => {
    if (isBusy) return;
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (requireReason && !reason.trim()) {
      setReasonError(t('common.requiredField'));
      return;
    }
    setReasonError(null);
    try {
      setSubmitting(true);
      await onConfirm(requireReason ? reason.trim() : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isBusy) return;
        onOpenChange(nextOpen);
      }}
      size="sm"
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={isBusy}>
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'primary'}
            onClick={handleConfirm}
            isLoading={isBusy}
          >
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {description && (
          <div
            className={cn(
              'flex items-start gap-3 text-sm',
              variant === 'destructive'
                ? 'rounded-md border border-destructive/30 bg-destructive/5 p-3 text-foreground'
                : 'text-muted-foreground'
            )}
          >
            {variant === 'destructive' && (
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
            )}
            <p className="leading-relaxed">{description}</p>
          </div>
        )}

        {requireReason && (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={reasonId}
              className="text-xs font-medium text-foreground flex items-center gap-1"
            >
              <span>{reasonLabel ?? t('warehouse.reversalReason')}</span>
              <span className="text-destructive">*</span>
            </label>
            <textarea
              id={reasonId}
              rows={3}
              value={reason}
              disabled={isBusy}
              onChange={(e) => {
                setReason(e.target.value);
                if (reasonError) setReasonError(null);
              }}
              placeholder={reasonLabel ?? t('warehouse.reversalReason')}
              className={cn(
                'w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                reasonError && 'border-destructive focus-visible:ring-destructive'
              )}
            />
            {reasonError && (
              <p className="text-xs text-destructive font-medium">{reasonError}</p>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}

export default ConfirmDialog;
