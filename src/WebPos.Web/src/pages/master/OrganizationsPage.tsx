import { useState } from 'react';
import { Building2, Edit2, Monitor, Plus, Store } from 'lucide-react';
import { t } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import type { Company, PosTerminal, StoreLocation, StoreType } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { CompanyFormDialog, StoreFormDialog, TerminalFormDialog } from './OrganizationDialogs';

export function OrganizationsPage() {
  const {
    companies,
    activeCompanyId,
    storeLocations,
    activeStoreId,
    posTerminals,
    upsertCompany,
    upsertStoreLocation,
    upsertPosTerminal,
  } = useAppStore();

  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreLocation | null>(null);
  const [terminalDialogOpen, setTerminalDialogOpen] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState<PosTerminal | null>(null);

  const effectiveCompanyId = activeCompanyId || companies[0]?.id || '';
  const companyStores = effectiveCompanyId
    ? storeLocations.filter((s) => s.companyId === effectiveCompanyId)
    : storeLocations;
  const companyStoreIds = new Set(companyStores.map((s) => s.id));
  const companyTerminals = posTerminals.filter((tr) => companyStoreIds.has(tr.storeId));

  const storeTypeLabel = (st: StoreType): string => {
    if (st === 'RETAIL') return t('master.storeTypeRetail');
    if (st === 'WHOLESALE') return t('master.storeTypeWholesale');
    if (st === 'RAW_MATERIAL') return t('master.storeTypeRawMaterial');
    return t('master.storeTypeProduction');
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title={t('nav.organizations')}
        breadcrumbs={[{ label: t('nav.groupMasterData') }, { label: t('nav.organizations') }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => { setEditingCompany(null); setCompanyDialogOpen(true); }}>
              <Building2 className="h-3.5 w-3.5" />
              <span>{t('app.company')}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setEditingStore(null); setStoreDialogOpen(true); }}>
              <Store className="h-3.5 w-3.5" />
              <span>{t('app.storeLocation')}</span>
            </Button>
          </>
        }
        primaryAction={
          <Button variant="primary" size="sm" onClick={() => { setEditingTerminal(null); setTerminalDialogOpen(true); }}>
            <Plus className="h-3.5 w-3.5" />
            <span>{t('app.terminal')}</span>
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <span>{t('app.company')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60 border-b border-border text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">{t('common.code')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('common.name')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('master.taxIdNumber')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('master.vatIdNumber')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('master.address')}</th>
                  <th className="px-4 py-2.5 font-semibold text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {companies.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2.5 font-mono font-semibold">{c.code}</td>
                    <td className="px-4 py-2.5 font-medium">{c.name}</td>
                    <td className="px-4 py-2.5 font-mono">{c.taxIdNumber}</td>
                    <td className="px-4 py-2.5 font-mono">{c.vatIdNumber}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.address}, {c.city}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Button variant="ghost" size="sm" onClick={() => { setEditingCompany(c); setCompanyDialogOpen(true); }}>
                        <Edit2 className="h-3.5 w-3.5" />
                        <span>{t('common.edit')}</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Store className="h-4 w-4 text-primary" />
                <span>{t('app.storeLocation')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 border-b border-border text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">{t('common.code')}</th>
                    <th className="px-4 py-2.5 font-semibold">{t('common.name')}</th>
                    <th className="px-4 py-2.5 font-semibold">{t('common.status')}</th>
                    <th className="px-4 py-2.5 font-semibold text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {companyStores.map((st) => (
                    <tr key={st.id} className="hover:bg-muted/40">
                      <td className="px-4 py-2.5 font-mono font-semibold">{st.code}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{st.name}</div>
                        <div className="text-[11px] text-muted-foreground">{storeTypeLabel(st.storeType)} • {st.address}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={st.isActive ? 'success' : 'secondary'}>
                          {st.isActive ? t('common.active') : t('common.inactive')}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingStore(st); setStoreDialogOpen(true); }}>
                          <Edit2 className="h-3.5 w-3.5" />
                          <span>{t('common.edit')}</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-primary" />
                <span>{t('app.terminal')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 border-b border-border text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">{t('common.code')}</th>
                    <th className="px-4 py-2.5 font-semibold">{t('common.name')}</th>
                    <th className="px-4 py-2.5 font-semibold">{t('master.fiscalNumberPrefix')}</th>
                    <th className="px-4 py-2.5 font-semibold text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {companyTerminals.map((tr) => {
                    const st = companyStores.find((s) => s.id === tr.storeId);
                    return (
                      <tr key={tr.id} className="hover:bg-muted/40">
                        <td className="px-4 py-2.5 font-mono font-semibold">{tr.code}</td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{tr.name}</div>
                          <div className="text-[11px] text-muted-foreground">{st?.name}</div>
                        </td>
                        <td className="px-4 py-2.5 font-mono">
                          {tr.fiscalPrefix}-{String(tr.lastSequenceNumber).padStart(6, '0')}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Button variant="ghost" size="sm" onClick={() => { setEditingTerminal(tr); setTerminalDialogOpen(true); }}>
                            <Edit2 className="h-3.5 w-3.5" />
                            <span>{t('common.edit')}</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>

      <CompanyFormDialog open={companyDialogOpen} onClose={() => setCompanyDialogOpen(false)} editingCompany={editingCompany} onSave={upsertCompany} />
      <StoreFormDialog open={storeDialogOpen} onClose={() => setStoreDialogOpen(false)} companyId={effectiveCompanyId} editingStore={editingStore} onSave={upsertStoreLocation} />
      <TerminalFormDialog open={terminalDialogOpen} onClose={() => setTerminalDialogOpen(false)} stores={companyStores} defaultStoreId={activeStoreId || companyStores[0]?.id || ''} editingTerminal={editingTerminal} onSave={upsertPosTerminal} />
    </div>
  );
}

export default OrganizationsPage;
