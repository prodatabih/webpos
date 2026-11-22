import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Edit2, KeyRound, Plus, Power, Shield, UserRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { t } from '../../i18n';
import { apiClient } from '../../api/apiClient';
import type { TenantUser } from '../../api/apiTypes';
import { formatDateBs } from '../../lib/utils';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Dialog } from '../../components/ui/Dialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { showToast } from '../../components/ui/Toast';

const TENANT_ROLES = ['TenantAdmin', 'Manager', 'Cashier', 'Accountant'] as const;

const createUserSchema = z.object({
  userName: z.string().trim().min(2, 'Korisničko ime mora imati najmanje 2 karaktera.'),
  email: z.string().trim().email('Unesite ispravnu adresu e-pošte.'),
  password: z.string().min(6, t('auth.passwordMinLength')),
  role: z.enum(TENANT_ROLES),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

const editUserSchema = z.object({
  userName: z.string().trim().min(2, 'Korisničko ime mora imati najmanje 2 karaktera.'),
  email: z.string().trim().email('Unesite ispravnu adresu e-pošte.'),
  role: z.enum(TENANT_ROLES),
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

const resetUserPasswordSchema = z
  .object({
    newPassword: z.string().min(6, t('auth.passwordMinLength')),
    confirmPassword: z.string().min(6, t('auth.passwordMinLength')),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: t('auth.passwordsDoNotMatch'),
    path: ['confirmPassword'],
  });

type ResetUserPasswordFormValues = z.infer<typeof resetUserPasswordSchema>;

export function UsersPage() {
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [editingUser, setEditingUser] = useState<TenantUser | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [toggleTarget, setToggleTarget] = useState<TenantUser | null>(null);

  const [resetTarget, setResetTarget] = useState<TenantUser | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      userName: '',
      email: '',
      password: '',
      role: 'Cashier',
    },
  });

  const editForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      userName: '',
      email: '',
      role: 'Cashier',
    },
  });

  const resetForm = useForm<ResetUserPasswordFormValues>({
    resolver: zodResolver(resetUserPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getUsers();
      setUsers(data);
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
    void loadUsers();
  }, [loadUsers]);

  const handleOpenCreate = () => {
    form.reset({ userName: '', email: '', password: '', role: 'Cashier' });
    setDialogOpen(true);
  };

  const handleOpenEdit = useCallback(
    (user: TenantUser) => {
      editForm.reset({
        userName: user.userName,
        email: user.email,
        role: user.role,
      });
      setEditingUser(user);
    },
    [editForm]
  );

  const handleOpenReset = useCallback(
    (user: TenantUser) => {
      resetForm.reset({ newPassword: '', confirmPassword: '' });
      setResetTarget(user);
    },
    [resetForm]
  );

  const onSubmitCreate = async (values: CreateUserFormValues) => {
    setSubmitting(true);
    try {
      const created = await apiClient.createUser({
        userName: values.userName.trim(),
        email: values.email.trim(),
        password: values.password,
        role: values.role,
      });
      setUsers((prev) => [created, ...prev]);
      showToast({ title: t('users.userCreated'), variant: 'success' });
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

  const onSubmitEdit = async (values: EditUserFormValues) => {
    if (!editingUser) return;
    setSavingEdit(true);
    try {
      const updated = await apiClient.updateUser(editingUser.id, {
        username: values.userName.trim(),
        email: values.email.trim(),
        role: values.role,
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === editingUser.id ? { ...u, ...updated } : u))
      );
      showToast({ title: t('messages.recordSaved'), variant: 'success' });
      setEditingUser(null);
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

  const handleConfirmToggle = useCallback(async () => {
    if (!toggleTarget) return;
    try {
      const updated = await apiClient.toggleUser(toggleTarget.id);
      setUsers((prev) =>
        prev.map((u) => (u.id === toggleTarget.id ? { ...u, ...updated } : u))
      );
      showToast({
        title: toggleTarget.isActive
          ? `Korisnik "${toggleTarget.userName}" je deaktiviran.`
          : `Korisnik "${toggleTarget.userName}" je aktiviran.`,
        variant: 'success',
      });
      setToggleTarget(null);
    } catch (err) {
      showToast({
        title: t('common.errorTitle'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'error',
      });
    }
  }, [toggleTarget]);

  const onSubmitResetPassword = async (values: ResetUserPasswordFormValues) => {
    if (!resetTarget) return;
    setResettingPassword(true);
    try {
      const res = await apiClient.resetUserPassword(resetTarget.id, {
        newPassword: values.newPassword,
      });
      showToast({
        title: res?.message || 'Lozinka korisnika je uspješno resetovana.',
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

  const columns = useMemo<ColumnDef<TenantUser>[]>(
    () => [
      {
        accessorKey: 'userName',
        header: t('users.userName'),
        cell: ({ row }) => (
          <div className="flex items-center gap-2 font-medium text-foreground">
            <UserRound className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{row.original.userName}</span>
          </div>
        ),
      },
      {
        accessorKey: 'email',
        header: t('users.email'),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">{row.original.email}</span>
        ),
      },
      {
        accessorKey: 'role',
        header: t('users.role'),
        cell: ({ row }) => (
          <Badge variant="default" className="gap-1">
            <Shield className="h-3 w-3" />
            <span>{t(`users.roles.${row.original.role}`)}</span>
          </Badge>
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
        header: t('users.createdAt'),
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
        title={t('users.title')}
        subtitle={t('users.subtitle')}
        actions={
          <Button variant="primary" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4" />
            <span>{t('users.newUser')}</span>
          </Button>
        }
      />

      <DataTable
        data={users}
        columns={columns}
        searchPlaceholder={t('common.search')}
        isLoading={loading}
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        size="sm"
        title={t('users.newUser')}
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
            label={t('users.userName')}
            required
            error={form.formState.errors.userName?.message}
            {...form.register('userName')}
          />
          <Input
            label={t('users.email')}
            type="email"
            required
            error={form.formState.errors.email?.message}
            {...form.register('email')}
          />
          <Input
            label={t('users.password')}
            type="password"
            required
            error={form.formState.errors.password?.message}
            {...form.register('password')}
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-foreground">
              {t('users.role')}
            </label>
            <select
              {...form.register('role')}
              className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground"
            >
              {TENANT_ROLES.map((role) => (
                <option key={role} value={role}>
                  {t(`users.roles.${role}`)}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(editingUser)}
        onOpenChange={(open) => {
          if (!open) setEditingUser(null);
        }}
        size="sm"
        title={editingUser ? `Uredi korisnika — ${editingUser.userName}` : 'Uredi korisnika'}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setEditingUser(null)}
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
            label={t('users.userName')}
            required
            error={editForm.formState.errors.userName?.message}
            {...editForm.register('userName')}
          />
          <Input
            label={t('users.email')}
            type="email"
            required
            error={editForm.formState.errors.email?.message}
            {...editForm.register('email')}
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-foreground">
              {t('users.role')}
            </label>
            <select
              {...editForm.register('role')}
              className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground"
            >
              {TENANT_ROLES.map((role) => (
                <option key={role} value={role}>
                  {t(`users.roles.${role}`)}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(resetTarget)}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null);
        }}
        size="sm"
        title={resetTarget ? `Reset lozinke — ${resetTarget.userName}` : 'Reset lozinke'}
        description={
          resetTarget
            ? `Postavljanje nove lozinke za korisnika ${resetTarget.email}.`
            : undefined
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
            ? `Deaktivirati korisnika "${toggleTarget.userName}"?`
            : `Aktivirati korisnika "${toggleTarget?.userName ?? ''}"?`
        }
        description={
          toggleTarget?.isActive
            ? 'Korisnik se neće moći prijaviti u sistem dok račun ponovo ne bude aktiviran.'
            : 'Korisniku će ponovo biti omogućena prijava u sistem.'
        }
        confirmLabel={toggleTarget?.isActive ? t('tenants.deactivate') : t('tenants.activate')}
        onConfirm={handleConfirmToggle}
      />
    </div>
  );
}

export default UsersPage;
