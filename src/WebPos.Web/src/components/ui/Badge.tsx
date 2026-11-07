import React from 'react';
import { cn } from '../../lib/utils';
import { t } from '../../i18n';
import type { DocumentStatus } from '../../types/domain';

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'success'
  | 'warning'
  | 'destructive';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantMap: Record<BadgeVariant, string> = {
  default: 'bg-primary/15 text-primary border-primary/30',
  secondary: 'bg-secondary text-secondary-foreground border-border',
  outline: 'bg-transparent text-foreground border-border',
  success: 'bg-success/15 text-success border-success/30',
  warning: 'bg-warning/20 text-foreground border-warning/40',
  destructive: 'bg-destructive/15 text-destructive border-destructive/30',
};

export function Badge({
  className,
  variant = 'default',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium leading-none whitespace-nowrap',
        variantMap[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  if (status === 'POSTED') {
    return <Badge variant="success">{t('status.POSTED')}</Badge>;
  }
  if (status === 'REVERSED') {
    return <Badge variant="destructive">{t('status.REVERSED')}</Badge>;
  }
  return <Badge variant="warning">{t('status.DRAFT')}</Badge>;
}
