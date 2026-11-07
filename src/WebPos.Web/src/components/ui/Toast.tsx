import { useSyncExternalStore } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { cn, generateUuidV7 } from '../../lib/utils';
import { t } from '../../i18n';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

let toasts: ToastMessage[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function showToast(params: {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}) {
  const id = generateUuidV7();
  const nextToast: ToastMessage = {
    id,
    title: params.title,
    description: params.description,
    variant: params.variant ?? 'info',
  };
  toasts = [nextToast, ...toasts].slice(0, 5);
  notify();

  setTimeout(() => {
    dismissToast(id);
  }, params.durationMs ?? 3800);
}

export function dismissToast(id: string) {
  toasts = toasts.filter((item) => item.id !== id);
  notify();
}

export function useToast() {
  return {
    toast: showToast,
    showToast,
    dismissToast,
  };
}

export function ToastViewport() {
  const activeToasts = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => toasts
  );

  if (activeToasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {activeToasts.map((item) => (
        <div
          key={item.id}
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-lg border p-3.5 shadow-md bg-popover text-popover-foreground transition-all',
            item.variant === 'success' && 'border-success/50',
            item.variant === 'error' && 'border-destructive/50',
            item.variant === 'warning' && 'border-warning/50',
            item.variant === 'info' && 'border-border'
          )}
        >
          {item.variant === 'success' && (
            <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
          )}
          {item.variant === 'error' && (
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          )}
          {(item.variant === 'info' || item.variant === 'warning') && (
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">{item.title}</p>
            {item.description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismissToast(item.id)}
            aria-label={t('common.close')}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
