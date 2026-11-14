import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import { generateUuidV7 } from '../../lib/utils';
import type { Company, PosTerminal, StoreLocation, StoreType } from '../../types/domain';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { showToast } from '../../components/ui/Toast';

export function CompanyFormDialog({
  open,
  onClose,
  editingCompany,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  editingCompany?: Company | null;
  onSave: (company: Company) => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [taxIdNumber, setTaxIdNumber] = useState('');
  const [vatIdNumber, setVatIdNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Sarajevo');
  const [bankAccount, setBankAccount] = useState('');

  useEffect(() => {
    if (!open) return;
    setCode(editingCompany?.code ?? '');
    setName(editingCompany?.name ?? '');
    setTaxIdNumber(editingCompany?.taxIdNumber ?? '');
    setVatIdNumber(editingCompany?.vatIdNumber ?? '');
    setAddress(editingCompany?.address ?? '');
    setCity(editingCompany?.city ?? 'Sarajevo');
    setBankAccount(editingCompany?.bankAccount ?? '');
  }, [open, editingCompany]);

  const handleSubmit = () => {
    if (!code.trim() || !name.trim()) return;
    onSave({
      id: editingCompany?.id ?? generateUuidV7(),
      code: code.trim(),
      name: name.trim(),
      taxIdNumber: taxIdNumber.trim(),
      vatIdNumber: vatIdNumber.trim(),
      address: address.trim(),
      city: city.trim(),
      currencyCode: 'BAM',
      bankAccount: bankAccount.trim(),
    });
    showToast({ title: t('messages.recordSaved'), variant: 'success' });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title={editingCompany ? `${t('common.edit')} — ${editingCompany.name}` : t('common.create')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={handleSubmit}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label={t('common.code')} required value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" />
        <Input label={t('common.name')} required value={name} onChange={(e) => setName(e.target.value)} />
        <Input label={t('master.taxIdNumber')} value={taxIdNumber} onChange={(e) => setTaxIdNumber(e.target.value)} className="font-mono" />
        <Input label={t('master.vatIdNumber')} value={vatIdNumber} onChange={(e) => setVatIdNumber(e.target.value)} className="font-mono" />
        <Input label={t('master.address')} value={address} onChange={(e) => setAddress(e.target.value)} />
        <Input label={t('master.city')} value={city} onChange={(e) => setCity(e.target.value)} />
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
  onSave: (store: StoreLocation) => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [storeType, setStoreType] = useState<StoreType>('RETAIL');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Sarajevo');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setCode(editingStore?.code ?? '');
    setName(editingStore?.name ?? '');
    setStoreType(editingStore?.storeType ?? 'RETAIL');
    setAddress(editingStore?.address ?? '');
    setCity(editingStore?.city ?? 'Sarajevo');
    setIsActive(editingStore?.isActive ?? true);
  }, [open, editingStore]);

  const handleSubmit = () => {
    if (!code.trim() || !name.trim()) return;
    onSave({
      id: editingStore?.id ?? generateUuidV7(),
      companyId,
      code: code.trim(),
      name: name.trim(),
      storeType,
      address: address.trim(),
      city: city.trim(),
      isActive,
    });
    showToast({ title: t('messages.recordSaved'), variant: 'success' });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title={editingStore ? `${t('common.edit')} — ${editingStore.name}` : t('common.create')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={handleSubmit}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label={t('common.code')} required value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" />
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
          <Input label={t('common.name')} required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Input label={t('master.address')} value={address} onChange={(e) => setAddress(e.target.value)} />
        <Input label={t('master.city')} value={city} onChange={(e) => setCity(e.target.value)} />
        <label className="flex items-center gap-2 text-xs font-medium text-foreground pt-2 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-input" />
          <span>{t('common.active')}</span>
        </label>
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
  onSave: (term: PosTerminal) => void;
}) {
  const [storeId, setStoreId] = useState(defaultStoreId);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [fiscalPrefix, setFiscalPrefix] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setStoreId(editingTerminal?.storeId || defaultStoreId || stores[0]?.id || '');
    setCode(editingTerminal?.code ?? '');
    setName(editingTerminal?.name ?? '');
    setFiscalPrefix(editingTerminal?.fiscalPrefix ?? '');
    setIsActive(editingTerminal?.isActive ?? true);
  }, [open, editingTerminal, defaultStoreId, stores]);

  const handleSubmit = () => {
    const resolvedStoreId = storeId || stores[0]?.id || '';
    if (!resolvedStoreId) {
      showToast({ title: 'Prvo kreirajte poslovnu jedinicu (objekat).', variant: 'error' });
      return;
    }
    if (!code.trim() || !name.trim() || !fiscalPrefix.trim()) return;
    onSave({
      id: editingTerminal?.id ?? generateUuidV7(),
      storeId: resolvedStoreId,
      code: code.trim(),
      name: name.trim(),
      fiscalPrefix: fiscalPrefix.trim(),
      lastSequenceNumber: editingTerminal?.lastSequenceNumber ?? 0,
      isOnline: editingTerminal?.isOnline ?? true,
      isActive,
    });
    showToast({ title: t('messages.recordSaved'), variant: 'success' });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title={editingTerminal ? `${t('common.edit')} — ${editingTerminal.name}` : t('common.create')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={handleSubmit}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-xs font-medium text-foreground">{t('app.storeLocation')}</label>
          <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground">
            {stores.length === 0 && <option value="">-- Odaberi poslovnicu --</option>}
            {stores.map((s) => (<option key={s.id} value={s.id}>{s.code} — {s.name}</option>))}
          </select>
        </div>
        <Input label={t('common.code')} required value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" />
        <Input label={t('master.fiscalNumberPrefix')} required value={fiscalPrefix} onChange={(e) => setFiscalPrefix(e.target.value)} className="font-mono" />
        <div className="sm:col-span-2">
          <Input label={t('common.name')} required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-foreground pt-2 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-input" />
          <span>{t('common.active')}</span>
        </label>
      </div>
    </Dialog>
  );
}
