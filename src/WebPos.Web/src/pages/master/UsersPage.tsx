import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Shield, UserRound } from 'lucide-react';
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
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { showToast } from '../../components/ui/Toast';

const TENANT_ROLES = ['TenantAdmin', 'Manager', 'Cashier', 'Accountant'] as const;

const createUserSchema = z.object({
  userName: z.string().min(2, t('common.requiredField')),
  email: z.string().email(t('common.requiredField')),
  password: z.string().min(6, t('common.requiredField')),
  role: z.enum(TENANT_ROLES),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

export function UsersPage() {
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      userName: '',
      email: '',
      password: '',
      role: 'Cashier',
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

  const columns = useMemo<ColumnDef<TenantUser>[]>(
    () => [
      {
        accessorKey: 'userName',
        header: t('users.userName'),
        cell: ({ row }) => (
          <div className="flex items-center gap-2 font-medium text-foreground">
            <UserRound className="h-4 w-4 text-muted-foreground" />
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
    ],
    []
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
    </div>
  );
}

export default UsersPage;
