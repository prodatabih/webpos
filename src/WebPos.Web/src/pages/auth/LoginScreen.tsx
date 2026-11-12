import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LogIn } from 'lucide-react';
import { t } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const loginSchema = z.object({
  email: z.string().email(t('common.requiredField')),
  password: z.string().min(1, t('common.requiredField')),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginScreen() {
  const { authStatus, loginWithApi } = useAppStore();
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitting(true);
    setAuthError(null);
    const res = await loginWithApi(values.email.trim(), values.password);
    setSubmitting(false);
    if (!res.ok) {
      setAuthError(res.error ?? t('auth.invalidCredentials'));
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
              {t('app.name')}
            </h1>
            <p className="text-xs text-muted-foreground">{t('auth.subtitle')}</p>
          </div>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label={t('auth.email')}
            type="email"
            autoComplete="username"
            required
            error={form.formState.errors.email?.message}
            {...form.register('email')}
          />

          <Input
            label={t('auth.password')}
            type="password"
            autoComplete="current-password"
            required
            error={form.formState.errors.password?.message}
            {...form.register('password')}
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
            disabled={submitting}
          >
            <LogIn className="h-4 w-4" />
            <span>{t('auth.loginButton')}</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
