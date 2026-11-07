import { useMemo } from 'react';
import { CalendarRange, Lock, Unlock } from 'lucide-react';
import { t } from '../../i18n';
import { formatDateBs, formatDateTimeBs } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { showToast } from '../../components/ui/Toast';

export function FiscalPeriodsPage() {
  const {
    activeCompanyId,
    fiscalYears,
    activeFiscalYearId,
    setActiveFiscalYearId,
    fiscalPeriods,
    toggleFiscalPeriodLock,
  } = useAppStore();

  const companyYears = useMemo(
    () => fiscalYears.filter((fy) => fy.companyId === activeCompanyId),
    [fiscalYears, activeCompanyId]
  );

  const companyPeriods = useMemo(
    () =>
      fiscalPeriods
        .filter(
          (fp) => fp.companyId === activeCompanyId && fp.fiscalYearId === activeFiscalYearId
        )
        .sort((a, b) => a.month - b.month),
    [fiscalPeriods, activeCompanyId, activeFiscalYearId]
  );

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
    </div>
  );
}

export default FiscalPeriodsPage;
