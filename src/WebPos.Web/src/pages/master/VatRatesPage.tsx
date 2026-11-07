import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Edit2, Plus } from 'lucide-react';
import { t } from '../../i18n';
import { formatMoney2, round2 } from '../../lib/money';
import { formatDateBs, generateUuidV7 } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';
import type { VatRate } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { showToast } from '../../components/ui/Toast';

export function VatRatesPage() {
  const { activeCompanyId, vatRates, upsertVatRate } = useAppStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<VatRate | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [ratePercent, setRatePercent] = useState('17.00');
  const [validFrom, setValidFrom] = useState('2026-01-01');
  const [isActive, setIsActive] = useState(true);

  const companyRates = useMemo(
    () => vatRates.filter((vr) => vr.companyId === activeCompanyId),
    [vatRates, activeCompanyId]
  );

  useEffect(() => {
    if (!dialogOpen) return;
    if (editingRate) {
      setCode(editingRate.code);
      setName(editingRate.name);
      setRatePercent(editingRate.ratePercent);
      setValidFrom(editingRate.validFrom);
      setIsActive(editingRate.isActive);
    } else {
      setCode('');
      setName('');
      setRatePercent('17.00');
      setValidFrom('2026-01-01');
      setIsActive(true);
    }
  }, [dialogOpen, editingRate]);

  const handleSave = () => {
    if (!code.trim() || !name.trim()) return;
    const payload: VatRate = {
      id: editingRate?.id ?? generateUuidV7(),
      companyId: activeCompanyId,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      ratePercent: round2(ratePercent),
      validFrom: validFrom || '2026-01-01',
      isActive,
    };
    upsertVatRate(payload);
    showToast({ title: t('messages.recordSaved'), variant: 'success' });
    setDialogOpen(false);
  };

  const columns = useMemo<ColumnDef<VatRate>[]>(
    () => [
      {
        accessorKey: 'code',
        header: t('common.code'),
        cell: ({ row }) => (
          <Badge variant="default" className="font-mono font-bold">
            {row.original.code}
          </Badge>
        ),
      },
      {
        accessorKey: 'name',
        header: t('common.name'),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: 'ratePercent',
        header: t('common.vat'),
        cell: ({ row }) => (
          <div className="text-right font-mono font-semibold">
            {formatMoney2(row.original.ratePercent)}%
          </div>
        ),
      },
      {
        accessorKey: 'validFrom',
        header: t('common.date'),
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground">
            {formatDateBs(row.original.validFrom)}
          </span>
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
        id: 'actions',
        header: t('common.actions'),
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setEditingRate(row.original);
                setDialogOpen(true);
              }}
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span>{t('common.edit')}</span>
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title={t('nav.vatRates')}
        breadcrumbs={[
          { label: t('nav.groupMasterData') },
          { label: t('nav.vatRates') },
        ]}
        primaryAction={
          <Button
            variant="primary"
            onClick={() => {
              setEditingRate(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            <span>{t('common.create')}</span>
          </Button>
        }
      />

      <div className="p-6">
        <DataTable
          data={companyRates}
          columns={columns}
          exportFileName="poreske-stope"
          onRowClick={(row) => {
            setEditingRate(row);
            setDialogOpen(true);
          }}
        />
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        size="sm"
        title={editingRate ? `${t('common.edit')} — ${editingRate.name}` : t('common.create')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleSave}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('common.code')}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="font-mono"
            />
            <Input
              label={t('common.vat')}
              required
              value={ratePercent}
              onChange={(e) => setRatePercent(e.target.value)}
              className="font-mono text-right"
            />
          </div>
          <Input
            label={t('common.name')}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label={t('common.date')}
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            className="font-mono"
          />
          <label className="flex items-center gap-2 text-xs font-medium text-foreground pt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-input"
            />
            <span>{t('common.active')}</span>
          </label>
        </div>
      </Dialog>
    </div>
  );
}

export default VatRatesPage;
