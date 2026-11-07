import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Eye } from 'lucide-react';
import { t } from '../../i18n';
import { formatDateTimeBs } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';
import type { AuditLogEntry } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

function formatStatePayload(raw?: string): string {
  if (!raw) return '-';
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return JSON.stringify({ state: raw }, null, 2);
  }
}

export function AuditLogPage() {
  const { auditLog } = useAppStore();
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  const filteredLogs = useMemo(() => {
    return auditLog.filter((entry) =>
      actionFilter === 'ALL' ? true : entry.action === actionFilter
    );
  }, [auditLog, actionFilter]);

  const actionBadge = (action: AuditLogEntry['action']) => {
    if (action === 'POST') return <Badge variant="success">{action}</Badge>;
    if (action === 'REVERSE' || action === 'LOCK_PERIOD') {
      return <Badge variant="destructive">{action}</Badge>;
    }
    if (action === 'UNLOCK_PERIOD') return <Badge variant="warning">{action}</Badge>;
    return <Badge variant="secondary">{action}</Badge>;
  };

  const columns = useMemo<ColumnDef<AuditLogEntry>[]>(
    () => [
      {
        accessorKey: 'timestamp',
        header: t('audit.timestamp'),
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground">
            {formatDateTimeBs(row.original.timestamp)}
          </span>
        ),
      },
      {
        accessorKey: 'userName',
        header: t('audit.user'),
        cell: ({ row }) => (
          <span className="font-medium text-foreground">{row.original.userName}</span>
        ),
      },
      {
        accessorKey: 'entityType',
        header: t('audit.entityType'),
        cell: ({ row }) => (
          <Badge variant="outline" className="font-mono">
            {row.original.entityType}
          </Badge>
        ),
      },
      {
        accessorKey: 'entityCode',
        header: t('audit.entityCode'),
        cell: ({ row }) => (
          <span className="font-mono font-semibold text-foreground">
            {row.original.entityCode}
          </span>
        ),
      },
      {
        accessorKey: 'action',
        header: t('audit.action'),
        cell: ({ row }) => actionBadge(row.original.action),
      },
      {
        accessorKey: 'summary',
        header: t('audit.summary'),
        cell: ({ row }) => (
          <span className="text-foreground">{row.original.summary}</span>
        ),
      },
      {
        id: 'actions',
        header: t('common.actions'),
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedEntry(row.original);
              }}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>{t('common.view')}</span>
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title={t('nav.auditLog')}
        breadcrumbs={[
          { label: t('nav.groupReports') },
          { label: t('nav.auditLog') },
        ]}
      />

      <div className="p-6">
        <DataTable
          data={filteredLogs}
          columns={columns}
          exportFileName="revizijski-trag"
          onRowClick={(row) => setSelectedEntry(row)}
          toolbarExtras={
            <select
              aria-label={t('audit.action')}
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-card px-2.5 text-xs text-foreground"
            >
              <option value="ALL">{t('common.all')}</option>
              <option value="POST">POST</option>
              <option value="REVERSE">REVERSE</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="LOCK_PERIOD">LOCK_PERIOD</option>
              <option value="UNLOCK_PERIOD">UNLOCK_PERIOD</option>
            </select>
          }
        />
      </div>

      <Dialog
        open={Boolean(selectedEntry)}
        onClose={() => setSelectedEntry(null)}
        size="lg"
        title={
          selectedEntry
            ? `${selectedEntry.entityType} — ${selectedEntry.entityCode}`
            : t('nav.auditLog')
        }
        description={selectedEntry ? formatDateTimeBs(selectedEntry.timestamp) : undefined}
        footer={
          <Button variant="outline" onClick={() => setSelectedEntry(null)}>
            {t('common.close')}
          </Button>
        }
      >
        {selectedEntry && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg border border-border bg-muted/20 p-3">
              <div>
                <div className="text-muted-foreground">{t('audit.user')}</div>
                <div className="mt-0.5 font-semibold text-foreground">
                  {selectedEntry.userName}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">{t('audit.action')}</div>
                <div className="mt-0.5">{actionBadge(selectedEntry.action)}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-muted-foreground">{t('audit.summary')}</div>
                <div className="mt-0.5 font-medium text-foreground">
                  {selectedEntry.summary}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="font-semibold text-muted-foreground">
                  {t('audit.previousState')}
                </div>
                <pre className="rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11px] text-foreground overflow-x-auto">
                  {formatStatePayload(selectedEntry.previousState)}
                </pre>
              </div>
              <div className="space-y-1.5">
                <div className="font-semibold text-muted-foreground">
                  {t('audit.newState')}
                </div>
                <pre className="rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11px] text-foreground overflow-x-auto">
                  {formatStatePayload(selectedEntry.newState)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

export default AuditLogPage;
