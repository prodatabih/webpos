import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, Save, Settings } from 'lucide-react';
import { t } from '../../i18n';
import { apiClient } from '../../api/apiClient';
import { useAppStore } from '../../store/useAppStore';
import type { SystemConfig } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../components/ui/Toast';

interface SettingToggleRowProps {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}

function SettingToggleRow({
  id,
  title,
  description,
  checked,
  onChange,
  disabled,
}: SettingToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-background/60 p-4">
      <div className="space-y-1 min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-foreground cursor-pointer block">
          {title}
        </label>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 ${
          checked ? 'bg-primary' : 'bg-muted-foreground/30'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

const CURRENCY_OPTIONS = [
  { code: 'BAM', label: 'BAM — Konvertibilna marka (KM)' },
  { code: 'EUR', label: 'EUR — Euro (€)' },
  { code: 'RSD', label: 'RSD — Srpski dinar' },
  { code: 'USD', label: 'USD — Američki dolar ($)' },
];

export function TenantSettingsPage() {
  const { backendMode, systemConfig, setSystemConfig, saveTenantSettings } = useAppStore();

  const [formState, setFormState] = useState<SystemConfig>({
    allowNegativeStock: Boolean(systemConfig.allowNegativeStock),
    allowPriceChangeWithoutLeveling: Boolean(systemConfig.allowPriceChangeWithoutLeveling),
    autoCreatePriceLevelingOnInbound: systemConfig.autoCreatePriceLevelingOnInbound ?? true,
    defaultCurrency: systemConfig.defaultCurrency || 'BAM',
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const loadSettingsFromServer = async () => {
    if (backendMode !== 'API') {
      setFormState({
        allowNegativeStock: Boolean(systemConfig.allowNegativeStock),
        allowPriceChangeWithoutLeveling: Boolean(systemConfig.allowPriceChangeWithoutLeveling),
        autoCreatePriceLevelingOnInbound: systemConfig.autoCreatePriceLevelingOnInbound ?? true,
        defaultCurrency: systemConfig.defaultCurrency || 'BAM',
      });
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const remote = await apiClient.getTenantSettings();
      const normalized: SystemConfig = {
        allowNegativeStock: Boolean(remote.allowNegativeStock),
        allowPriceChangeWithoutLeveling: Boolean(remote.allowPriceChangeWithoutLeveling),
        autoCreatePriceLevelingOnInbound: remote.autoCreatePriceLevelingOnInbound ?? true,
        defaultCurrency: remote.defaultCurrency || 'BAM',
      };
      setFormState(normalized);
      setSystemConfig(normalized);
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Greška pri učitavanju postavki tenanta sa servera.';
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettingsFromServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendMode]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    const res = await saveTenantSettings(formState);
    setSaving(false);

    if (!res.ok) {
      const errMsg = res.error || 'Greška pri snimanju postavki tenanta.';
      setSaveError(errMsg);
      showToast({
        title: t('common.errorTitle'),
        description: errMsg,
        variant: 'error',
      });
      return;
    }

    setSavedAt(new Date().toLocaleTimeString('bs-BA'));
    showToast({
      title: 'Postavke snimljene',
      description: 'Sistemske postavke tenanta su uspješno pohranjene na server.',
      variant: 'success',
    });
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Postavke tenanta"
        subtitle="Poslovna pravila za zalihe, nivelacije cijena i zadanu valutu tenanta"
        breadcrumbs={[
          { label: t('nav.groupMasterData') },
          { label: 'Postavke tenanta' },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadSettingsFromServer()}
            disabled={loading || saving}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Osvježi</span>
          </Button>
        }
        primaryAction={
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleSave()}
            isLoading={saving}
            disabled={loading}
          >
            <Save className="h-3.5 w-3.5" />
            <span>Snimi postavke</span>
          </Button>
        }
      />

      <div className="p-6 max-w-3xl space-y-4">
        {loadError && (
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold">Učitavanje postavki nije uspjelo</div>
              <div>{loadError}</div>
            </div>
          </div>
        )}

        {saveError && (
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold">Snimanje nije uspjelo</div>
              <div>{saveError}</div>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              <CardTitle>Poslovna pravila skladišta i maloprodaje</CardTitle>
            </div>
            <CardDescription>
              Promjene ovih postavki odmah stupaju na snagu na serveru za sve poslovnice i POS kase
              unutar tenanta.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <SettingToggleRow
              id="toggle-allow-negative-stock"
              title="Dozvoli negativnu zalihu (na POS kasi, međuskladišnicama i otpisima)"
              description="Ako je isključeno, sistem blokira izdavanje POS računa, knjiženje međuskladišnica i otpisa kada na zalihi nema dovoljno količine."
              checked={Boolean(formState.allowNegativeStock)}
              onChange={(val) => setFormState((prev) => ({ ...prev, allowNegativeStock: val }))}
              disabled={loading || saving}
            />

            <SettingToggleRow
              id="toggle-allow-price-change-without-leveling"
              title="Dozvoli ručnu promjenu MP cijene na artiklu sa zalihom (> 0) bez nivelacije"
              description="Preporučeno isključeno u skladu sa BiH maloprodajnim knjigovodstvom (KEP). Kada je isključeno, promjena MP cijene za artikal sa zalihom mora se provesti kroz dokument Nivelacija cijena."
              checked={Boolean(formState.allowPriceChangeWithoutLeveling)}
              onChange={(val) =>
                setFormState((prev) => ({ ...prev, allowPriceChangeWithoutLeveling: val }))
              }
              disabled={loading || saving}
            />

            <SettingToggleRow
              id="toggle-auto-leveling-inbound"
              title="Automatski kreiraj nivelaciju cijena pri knjiženju kalkulacije sa novom MP cijenom"
              description="Kada ulazna kalkulacija unosi novu maloprodajnu cijenu za artikal koji već ima pozitivnu zalihu, automatski se kreira i knjiži prateća nivelacija cijena i KEP zapis."
              checked={formState.autoCreatePriceLevelingOnInbound ?? true}
              onChange={(val) =>
                setFormState((prev) => ({ ...prev, autoCreatePriceLevelingOnInbound: val }))
              }
              disabled={loading || saving}
            />

            <div className="rounded-lg border border-border bg-background/60 p-4 space-y-2">
              <label
                htmlFor="select-default-currency"
                className="text-sm font-medium text-foreground block"
              >
                Zadana valuta
              </label>
              <p className="text-xs text-muted-foreground">
                Osnovna obračunska valuta za nove firme, dokumente i izvještaje.
              </p>
              <select
                id="select-default-currency"
                value={formState.defaultCurrency || 'BAM'}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, defaultCurrency: e.target.value }))
                }
                disabled={loading || saving}
                className="mt-1 h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              >
                {CURRENCY_OPTIONS.map((cur) => (
                  <option key={cur.code} value={cur.code}>
                    {cur.label}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>

          <CardFooter className="justify-between">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              {savedAt && (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  <span>Zadnje snimljeno u {savedAt}</span>
                </>
              )}
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleSave()}
              isLoading={saving}
              disabled={loading}
            >
              <Save className="h-3.5 w-3.5" />
              <span>Snimi postavke</span>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
