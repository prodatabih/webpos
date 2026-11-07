import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound, ShieldCheck, UserCheck } from 'lucide-react';
import { t } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { showToast } from '../../components/ui/Toast';

const loginSchema = z.object({
  email: z.string().email(t('common.requiredField')),
  accessCode: z.string().min(4, t('common.requiredField')),
  companyId: z.string().min(1, t('common.requiredField')),
  storeId: z.string().min(1, t('common.requiredField')),
});

const resetSchema = z.object({
  email: z.string().email(t('common.requiredField')),
  taxIdNumber: z.string().regex(/^\d{13}$/, t('common.requiredField')),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type ResetFormValues = z.infer<typeof resetSchema>;

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
    companies,
    activeCompanyId,
    setActiveCompanyId,
    storeLocations,
    activeStoreId,
    setActiveStoreId,
    currentUserName,
  } = useAppStore();

  const [mode, setMode] = useState<'LOGIN' | 'RESET'>('LOGIN');

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'tenant.admin@bosnatrgovina.ba',
      accessCode: '2026',
      companyId: activeCompanyId,
      storeId: activeStoreId,
    },
  });

  const resetForm = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      email: '',
      taxIdNumber: '',
    },
  });

  const handleClose = () => {
    onOpenChange?.(false);
    onClose?.();
  };

  const onSubmitLogin = (values: LoginFormValues) => {
    setActiveCompanyId(values.companyId);
    setActiveStoreId(values.storeId);
    showToast({
      title: t('messages.recordSaved'),
      description: currentUserName,
      variant: 'success',
    });
    handleClose();
  };

  const onSubmitReset = () => {
    showToast({
      title: t('messages.recordSaved'),
      variant: 'info',
    });
    setMode('LOGIN');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onClose={onClose}
      size="sm"
      title={`${t('app.name')} — ${t('app.operator')}`}
      description={t('app.subtitle')}
      footer={
        mode === 'LOGIN' ? (
          <div className="flex w-full items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode('RESET')}
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>{t('common.retry')}</span>
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleClose}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={loginForm.handleSubmit(onSubmitLogin)}
              >
                <UserCheck className="h-4 w-4" />
                <span>{t('common.confirm')}</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex w-full items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode('LOGIN')}
            >
              <span>{t('common.previous')}</span>
            </Button>
            <Button
              variant="primary"
              onClick={resetForm.handleSubmit(onSubmitReset)}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>{t('common.confirm')}</span>
            </Button>
          </div>
        )
      }
    >
      {mode === 'LOGIN' ? (
        <form
          onSubmit={loginForm.handleSubmit(onSubmitLogin)}
          className="space-y-3.5"
        >
          <Input
            label={t('master.email')}
            type="email"
            required
            error={loginForm.formState.errors.email?.message}
            {...loginForm.register('email')}
          />
          <Input
            label={t('common.code')}
            type="password"
            required
            error={loginForm.formState.errors.accessCode?.message}
            className="font-mono"
            {...loginForm.register('accessCode')}
          />

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
        </form>
      ) : (
        <form
          onSubmit={resetForm.handleSubmit(onSubmitReset)}
          className="space-y-3.5"
        >
          <Input
            label={t('master.email')}
            type="email"
            required
            error={resetForm.formState.errors.email?.message}
            {...resetForm.register('email')}
          />
          <Input
            label={t('master.taxIdNumber')}
            required
            maxLength={13}
            error={resetForm.formState.errors.taxIdNumber?.message}
            className="font-mono"
            {...resetForm.register('taxIdNumber')}
          />
        </form>
      )}
    </Dialog>
  );
}

export default LoginDialog;
