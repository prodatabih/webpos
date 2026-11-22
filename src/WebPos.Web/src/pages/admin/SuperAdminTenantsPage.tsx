import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Building2, Edit2, KeyRound, Plus, Power } from 'lucide-react';
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
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { showToast } from '../../components/ui/Toast';

const createTenantSchema = z.object({
  code: z.string().trim().min(2, 'Šifra mora imati najmanje 2 karaktera.'),
  name: z.string().trim().min(2, 'Naziv mora imati najmanje 2 karaktera.'),
  adminEmail: z.string().trim().email('Unesite ispravnu adresu e-pošte.'),
  adminPassword: z.string().min(6, t('auth.passwordMinLength')),
});

type CreateTenantFormValues = z.infer<typeof createTenantSchema>;

const editTenantSchema = z.object({
  code: z.string().trim().min(2, 'Šifra mora imati najmanje 2 karaktera.'),
  name: z.string().trim().min(2, 'Naziv mora imati najmanje 2 karaktera.'),
});

type EditTenantFormValues = z.infer<typeof editTenantSchema>;

const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(6, t('auth.passwordMinLength')),
    confirmPassword: z.string().min(6, t('auth.passwordMinLength')),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: t('auth.passwordsDoNotMatch'),
    path: ['confirmPassword'],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export function SuperAdminTenantsPage() {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [editingTenant, setEditingTenant] = useState<TenantSummary | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [resetTarget, setResetTarget] = useState<TenantSummary | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);

  const [toggleTarget, setToggleTarget] = useState<TenantSummary | null>(null);

  const form = useForm<CreateTenantFormValues>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      code: '',
      name: '',
      adminEmail: '',
      adminPassword: '',
    },
  });

  const editForm = useForm<EditTenantFormValues>({
    resolver: zodResolver(editTenantSchema),
    defaultValues: {
      code: '',
      name: '',
    },
  });

  const resetForm = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
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

  const handleOpenEdit = useCallback(
    (tenant: TenantSummary) => {
      editForm.reset({ code: tenant.code, name: tenant.name });
      setEditingTenant(tenant);
    },
    [editForm]
  );

  const handleOpenReset = useCallback(
    (tenant: TenantSummary) => {
      resetForm.reset({ newPassword: '', confirmPassword: '' });
      setResetTarget(tenant);
    },
    [resetForm]
  );

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

  const onSubmitEdit = async (values: EditTenantFormValues) => {
    if (!editingTenant) return;
    setSavingEdit(true);
    try {
      const updated = await apiClient.updateTenant(editingTenant.id, {
        code: values.code.trim().toUpperCase(),
        name: values.name.trim(),
      });
      setTenants((prev) =>
        prev.map((item) => (item.id === editingTenant.id ? { ...item, ...updated } : item))
      );
      showToast({ title: t('messages.recordSaved'), variant: 'success' });
      setEditingTenant(null);
    } catch (err) {
      showToast({
        title: t('common.errorTitle'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'error',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const onSubmitResetPassword = async (values: ResetPasswordFormValues) => {
    if (!resetTarget) return;
    setResettingPassword(true);
    try {
      const res = await apiClient.resetTenantAdminPassword(resetTarget.id, {
        newPassword: values.newPassword,
      });
      showToast({
        title: res?.message || 'Lozinka administratora tenanta je uspješno resetovana.',
        variant: 'success',
      });
      setResetTarget(null);
    } catch (err) {
      showToast({
        title: t('common.errorTitle'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'error',
      });
    } finally {
      setResettingPassword(false);
    }
  };

  const handleConfirmToggle = useCallback(async () => {
    if (!toggleTarget) return;
    try {
      const updated = await apiClient.toggleTenant(toggleTarget.id);
      setTenants((prev) =>
        prev.map((item) => (item.id === toggleTarget.id ? { ...item, ...updated } : item))
      );
      showToast({ title: t('tenants.tenantToggled'), variant: 'success' });
      setToggleTarget(null);
    } catch (err) {
      showToast({
        title: t('common.errorTitle'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'error',
      });
    }
  }, [toggleTarget]);

  const columns = useMemo<ColumnDef<TenantSummary>[]>(
    () => [
      {
        accessorKey: 'code',
        header: 'Šifra',
        cell: ({ row }) => (
          <Badge variant="default" className="font-mono font-bold">
            {row.original.code}
          </Badge>
        ),
      },
      {
        accessorKey: 'name',
        header: 'Naziv tenanta',
        cell: ({ row }) => (
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{row.original.name}</span>
          </div>
        ),
      },
      {
        accessorKey: 'adminEmail',
        header: 'Email administratora',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.adminEmail || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'userCount',
        header: 'Korisnici',
        cell: ({ row }) => (
          <div className="text-right font-mono font-medium">
            {row.original.userCount ?? 0}
          </div>
        ),
      },
      {
        accessorKey: 'companyCount',
        header: 'Firme',
        cell: ({ row }) => (
          <div className="text-right font-mono font-medium">
            {row.original.companyCount ?? 0}
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
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenEdit(row.original);
              }}
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span>Uredi</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenReset(row.original);
              }}
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>Reset lozinke</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setToggleTarget(row.original);
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
    [handleOpenEdit, handleOpenReset]
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
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              isLoading={submitting}
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

      <Dialog
        open={Boolean(editingTenant)}
        onOpenChange={(open) => {
          if (!open) setEditingTenant(null);
        }}
        size="sm"
        title={editingTenant ? `Uredi tenanta — ${editingTenant.name}` : 'Uredi tenanta'}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setEditingTenant(null)}
              disabled={savingEdit}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              isLoading={savingEdit}
              onClick={editForm.handleSubmit(onSubmitEdit)}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-3.5">
          <Input
            label={t('tenants.code')}
            required
            className="font-mono uppercase"
            error={editForm.formState.errors.code?.message}
            {...editForm.register('code')}
          />
          <Input
            label={t('tenants.name')}
            required
            error={editForm.formState.errors.name?.message}
            {...editForm.register('name')}
          />
        </form>
      </Dialog>

      <Dialog
        open={Boolean(resetTarget)}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null);
        }}
        size="sm"
        title={
          resetTarget
            ? `Reset lozinke administratora — ${resetTarget.name}`
            : 'Reset lozinke administratora'
        }
        description={
          resetTarget?.adminEmail
            ? `Postavljanje nove lozinke za administratora (${resetTarget.adminEmail}).`
            : 'Postavite novu lozinku za administratora odabranog tenanta.'
        }
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setResetTarget(null)}
              disabled={resettingPassword}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              isLoading={resettingPassword}
              onClick={resetForm.handleSubmit(onSubmitResetPassword)}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={resetForm.handleSubmit(onSubmitResetPassword)} className="space-y-3.5">
          <Input
            label={t('auth.newPassword')}
            type="password"
            required
            error={resetForm.formState.errors.newPassword?.message}
            {...resetForm.register('newPassword')}
          />
          <Input
            label={t('auth.confirmPassword')}
            type="password"
            required
            error={resetForm.formState.errors.confirmPassword?.message}
            {...resetForm.register('confirmPassword')}
          />
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(toggleTarget)}
        onOpenChange={(open) => {
          if (!open) setToggleTarget(null);
        }}
        variant={toggleTarget?.isActive ? 'destructive' : 'primary'}
        title={
          toggleTarget?.isActive
            ? `Deaktivirati tenanta "${toggleTarget.name}"?`
            : `Aktivirati tenanta "${toggleTarget?.name ?? ''}"?`
        }
        description={
          toggleTarget?.isActive
            ? 'Korisnici ovog tenanta neće moći pristupiti aplikaciji dok tenant ne bude ponovo aktiviran.'
            : 'Korisnicima ovog tenanta bit će ponovo omogućen pristup aplikaciji.'
        }
        confirmLabel={toggleTarget?.isActive ? t('tenants.deactivate') : t('tenants.activate')}
        onConfirm={handleConfirmToggle}
      />
    </div>
  );
}

export default SuperAdminTenantsPage;
