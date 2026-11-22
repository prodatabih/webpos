import { useMemo, useState } from 'react';
import { CalendarRange, Lock, Plus, Unlock } from 'lucide-react';
import { t } from '../../i18n';
import { formatDateBs, formatDateTimeBs } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { showToast } from '../../components/ui/Toast';

export function FiscalPeriodsPage() {
  const {
    companies,
    activeCompanyId,
    fiscalYears,
    activeFiscalYearId,
    setActiveFiscalYearId,
    fiscalPeriods,
    createFiscalYear,
    toggleFiscalPeriodLock,
  } = useAppStore();

  const [newYearOpen, setNewYearOpen] = useState(false);
  const [yearInput, setYearInput] = useState(String(new Date().getFullYear()));
  const [savingYear, setSavingYear] = useState(false);

  const effectiveCompanyId = activeCompanyId || companies[0]?.id || '';

  const companyYears = useMemo(
    () => fiscalYears.filter((fy) => fy.companyId === effectiveCompanyId),
    [fiscalYears, effectiveCompanyId]
  );

  const companyPeriods = useMemo(
    () =>
      fiscalPeriods
        .filter(
          (fp) => fp.companyId === effectiveCompanyId && fp.fiscalYearId === activeFiscalYearId
        )
        .sort((a, b) => a.month - b.month),
    [fiscalPeriods, effectiveCompanyId, activeFiscalYearId]
  );

  const handleCreateYear = async () => {
    if (!effectiveCompanyId) {
      showToast({ title: 'Prvo kreirajte preduzeće u Organizaciji.', variant: 'error' });
      return;
    }
    const parsedYear = Number(yearInput);
    if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
      showToast({ title: 'Unesite ispravnu poslovnu godinu (npr. 2026).', variant: 'error' });
      return;
    }
    setSavingYear(true);
    try {
      const res = await createFiscalYear(effectiveCompanyId, parsedYear);
      if (!res.ok) {
        showToast({ title: t('common.errorTitle'), description: res.error, variant: 'error' });
        return;
      }
      showToast({ title: `Kreirana poslovna godina ${parsedYear} sa 12 mjesečnih perioda.`, variant: 'success' });
      setNewYearOpen(false);
    } finally {
      setSavingYear(false);
    }
  };

  const handleToggleLock = (periodId: string) => {
    toggleFiscalPeriodLock(periodId);
    showToast({ title: t('messages.recordSaved'), variant: 'success' });
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title={t('nav.fiscalPeriods')}
        breadcrumbs={[
          { label: t('nav.groupMasterData') },
          { label: t('nav.fiscalPeriods') },
        ]}
        primaryAction={
          <Button variant="primary" size="sm" onClick={() => setNewYearOpen(true)}>
            <Plus className="h-4 w-4" />
            <span>Nova poslovna godina</span>
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-primary" />
              <span>{t('app.fiscalYear')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60 border-b border-border text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">{t('app.fiscalYear')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('common.date')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('common.status')}</th>
                  <th className="px-4 py-2.5 font-semibold text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {companyYears.map((fy) => {
                  const isSelected = fy.id === activeFiscalYearId;
                  return (
                    <tr
                      key={fy.id}
                      onClick={() => setActiveFiscalYearId(fy.id)}
                      className="hover:bg-muted/40 cursor-pointer"
                    >
                      <td className="px-4 py-2.5 font-mono font-semibold text-foreground">
                        {fy.year}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground">
                        {formatDateBs(fy.startDate)} — {formatDateBs(fy.endDate)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={fy.isLocked ? 'destructive' : 'success'}>
                          {fy.isLocked ? t('status.LOCKED') : t('status.OPEN')}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {isSelected && (
                          <Badge variant="default">{t('common.active')}</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              <span>{t('master.periodMonth')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60 border-b border-border text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">{t('master.periodMonth')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('common.name')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('common.date')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('common.status')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('audit.user')}</th>
                  <th className="px-4 py-2.5 font-semibold text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {companyPeriods.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      {t('common.noResults')}
                    </td>
                  </tr>
                ) : (
                  companyPeriods.map((fp) => (
                    <tr key={fp.id} className="hover:bg-muted/40">
                      <td className="px-4 py-2.5 font-mono font-semibold">
                        {String(fp.month).padStart(2, '0')}
                      </td>
                      <td className="px-4 py-2.5 font-medium">{fp.name}</td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground">
                        {formatDateBs(fp.startDate)} — {formatDateBs(fp.endDate)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={fp.isLocked ? 'destructive' : 'success'}>
                          {fp.isLocked ? t('status.LOCKED') : t('status.OPEN')}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {fp.isLocked && fp.lockedBy
                          ? `${fp.lockedBy} (${formatDateTimeBs(fp.lockedAt)})`
                          : '-'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          variant={fp.isLocked ? 'outline' : 'destructive'}
                          size="sm"
                          onClick={() => handleToggleLock(fp.id)}
                        >
                          {fp.isLocked ? (
                            <>
                              <Unlock className="h-3.5 w-3.5" />
                              <span>{t('master.unlockPeriod')}</span>
                            </>
                          ) : (
                            <>
                              <Lock className="h-3.5 w-3.5" />
                              <span>{t('master.lockPeriod')}</span>
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={newYearOpen}
        onClose={() => setNewYearOpen(false)}
        size="sm"
        title="Nova poslovna godina"
        description="Kreiranjem poslovne godine automatski se generiše svih 12 mjesečnih perioda (Januar–Decembar)."
        footer={
          <>
            <Button variant="outline" onClick={() => setNewYearOpen(false)} disabled={savingYear}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={() => void handleCreateYear()} disabled={savingYear}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Godina"
            type="number"
            min={2000}
            max={2100}
            required
            value={yearInput}
            onChange={(e) => setYearInput(e.target.value)}
            className="font-mono"
          />
        </div>
      </Dialog>
    </div>
  );
}

export default FiscalPeriodsPage;
