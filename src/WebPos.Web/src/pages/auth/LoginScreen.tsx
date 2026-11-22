import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, CheckCircle2, KeyRound, LogIn, ShieldAlert } from 'lucide-react';
import { t } from '../../i18n';
import { apiClient } from '../../api/apiClient';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { showToast, ToastViewport } from '../../components/ui/Toast';

type ScreenMode = 'login' | 'forgot-step1' | 'forgot-step2';

const loginSchema = z.object({
  identifier: z.string().trim().min(1, t('common.requiredField')),
  password: z.string().min(1, t('common.requiredField')),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const forgotStep1Schema = z.object({
  identifier: z.string().trim().min(1, t('common.requiredField')),
});

type ForgotStep1Values = z.infer<typeof forgotStep1Schema>;

const forgotStep2Schema = z
  .object({
    resetCode: z.string().trim().min(1, t('common.requiredField')),
    newPassword: z.string().min(6, t('auth.passwordMinLength')),
    confirmPassword: z.string().min(1, t('common.requiredField')),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: t('auth.passwordsDoNotMatch'),
    path: ['confirmPassword'],
  });

type ForgotStep2Values = z.infer<typeof forgotStep2Schema>;

export function LoginScreen() {
  const { authStatus, loginWithApi } = useAppStore();
  const [mode, setMode] = useState<ScreenMode>('login');
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const [resetIdentifier, setResetIdentifier] = useState('');
  const [serverResetCode, setServerResetCode] = useState<string | null>(null);
  const [serverResetMessage, setServerResetMessage] = useState<string | null>(null);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  const step1Form = useForm<ForgotStep1Values>({
    resolver: zodResolver(forgotStep1Schema),
    defaultValues: {
      identifier: '',
    },
  });

  const step2Form = useForm<ForgotStep2Values>({
    resolver: zodResolver(forgotStep2Schema),
    defaultValues: {
      resetCode: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmitLogin = async (values: LoginFormValues) => {
    setSubmitting(true);
    setAuthError(null);
    setSuccessNotice(null);
    const res = await loginWithApi(values.identifier.trim(), values.password);
    setSubmitting(false);
    if (!res.ok) {
      setAuthError(res.error ?? t('auth.invalidCredentials'));
    }
  };

  const openForgotFlow = () => {
    const prefill = loginForm.getValues('identifier').trim();
    setAuthError(null);
    setSuccessNotice(null);
    setServerResetCode(null);
    setServerResetMessage(null);
    step1Form.reset({ identifier: prefill });
    setMode('forgot-step1');
  };

  const backToLogin = () => {
    setAuthError(null);
    setServerResetCode(null);
    setServerResetMessage(null);
    setMode('login');
  };

  const onSubmitForgotStep1 = async (values: ForgotStep1Values) => {
    const identifier = values.identifier.trim();
    setSubmitting(true);
    setAuthError(null);
    try {
      const res = await apiClient.forgotPassword(identifier);
      const returnedCode = res.resetCode ?? res.code ?? res.token ?? null;
      setResetIdentifier(identifier);
      setServerResetCode(returnedCode);
      setServerResetMessage(res.message ?? null);
      step2Form.reset({
        resetCode: returnedCode ?? '',
        newPassword: '',
        confirmPassword: '',
      });
      setMode('forgot-step2');
    } catch (err) {
      setAuthError(
        err instanceof Error && err.message
          ? err.message
          : t('common.errorTitle')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmitForgotStep2 = async (values: ForgotStep2Values) => {
    setSubmitting(true);
    setAuthError(null);
    try {
      await apiClient.resetPassword({
        emailOrUsername: resetIdentifier,
        resetCode: values.resetCode.trim(),
        newPassword: values.newPassword,
      });
      showToast({
        title: t('auth.passwordResetSuccess'),
        variant: 'success',
      });
      loginForm.reset({
        identifier: resetIdentifier,
        password: '',
      });
      setSuccessNotice(t('auth.passwordResetSuccess'));
      setServerResetCode(null);
      setServerResetMessage(null);
      setMode('login');
    } catch (err) {
      setAuthError(
        err instanceof Error && err.message
          ? err.message
          : t('common.errorTitle')
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (authStatus === 'CHECKING') {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background text-foreground p-4">
        <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>{t('auth.checkingSession')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background text-foreground p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            WP
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              {mode === 'login'
                ? t('app.name')
                : mode === 'forgot-step1'
                  ? t('auth.forgotPasswordTitle')
                  : t('auth.resetPasswordTitle')}
            </h1>
            <p className="text-xs text-muted-foreground">
              {mode === 'login'
                ? t('auth.subtitle')
                : mode === 'forgot-step1'
                  ? t('auth.forgotPasswordDesc')
                  : t('auth.resetPasswordDesc')}
            </p>
          </div>
        </div>

        {mode === 'login' && (
          <form onSubmit={loginForm.handleSubmit(onSubmitLogin)} className="space-y-4">
            {successNotice && (
              <div className="flex items-start gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs text-foreground">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success mt-0.5" />
                <span>{successNotice}</span>
              </div>
            )}

            <Input
              label={t('auth.usernameOrEmail')}
              type="text"
              autoComplete="username"
              required
              error={loginForm.formState.errors.identifier?.message}
              {...loginForm.register('identifier')}
            />

            <Input
              label={t('auth.password')}
              type="password"
              autoComplete="current-password"
              required
              error={loginForm.formState.errors.password?.message}
              {...loginForm.register('password')}
            />

            {authError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {authError}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={submitting}
            >
              <LogIn className="h-4 w-4" />
              <span>{t('auth.loginButton')}</span>
            </Button>

            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={openForgotFlow}
                className="text-xs font-medium text-primary hover:underline cursor-pointer"
              >
                {t('auth.forgotPassword')}
              </button>
            </div>
          </form>
        )}

        {mode === 'forgot-step1' && (
          <form onSubmit={step1Form.handleSubmit(onSubmitForgotStep1)} className="space-y-4">
            <Input
              label={t('auth.usernameOrEmail')}
              type="text"
              autoComplete="username"
              required
              error={step1Form.formState.errors.identifier?.message}
              {...step1Form.register('identifier')}
            />

            {authError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {authError}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={submitting}
            >
              <KeyRound className="h-4 w-4" />
              <span>{t('auth.sendResetCode')}</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={backToLogin}
              disabled={submitting}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t('auth.backToLogin')}</span>
            </Button>
          </form>
        )}

        {mode === 'forgot-step2' && (
          <form onSubmit={step2Form.handleSubmit(onSubmitForgotStep2)} className="space-y-4">
            {serverResetCode ? (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
                <div className="font-medium text-foreground">
                  {t('auth.resetCodeGenerated')}
                </div>
                <div className="font-mono text-sm font-bold tracking-wider text-primary select-all">
                  {serverResetCode}
                </div>
                {serverResetMessage && (
                  <p className="text-muted-foreground">{serverResetMessage}</p>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <ShieldAlert className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <span>{serverResetMessage || t('auth.resetCodeAdminNotice')}</span>
              </div>
            )}

            <Input
              label={t('auth.resetCode')}
              type="text"
              autoComplete="one-time-code"
              required
              error={step2Form.formState.errors.resetCode?.message}
              {...step2Form.register('resetCode')}
            />

            <Input
              label={t('auth.newPassword')}
              type="password"
              autoComplete="new-password"
              required
              error={step2Form.formState.errors.newPassword?.message}
              {...step2Form.register('newPassword')}
            />

            <Input
              label={t('auth.confirmPassword')}
              type="password"
              autoComplete="new-password"
              required
              error={step2Form.formState.errors.confirmPassword?.message}
              {...step2Form.register('confirmPassword')}
            />

            {authError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {authError}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={submitting}
            >
              <KeyRound className="h-4 w-4" />
              <span>{t('auth.resetPasswordButton')}</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={backToLogin}
              disabled={submitting}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t('auth.backToLogin')}</span>
            </Button>
          </form>
        )}
      </div>

      <ToastViewport />
    </div>
  );
}
