import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { t } from '../../i18n';
import { formatMoney2, round2 } from '../../lib/money';
import { formatDateBs, generateUuidV7 } from '../../lib/utils';
import { useListNewShortcut } from '../../lib/keyboardGridUtils';
import { useAppStore } from '../../store/useAppStore';
import type { VatRate } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Dialog } from '../../components/ui/Dialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { NumericInput } from '../../components/ui/NumericInput';
import { Badge } from '../../components/ui/Badge';
import { showToast } from '../../components/ui/Toast';

export function VatRatesPage() {
  const { activeCompanyId, vatRates, upsertVatRate, deleteVatRate } = useAppStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<VatRate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VatRate | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [ratePercent, setRatePercent] = useState('17.00');
  const [validFrom, setValidFrom] = useState('2026-01-01');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    code?: string;
    name?: string;
    ratePercent?: string;
  }>({});

  const companyRates = useMemo(
    () => vatRates.filter((vr) => !vr.companyId || !activeCompanyId || vr.companyId === activeCompanyId),
    [vatRates, activeCompanyId]
  );

  const handleCreateNew = () => {
    setEditingRate(null);
    setDialogOpen(true);
  };

  useListNewShortcut(handleCreateNew, !dialogOpen && !deleteTarget);

  useEffect(() => {
    if (!dialogOpen) return;
    setFieldErrors({});
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

  const handleSave = async () => {
    if (saving) return;
    const normalizedRate = ratePercent.trim().replace(',', '.');
    const parsedRate = Number(normalizedRate);

    const nextErrors: { code?: string; name?: string; ratePercent?: string } = {};
    if (!code.trim()) nextErrors.code = t('common.requiredField');
    if (!name.trim()) nextErrors.name = t('common.requiredField');
    if (!normalizedRate || !Number.isFinite(parsedRate) || parsedRate < 0 || parsedRate > 100) {
      nextErrors.ratePercent = 'Unesite ispravnu PDV stopu (0 – 100).';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    setSaving(true);
    try {
      const payload: VatRate = {
        id: editingRate?.id ?? generateUuidV7(),
        companyId: editingRate?.companyId ?? activeCompanyId,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        ratePercent: round2(normalizedRate),
        validFrom: validFrom || '2026-01-01',
        isActive,
      };
      const res = await upsertVatRate(payload);
      if (!res.ok) {
        showToast({ title: t('common.errorTitle'), description: res.error, variant: 'error' });
        return;
      }
      showToast({ title: t('messages.recordSaved'), variant: 'success' });
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await deleteVatRate(deleteTarget.id);
    if (!res.ok) {
      showToast({ title: t('common.errorTitle'), description: res.error, variant: 'error' });
      setDeleteTarget(null);
      return;
    }
    showToast({ title: 'PDV stopa je uspješno obrisana.', variant: 'success' });
    setDeleteTarget(null);
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
          <div className="flex items-center justify-end gap-1">
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
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(row.original);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{t('common.delete')}</span>
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
          <Button variant="primary" onClick={handleCreateNew}>
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
        onClose={() => {
          if (!saving) setDialogOpen(false);
        }}
        size="sm"
        title={editingRate ? `${t('common.edit')} — ${editingRate.name}` : t('common.create')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} isLoading={saving}>
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
              error={fieldErrors.code}
              onChange={(e) => {
                setCode(e.target.value);
                if (fieldErrors.code) setFieldErrors((prev) => ({ ...prev, code: undefined }));
              }}
              className="font-mono"
            />
            <div className="flex flex-col gap-1 w-full">
              <label className="text-xs font-medium text-foreground flex items-center gap-1">
                <span>{t('common.vat')}</span>
                <span className="text-destructive">*</span>
              </label>
              <NumericInput
                decimals={2}
                min={0}
                max={100}
                required
                value={ratePercent}
                onChange={(val) => {
                  setRatePercent(val);
                  if (fieldErrors.ratePercent) {
                    setFieldErrors((prev) => ({ ...prev, ratePercent: undefined }));
                  }
                }}
                className={`h-9 font-mono text-right ${
                  fieldErrors.ratePercent ? 'border-destructive focus-visible:ring-destructive' : ''
                }`}
              />
              {fieldErrors.ratePercent && (
                <p className="text-xs text-destructive font-medium">{fieldErrors.ratePercent}</p>
              )}
            </div>
          </div>
          <Input
            label={t('common.name')}
            required
            value={name}
            error={fieldErrors.name}
            onChange={(e) => {
              setName(e.target.value);
              if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
            }}
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        variant="destructive"
        title={deleteTarget ? `Obrisati PDV stopu "${deleteTarget.code} — ${deleteTarget.name}"?` : ''}
        description="Brisanje poreske stope je nepovratno i moguće je samo ako stopa nije dodijeljena artiklima."
        confirmLabel={t('common.delete')}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

export default VatRatesPage;
