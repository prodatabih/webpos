import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Building2, Plus, Power } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { t } from '../../i18n';
import { apiClient } from '../../api/apiClient';
import type { TenantSummary } from '../../api/apiTypes';
import { formatDateBs } from '../../lib/utils';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { showToast } from '../../components/ui/Toast';

const createTenantSchema = z.object({
  code: z.string().min(2, t('common.requiredField')),
  name: z.string().min(2, t('common.requiredField')),
  adminEmail: z.string().email(t('common.requiredField')),
  adminPassword: z.string().min(6, t('common.requiredField')),
});

type CreateTenantFormValues = z.infer<typeof createTenantSchema>;

export function SuperAdminTenantsPage() {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CreateTenantFormValues>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      code: '',
      name: '',
      adminEmail: '',
      adminPassword: '',
    },
  });

  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getTenants();
      setTenants(data);
    } catch (err) {
      showToast({
        title: t('common.errorTitle'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  const handleOpenCreate = () => {
    form.reset({ code: '', name: '', adminEmail: '', adminPassword: '' });
    setDialogOpen(true);
  };

  const onSubmitCreate = async (values: CreateTenantFormValues) => {
    setSubmitting(true);
    try {
      const created = await apiClient.createTenant({
        code: values.code.trim().toUpperCase(),
        name: values.name.trim(),
        adminEmail: values.adminEmail.trim(),
        adminPassword: values.adminPassword,
      });
      setTenants((prev) => [created, ...prev]);
      showToast({ title: t('tenants.tenantCreated'), variant: 'success' });
      setDialogOpen(false);
    } catch (err) {
      showToast({
        title: t('common.errorTitle'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = useCallback(async (tenantId: string) => {
    try {
      const updated = await apiClient.toggleTenant(tenantId);
      setTenants((prev) => prev.map((item) => (item.id === tenantId ? updated : item)));
      showToast({ title: t('tenants.tenantToggled'), variant: 'success' });
    } catch (err) {
      showToast({
        title: t('common.errorTitle'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'error',
      });
    }
  }, []);

  const columns = useMemo<ColumnDef<TenantSummary>[]>(
    () => [
      {
        accessorKey: 'code',
        header: t('tenants.code'),
        cell: ({ row }) => (
          <Badge variant="default" className="font-mono font-bold">
            {row.original.code}
          </Badge>
        ),
      },
      {
        accessorKey: 'name',
        header: t('tenants.name'),
        cell: ({ row }) => (
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span>{row.original.name}</span>
          </div>
        ),
      },
      {
        accessorKey: 'isActive',
        header: t('common.status'),
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'success' : 'secondary'}>
            {row.original.isActive ? t('common.active') : t('common.inactive')}
          </Badge>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: t('tenants.createdAt'),
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground">
            {formatDateBs(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: t('common.actions'),
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                void handleToggle(row.original.id);
              }}
            >
              <Power className="h-3.5 w-3.5" />
              <span>
                {row.original.isActive ? t('tenants.deactivate') : t('tenants.activate')}
              </span>
            </Button>
          </div>
        ),
      },
    ],
    [handleToggle]
  );

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title={t('tenants.title')}
        subtitle={t('tenants.subtitle')}
        actions={
          <Button variant="primary" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4" />
            <span>{t('tenants.newTenant')}</span>
          </Button>
        }
      />

      <DataTable
        data={tenants}
        columns={columns}
        searchPlaceholder={t('common.search')}
        isLoading={loading}
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        size="sm"
        title={t('tenants.newTenant')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={submitting}
              onClick={form.handleSubmit(onSubmitCreate)}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={form.handleSubmit(onSubmitCreate)} className="space-y-3.5">
          <Input
            label={t('tenants.code')}
            required
            className="font-mono uppercase"
            error={form.formState.errors.code?.message}
            {...form.register('code')}
          />
          <Input
            label={t('tenants.name')}
            required
            error={form.formState.errors.name?.message}
            {...form.register('name')}
          />
          <Input
            label={t('tenants.adminEmail')}
            type="email"
            required
            error={form.formState.errors.adminEmail?.message}
            {...form.register('adminEmail')}
          />
          <Input
            label={t('tenants.adminPassword')}
            type="password"
            required
            error={form.formState.errors.adminPassword?.message}
            {...form.register('adminPassword')}
          />
        </form>
      </Dialog>
    </div>
  );
}

export default SuperAdminTenantsPage;
