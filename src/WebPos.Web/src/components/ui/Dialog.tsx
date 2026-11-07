import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { t } from '../../i18n';
import { Button } from './Button';

export interface DialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const sizeMap: Record<NonNullable<DialogProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-6xl',
};

export function Dialog({
  open,
  onOpenChange,
  onClose,
  title,
  description,
  size = 'lg',
  children,
  footer,
}: DialogProps) {
  const handleClose = () => {
    onOpenChange?.(false);
    onClose?.();
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-[1px] p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          'relative w-full rounded-lg border border-border bg-card text-card-foreground shadow-lg flex flex-col max-h-[90vh]',
          sizeMap[size]
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-3.5 shrink-0">
            <div>
              {title && <h2 className="text-base font-semibold text-foreground">{title}</h2>}
              {description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              aria-label={t('common.close')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3 shrink-0 bg-muted/30">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
