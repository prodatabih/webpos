import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound, LogOut, ShieldCheck, UserCheck } from 'lucide-react';
import { t } from '../../i18n';
import { cn } from '../../lib/utils';
import { apiClient } from '../../api/apiClient';
import { useAppStore } from '../../store/useAppStore';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { showToast } from '../../components/ui/Toast';

type DialogTab = 'profile' | 'password';

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, t('common.requiredField')),
    newPassword: z.string().min(6, t('auth.passwordMinLength')),
    confirmPassword: z.string().min(1, t('common.requiredField')),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: t('auth.passwordsDoNotMatch'),
    path: ['confirmPassword'],
  });

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

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
    logout,
    companies,
    activeCompanyId,
    setActiveCompanyId,
    storeLocations,
    activeStoreId,
    setActiveStoreId,
    fiscalYears,
    activeFiscalYearId,
    setActiveFiscalYearId,
    currentUserName,
    currentUserEmail,
    currentUserRole,
    activeTenantId,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<DialogTab>('profile');
  const [selectedCompanyId, setSelectedCompanyId] = useState(activeCompanyId);
  const [selectedStoreId, setSelectedStoreId] = useState(activeStoreId);
  const [selectedFiscalYearId, setSelectedFiscalYearId] = useState(activeFiscalYearId);
  const [submitting, setSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const passwordForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (open) {
      setActiveTab('profile');
      setSelectedCompanyId(activeCompanyId);
      setSelectedStoreId(activeStoreId);
      setSelectedFiscalYearId(activeFiscalYearId);
      setPasswordError(null);
      setSubmitting(false);
      passwordForm.reset({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
  }, [open, activeCompanyId, activeStoreId, activeFiscalYearId, passwordForm]);

  const hasTenantContext = currentUserRole !== 'SuperAdmin' || Boolean(activeTenantId);

  const filteredStores = selectedCompanyId
    ? storeLocations.filter((s) => s.companyId === selectedCompanyId)
    : storeLocations;

  const filteredFiscalYears = selectedCompanyId
    ? fiscalYears.filter((fy) => fy.companyId === selectedCompanyId)
    : fiscalYears;

  const handleClose = () => {
    onOpenChange?.(false);
    onClose?.();
  };

  const handleSelectCompany = (nextCompanyId: string) => {
    setSelectedCompanyId(nextCompanyId);
    const nextStores = nextCompanyId
      ? storeLocations.filter((s) => s.companyId === nextCompanyId)
      : storeLocations;
    if (!nextStores.some((s) => s.id === selectedStoreId)) {
      setSelectedStoreId(nextStores[0]?.id ?? '');
    }
    const nextFys = nextCompanyId
      ? fiscalYears.filter((fy) => fy.companyId === nextCompanyId)
      : fiscalYears;
    if (!nextFys.some((fy) => fy.id === selectedFiscalYearId)) {
      setSelectedFiscalYearId(nextFys[0]?.id ?? '');
    }
  };

  const handleApplyContext = () => {
    if (selectedCompanyId !== activeCompanyId) {
      setActiveCompanyId(selectedCompanyId);
    }
    if (selectedStoreId !== activeStoreId) {
      setActiveStoreId(selectedStoreId);
    }
    if (selectedFiscalYearId !== activeFiscalYearId) {
      setActiveFiscalYearId(selectedFiscalYearId);
    }
    showToast({
      title: t('auth.contextUpdated'),
      variant: 'success',
    });
    handleClose();
  };

  const handleLogout = () => {
    logout();
    handleClose();
  };

  const onSubmitPasswordChange = async (values: ChangePasswordFormValues) => {
    if (backendMode !== 'API') {
      setPasswordError(t('auth.changePasswordApiOnly'));
      return;
    }
    setSubmitting(true);
    setPasswordError(null);
    try {
      await apiClient.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      showToast({
        title: t('auth.passwordChangedSuccess'),
        variant: 'success',
      });
      passwordForm.reset({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      handleClose();
    } catch (err) {
      setPasswordError(
        err instanceof Error && err.message
          ? err.message
          : t('common.errorTitle')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const roleLabelKey = `users.roles.${currentUserRole}` as const;

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
            <Button variant="outline" size="sm" onClick={handleLogout} disabled={submitting}>
              <LogOut className="h-3.5 w-3.5" />
              <span>{t('auth.logoutButton')}</span>
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleClose} disabled={submitting}>
              {t('common.close')}
            </Button>
            {activeTab === 'profile' && hasTenantContext && companies.length > 0 && (
              <Button variant="primary" onClick={handleApplyContext}>
                <UserCheck className="h-4 w-4" />
                <span>{t('auth.applyContext')}</span>
              </Button>
            )}
            {activeTab === 'password' && (
              <Button
                variant="primary"
                isLoading={submitting}
                onClick={passwordForm.handleSubmit(onSubmitPasswordChange)}
              >
                <KeyRound className="h-4 w-4" />
                <span>{t('auth.resetPasswordButton')}</span>
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 rounded-md border border-border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('profile');
              setPasswordError(null);
            }}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
              activeTab === 'profile'
                ? 'bg-card text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span>{t('auth.profileSessionTab')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('password');
              setPasswordError(null);
            }}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
              activeTab === 'password'
                ? 'bg-card text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>{t('auth.changePasswordTab')}</span>
          </button>
        </div>

        {activeTab === 'profile' ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] text-muted-foreground">{t('auth.currentUser')}</div>
                  <div className="text-sm font-semibold text-foreground truncate">
                    {currentUserName || '—'}
                  </div>
                </div>
                <Badge variant="default" className="shrink-0">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  {t(roleLabelKey)}
                </Badge>
              </div>
              {currentUserEmail && (
                <div className="text-xs text-muted-foreground truncate">{currentUserEmail}</div>
              )}
            </div>

            {hasTenantContext && companies.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-foreground">
                  {t('auth.contextSection')}
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-foreground">
                    {t('app.company')}
                  </label>
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => handleSelectCompany(e.target.value)}
                    className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground"
                  >
                    <option value="">-- Odaberi preduzeće --</option>
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
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground"
                  >
                    <option value="">-- Odaberi poslovnicu --</option>
                    {filteredStores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-foreground">
                    {t('app.fiscalYear')}
                  </label>
                  <select
                    value={selectedFiscalYearId}
                    onChange={(e) => setSelectedFiscalYearId(e.target.value)}
                    className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground"
                  >
                    <option value="">-- Odaberi fiskalnu godinu --</option>
                    {filteredFiscalYears.map((fy) => (
                      <option key={fy.id} value={fy.id}>
                        {fy.year} {fy.isLocked ? `(${t('status.LOCKED')})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        ) : (
          <form
            onSubmit={passwordForm.handleSubmit(onSubmitPasswordChange)}
            className="space-y-3.5"
          >
            <Input
              label={t('auth.currentPassword')}
              type="password"
              autoComplete="current-password"
              required
              error={passwordForm.formState.errors.currentPassword?.message}
              {...passwordForm.register('currentPassword')}
            />
            <Input
              label={t('auth.newPassword')}
              type="password"
              autoComplete="new-password"
              required
              error={passwordForm.formState.errors.newPassword?.message}
              {...passwordForm.register('newPassword')}
            />
            <Input
              label={t('auth.confirmPassword')}
              type="password"
              autoComplete="new-password"
              required
              error={passwordForm.formState.errors.confirmPassword?.message}
              {...passwordForm.register('confirmPassword')}
            />

            {passwordError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {passwordError}
              </div>
            )}
          </form>
        )}
      </div>
    </Dialog>
  );
}

export default LoginDialog;
