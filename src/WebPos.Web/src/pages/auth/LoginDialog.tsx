import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LogOut, UserCheck } from 'lucide-react';
import { t } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { showToast } from '../../components/ui/Toast';

const loginSchema = z.object({
  email: z.string().email(t('common.requiredField')),
  password: z.string().min(1, t('common.requiredField')),
  companyId: z.string().optional(),
  storeId: z.string().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export interface LoginDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
}

export function LoginDialog({
  open = true,
  onOpenChange,
  onClose,
}: LoginDialogProps) {
  const {
    backendMode,
    loginWithApi,
    logout,
    companies,
    activeCompanyId,
    setActiveCompanyId,
    storeLocations,
    activeStoreId,
    setActiveStoreId,
    currentUserName,
    currentUserEmail,
  } = useAppStore();

  const [submitting, setSubmitting] = useState(false);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: currentUserEmail || '',
      password: '',
      companyId: activeCompanyId,
      storeId: activeStoreId,
    },
  });

  const handleClose = () => {
    onOpenChange?.(false);
    onClose?.();
  };

  const onSubmitLogin = async (values: LoginFormValues) => {
    if (backendMode === 'API') {
      setSubmitting(true);
      const res = await loginWithApi(values.email.trim(), values.password);
      setSubmitting(false);
      if (!res.ok) {
        showToast({
          title: t('common.errorTitle'),
          description: res.error ?? t('auth.invalidCredentials'),
          variant: 'error',
        });
        return;
      }
    }

    if (values.companyId) {
      setActiveCompanyId(values.companyId);
    }
    if (values.storeId) {
      setActiveStoreId(values.storeId);
    }
    showToast({
      title: t('messages.recordSaved'),
      description: currentUserName || values.email,
      variant: 'success',
    });
    handleClose();
  };

  const handleLogout = () => {
    logout();
    handleClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onClose={onClose}
      size="sm"
      title={`${t('app.name')} — ${t('app.operator')}`}
      description={t('auth.switchContext')}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {backendMode === 'API' ? (
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-3.5 w-3.5" />
              <span>{t('auth.logoutButton')}</span>
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleClose}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={submitting}
              onClick={loginForm.handleSubmit(onSubmitLogin)}
            >
              <UserCheck className="h-4 w-4" />
              <span>{t('auth.loginButton')}</span>
            </Button>
          </div>
        </div>
      }
    >
      <form
        onSubmit={loginForm.handleSubmit(onSubmitLogin)}
        className="space-y-3.5"
      >
        <Input
          label={t('auth.email')}
          type="email"
          required
          error={loginForm.formState.errors.email?.message}
          {...loginForm.register('email')}
        />
        <Input
          label={t('auth.password')}
          type="password"
          required
          error={loginForm.formState.errors.password?.message}
          {...loginForm.register('password')}
        />

        {companies.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-foreground">
              {t('app.company')}
            </label>
            <select
              {...loginForm.register('companyId')}
              className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {storeLocations.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-foreground">
              {t('app.storeLocation')}
            </label>
            <select
              {...loginForm.register('storeId')}
              className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground"
            >
              {storeLocations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </form>
    </Dialog>
  );
}

export default LoginDialog;
