import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import { generateUuidV7 } from '../../lib/utils';
import type { Company, PosTerminal, StoreLocation, StoreType } from '../../types/domain';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { showToast } from '../../components/ui/Toast';
import type { ActionResult } from '../../store/storeTypes';

export function CompanyFormDialog({
  open,
  onClose,
  editingCompany,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  editingCompany?: Company | null;
  onSave: (company: Company) => Promise<ActionResult> | ActionResult | void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [taxIdNumber, setTaxIdNumber] = useState('');
  const [vatIdNumber, setVatIdNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Sarajevo');
  const [bankAccount, setBankAccount] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ code?: string; name?: string }>({});

  useEffect(() => {
    if (!open) return;
    setCode(editingCompany?.code ?? '');
    setName(editingCompany?.name ?? '');
    setTaxIdNumber(editingCompany?.taxIdNumber ?? '');
    setVatIdNumber(editingCompany?.vatIdNumber ?? '');
    setAddress(editingCompany?.address ?? '');
    setCity(editingCompany?.city ?? 'Sarajevo');
    setBankAccount(editingCompany?.bankAccount ?? '');
    setFieldErrors({});
  }, [open, editingCompany]);

  const handleSubmit = async () => {
    if (saving) return;
    const nextErrors: { code?: string; name?: string } = {};
    if (!code.trim()) nextErrors.code = t('common.requiredField');
    if (!name.trim()) nextErrors.name = t('common.requiredField');
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const res = await onSave({
        id: editingCompany?.id ?? generateUuidV7(),
        code: code.trim(),
        name: name.trim(),
        taxIdNumber: taxIdNumber.trim(),
        vatIdNumber: vatIdNumber.trim(),
        address: address.trim(),
        city: city.trim(),
        currencyCode: editingCompany?.currencyCode || 'BAM',
        bankAccount: bankAccount.trim(),
      });
      if (res && !res.ok) {
        showToast({ title: t('common.errorTitle'), description: res.error, variant: 'error' });
        return;
      }
      showToast({ title: t('messages.recordSaved'), variant: 'success' });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title={editingCompany ? `${t('common.edit')} — ${editingCompany.name}` : t('common.create')}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={() => void handleSubmit()} isLoading={saving}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        <Input label={t('master.taxIdNumber')} value={taxIdNumber} onChange={(e) => setTaxIdNumber(e.target.value)} className="font-mono" />
        <Input label={t('master.vatIdNumber')} value={vatIdNumber} onChange={(e) => setVatIdNumber(e.target.value)} className="font-mono" />
        <Input label={t('master.address')} value={address} onChange={(e) => setAddress(e.target.value)} />
        <Input label={t('master.city')} value={city} onChange={(e) => setCity(e.target.value)} />
        <div className="sm:col-span-2">
          <Input
            label="Žiro račun"
            value={bankAccount}
            onChange={(e) => setBankAccount(e.target.value)}
            placeholder="npr. 1610000012345678"
            className="font-mono"
          />
        </div>
      </div>
    </Dialog>
  );
}

export function StoreFormDialog({
  open,
  onClose,
  companyId,
  editingStore,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  companyId: string;
  editingStore?: StoreLocation | null;
  onSave: (store: StoreLocation) => Promise<ActionResult> | ActionResult | void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [storeType, setStoreType] = useState<StoreType>('RETAIL');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Sarajevo');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ code?: string; name?: string; general?: string }>({});

  useEffect(() => {
    if (!open) return;
    setCode(editingStore?.code ?? '');
    setName(editingStore?.name ?? '');
    setStoreType(editingStore?.storeType ?? 'RETAIL');
    setAddress(editingStore?.address ?? '');
    setCity(editingStore?.city ?? 'Sarajevo');
    setIsActive(editingStore?.isActive ?? true);
    setFieldErrors({});
  }, [open, editingStore]);

  const handleSubmit = async () => {
    if (saving) return;
    if (!companyId) {
      const msg = 'Prvo kreirajte preduzeće.';
      setFieldErrors({ general: msg });
      showToast({ title: msg, variant: 'error' });
      return;
    }
    const nextErrors: { code?: string; name?: string } = {};
    if (!code.trim()) nextErrors.code = t('common.requiredField');
    if (!name.trim()) nextErrors.name = t('common.requiredField');
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const res = await onSave({
        id: editingStore?.id ?? generateUuidV7(),
        companyId,
        code: code.trim(),
        name: name.trim(),
        storeType,
        address: address.trim(),
        city: city.trim(),
        isActive,
      });
      if (res && !res.ok) {
        showToast({ title: t('common.errorTitle'), description: res.error, variant: 'error' });
        return;
      }
      showToast({ title: t('messages.recordSaved'), variant: 'success' });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title={editingStore ? `${t('common.edit')} — ${editingStore.name}` : t('common.create')}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={() => void handleSubmit()} isLoading={saving}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="space-y-3">
        {fieldErrors.general && (
          <p className="text-xs font-medium text-destructive">{fieldErrors.general}</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-foreground">{t('app.storeLocation')}</label>
            <select value={storeType} onChange={(e) => setStoreType(e.target.value as StoreType)} className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground">
              <option value="RETAIL">{t('master.storeTypeRetail')}</option>
              <option value="WHOLESALE">{t('master.storeTypeWholesale')}</option>
              <option value="RAW_MATERIAL">{t('master.storeTypeRawMaterial')}</option>
              <option value="PRODUCTION">{t('master.storeTypeProduction')}</option>
            </select>
          </div>
          <div className="sm:col-span-2">
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
          </div>
          <Input label={t('master.address')} value={address} onChange={(e) => setAddress(e.target.value)} />
          <Input label={t('master.city')} value={city} onChange={(e) => setCity(e.target.value)} />
          <label className="flex items-center gap-2 text-xs font-medium text-foreground pt-2 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-input" />
            <span>{t('common.active')}</span>
          </label>
        </div>
      </div>
    </Dialog>
  );
}

export function TerminalFormDialog({
  open,
  onClose,
  stores,
  defaultStoreId,
  editingTerminal,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  stores: StoreLocation[];
  defaultStoreId: string;
  editingTerminal?: PosTerminal | null;
  onSave: (term: PosTerminal) => Promise<ActionResult> | ActionResult | void;
}) {
  const [storeId, setStoreId] = useState(defaultStoreId);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [fiscalPrefix, setFiscalPrefix] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    storeId?: string;
    code?: string;
    name?: string;
    fiscalPrefix?: string;
  }>({});

  useEffect(() => {
    if (!open) return;
    setStoreId(editingTerminal?.storeId || defaultStoreId || stores[0]?.id || '');
    setCode(editingTerminal?.code ?? '');
    setName(editingTerminal?.name ?? '');
    setFiscalPrefix(editingTerminal?.fiscalPrefix ?? '');
    setIsActive(editingTerminal?.isActive ?? true);
    setFieldErrors({});
  }, [open, editingTerminal, defaultStoreId, stores]);

  const handleSubmit = async () => {
    if (saving) return;
    const resolvedStoreId = storeId || stores[0]?.id || '';
    const nextErrors: {
      storeId?: string;
      code?: string;
      name?: string;
      fiscalPrefix?: string;
    } = {};
    if (!resolvedStoreId) {
      nextErrors.storeId = 'Prvo kreirajte poslovnu jedinicu (objekat).';
    }
    if (!code.trim()) nextErrors.code = t('common.requiredField');
    if (!name.trim()) nextErrors.name = t('common.requiredField');
    if (!fiscalPrefix.trim()) nextErrors.fiscalPrefix = t('common.requiredField');

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      if (nextErrors.storeId) {
        showToast({ title: nextErrors.storeId, variant: 'error' });
      }
      return;
    }

    setFieldErrors({});
    setSaving(true);
    try {
      const res = await onSave({
        id: editingTerminal?.id ?? generateUuidV7(),
        storeId: resolvedStoreId,
        code: code.trim(),
        name: name.trim(),
        fiscalPrefix: fiscalPrefix.trim(),
        lastSequenceNumber: editingTerminal?.lastSequenceNumber ?? 0,
        isOnline: editingTerminal?.isOnline ?? true,
        isActive,
      });
      if (res && !res.ok) {
        showToast({ title: t('common.errorTitle'), description: res.error, variant: 'error' });
        return;
      }
      showToast({ title: t('messages.recordSaved'), variant: 'success' });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title={editingTerminal ? `${t('common.edit')} — ${editingTerminal.name}` : t('common.create')}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={() => void handleSubmit()} isLoading={saving}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-xs font-medium text-foreground">{t('app.storeLocation')}</label>
          <select
            value={storeId}
            onChange={(e) => {
              setStoreId(e.target.value);
              if (fieldErrors.storeId) setFieldErrors((prev) => ({ ...prev, storeId: undefined }));
            }}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground"
          >
            {stores.length === 0 && <option value="">-- Odaberi poslovnicu --</option>}
            {stores.map((s) => (<option key={s.id} value={s.id}>{s.code} — {s.name}</option>))}
          </select>
          {fieldErrors.storeId && (
            <p className="text-xs text-destructive font-medium">{fieldErrors.storeId}</p>
          )}
        </div>
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
        <Input
          label={t('master.fiscalNumberPrefix')}
          required
          value={fiscalPrefix}
          error={fieldErrors.fiscalPrefix}
          onChange={(e) => {
            setFiscalPrefix(e.target.value);
            if (fieldErrors.fiscalPrefix) setFieldErrors((prev) => ({ ...prev, fiscalPrefix: undefined }));
          }}
          className="font-mono"
        />
        <div className="sm:col-span-2">
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
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-foreground pt-2 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-input" />
          <span>{t('common.active')}</span>
        </label>
      </div>
    </Dialog>
  );
}
