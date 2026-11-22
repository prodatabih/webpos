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
import { Badge, type BadgeVariant } from '../../components/ui/Badge';

interface AuditActionMeta {
  label: string;
  variant: BadgeVariant;
}

const AUDIT_ACTION_ORDER = [
  'POST',
  'REVERSE',
  'DELETE_DRAFT',
  'POS_SALE',
  'POS_REFUND',
  'FISCALIZE',
  'LOCK_PERIOD',
  'UNLOCK_PERIOD',
  'UPDATE_SETTINGS',
  'LOGIN',
  'CHANGE_PASSWORD',
  'FORGOT_PASSWORD',
  'RESET_PASSWORD',
  'CREATE_USER',
  'CREATE_TENANT',
  'TOGGLE_TENANT',
  'CREATE',
  'UPDATE',
] as const;

const AUDIT_ACTION_META: Record<string, AuditActionMeta> = {
  POST: { label: 'Knjiženje', variant: 'success' },
  POS_SALE: { label: 'POS prodaja', variant: 'success' },
  FISCALIZE: { label: 'Fiskalizacija', variant: 'success' },
  REVERSE: { label: 'Storno', variant: 'destructive' },
  POS_REFUND: { label: 'POS reklamacija', variant: 'destructive' },
  DELETE_DRAFT: { label: 'Brisanje nacrta', variant: 'destructive' },
  LOCK_PERIOD: { label: 'Zaključavanje perioda', variant: 'destructive' },
  UNLOCK_PERIOD: { label: 'Otključavanje perioda', variant: 'warning' },
  TOGGLE_TENANT: { label: 'Status tenanta', variant: 'warning' },
  CHANGE_PASSWORD: { label: 'Promjena lozinke', variant: 'warning' },
  FORGOT_PASSWORD: { label: 'Zahtjev za reset lozinke', variant: 'warning' },
  RESET_PASSWORD: { label: 'Reset lozinke', variant: 'warning' },
  CREATE_TENANT: { label: 'Novi tenant', variant: 'default' },
  CREATE_USER: { label: 'Novi korisnik', variant: 'default' },
  CREATE: { label: 'Kreiranje', variant: 'default' },
  UPDATE_SETTINGS: { label: 'Postavke sistema', variant: 'secondary' },
  UPDATE: { label: 'Izmjena', variant: 'secondary' },
  LOGIN: { label: 'Prijava', variant: 'outline' },
};

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

  const availableActions = useMemo(() => {
    const known = new Set<string>(AUDIT_ACTION_ORDER);
    const extras: string[] = [];
    auditLog.forEach((entry) => {
      const act = String(entry.action);
      if (act && !known.has(act) && !extras.includes(act)) {
        extras.push(act);
      }
    });
    return [...AUDIT_ACTION_ORDER, ...extras];
  }, [auditLog]);

  const filteredLogs = useMemo(() => {
    return auditLog.filter((entry) =>
      actionFilter === 'ALL' ? true : String(entry.action) === actionFilter
    );
  }, [auditLog, actionFilter]);

  const actionBadge = (action: string) => {
    const meta = AUDIT_ACTION_META[action];
    if (meta) {
      return (
        <Badge variant={meta.variant} title={action}>
          {meta.label}
        </Badge>
      );
    }
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
        cell: ({ row }) => actionBadge(String(row.original.action)),
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
              <option value="ALL">Sve akcije ({t('common.all')})</option>
              {availableActions.map((act) => {
                const meta = AUDIT_ACTION_META[act];
                return (
                  <option key={act} value={act}>
                    {meta ? `${meta.label} (${act})` : act}
                  </option>
                );
              })}
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
                <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                  {actionBadge(String(selectedEntry.action))}
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {selectedEntry.action}
                  </span>
                </div>
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
