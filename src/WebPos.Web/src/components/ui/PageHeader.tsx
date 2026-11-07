import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  primaryAction?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  description,
  breadcrumbs,
  actions,
  primaryAction,
  className,
}: PageHeaderProps) {
  const effectiveSubtitle = subtitle ?? description;

  return (
    <div
      className={cn(
        'flex flex-col gap-2 border-b border-border bg-card px-6 py-4 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="flex flex-col gap-1 min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={`${crumb.label}-${idx}`}>
                {idx > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                {crumb.href ? (
                  <Link
                    to={crumb.href}
                    className="hover:text-foreground transition-colors truncate"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground font-medium truncate">
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-lg font-semibold tracking-tight text-foreground truncate">
            {title}
          </h1>
          {effectiveSubtitle && (
            <p className="text-xs text-muted-foreground">{effectiveSubtitle}</p>
          )}
        </div>
      </div>

      {(actions || primaryAction) && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {actions}
          {primaryAction}
        </div>
      )}
    </div>
  );
}
