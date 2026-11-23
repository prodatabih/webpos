import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { t } from '../../i18n';
import { round2 } from '../../lib/money';
import { generateUuidV7 } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';
import type { Partner, PartnerType } from '../../types/domain';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { NumericInput } from '../../components/ui/NumericInput';
import { showToast } from '../../components/ui/Toast';

const partnerSchema = z.object({
  code: z.string().trim().min(1, t('common.requiredField')),
  name: z.string().trim().min(2, 'Naziv mora imati najmanje 2 karaktera.'),
  partnerType: z.enum(['SUPPLIER', 'BUYER', 'BOTH']),
  taxIdNumber: z
    .string()
    .trim()
    .refine((val) => val === '' || /^\d{13}$/.test(val), 'JIB mora imati 13 cifara'),
  vatIdNumber: z
    .string()
    .trim()
    .refine((val) => val === '' || /^\d{12}$/.test(val), 'PDV broj mora imati 12 cifara'),
  address: z.string(),
  city: z.string(),
  phone: z.string(),
  email: z.string(),
  paymentTermsDays: z.coerce.number().int().min(0, 'Min 0 dana').max(365, 'Maks 365 dana'),
  creditLimit: z.string().trim().min(1, t('common.requiredField')),
  discountPercent: z.string(),
  isActive: z.boolean(),
});

type PartnerFormValues = z.infer<typeof partnerSchema>;

export interface PartnerFormDialogProps {
  open: boolean;
  onClose: () => void;
  editingPartner?: Partner | null;
}

export function PartnerFormDialog({
  open,
  onClose,
  editingPartner,
}: PartnerFormDialogProps) {
  const { activeCompanyId, partners, upsertPartner } = useAppStore();
  const [saving, setSaving] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerSchema),
    defaultValues: {
      code: '',
      name: '',
      partnerType: 'SUPPLIER',
      taxIdNumber: '',
      vatIdNumber: '',
      address: '',
      city: 'Sarajevo',
      phone: '',
      email: '',
      paymentTermsDays: 30,
      creditLimit: '10000.00',
      discountPercent: '0.00',
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editingPartner) {
      reset({
        code: editingPartner.code,
        name: editingPartner.name,
        partnerType: editingPartner.partnerType,
        taxIdNumber: editingPartner.taxIdNumber ?? '',
        vatIdNumber: editingPartner.vatIdNumber ?? '',
        address: editingPartner.address ?? '',
        city: editingPartner.city ?? '',
        phone: editingPartner.phone ?? '',
        email: editingPartner.email ?? '',
        paymentTermsDays: editingPartner.paymentTermsDays,
        creditLimit: editingPartner.creditLimit ?? '0.00',
        discountPercent: editingPartner.discountPercent ?? '0.00',
        isActive: editingPartner.isActive,
      });
    } else {
      reset({
        code: `PART-${String(partners.length + 1).padStart(3, '0')}`,
        name: '',
        partnerType: 'SUPPLIER',
        taxIdNumber: '',
        vatIdNumber: '',
        address: '',
        city: 'Sarajevo',
        phone: '',
        email: '',
        paymentTermsDays: 30,
        creditLimit: '10000.00',
        discountPercent: '0.00',
        isActive: true,
      });
    }
  }, [open, editingPartner, partners.length, reset]);

  const onSubmit = async (values: PartnerFormValues) => {
    if (saving) return;
    setSaving(true);
    try {
      const normalizedCredit = values.creditLimit.trim().replace(',', '.');
      const normalizedDiscount = (values.discountPercent || '0').trim().replace(',', '.');
      const payload: Partner = {
        id: editingPartner?.id ?? generateUuidV7(),
        companyId: editingPartner?.companyId ?? activeCompanyId,
        code: values.code.trim(),
        name: values.name.trim(),
        partnerType: values.partnerType as PartnerType,
        taxIdNumber: values.taxIdNumber.trim(),
        vatIdNumber: values.vatIdNumber.trim(),
        address: values.address.trim(),
        city: values.city.trim(),
        phone: values.phone.trim(),
        email: values.email.trim(),
        paymentTermsDays: values.paymentTermsDays,
        creditLimit: round2(normalizedCredit),
        discountPercent: round2(normalizedDiscount || '0'),
        isActive: values.isActive,
      };
      const res = await upsertPartner(payload);
      if (!res.ok) {
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
      onClose={() => {
        if (!saving) onClose();
      }}
      size="lg"
      title={editingPartner ? `${t('common.edit')} — ${editingPartner.name}` : t('common.create')}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSubmit(onSubmit)} isLoading={saving}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Input
          label={t('common.code')}
          required
          error={errors.code?.message}
          className="font-mono"
          {...register('code')}
        />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-foreground">{t('master.partnerType')}</label>
          <select
            {...register('partnerType')}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground"
          >
            <option value="SUPPLIER">{t('master.partnerSupplier')}</option>
            <option value="BUYER">{t('master.partnerBuyer')}</option>
            <option value="BOTH">{t('master.partnerBoth')}</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <Input
            label={t('common.name')}
            required
            error={errors.name?.message}
            {...register('name')}
          />
        </div>

        <Input
          label={t('master.taxIdNumber')}
          maxLength={13}
          placeholder="13 cifara (opcionalno za fizička/strana lica)"
          error={errors.taxIdNumber?.message}
          className="font-mono"
          {...register('taxIdNumber')}
        />
        <Input
          label={t('master.vatIdNumber')}
          maxLength={12}
          placeholder="12 cifara (opcionalno)"
          error={errors.vatIdNumber?.message}
          className="font-mono"
          {...register('vatIdNumber')}
        />

        <Input
          label={t('master.address')}
          error={errors.address?.message}
          {...register('address')}
        />
        <Input
          label={t('master.city')}
          error={errors.city?.message}
          {...register('city')}
        />

        <Input label={t('master.phone')} {...register('phone')} />
        <Input label={t('master.email')} {...register('email')} />

        <Input
          label={t('master.paymentTermsDays')}
          type="number"
          error={errors.paymentTermsDays?.message}
          className="font-mono text-right"
          {...register('paymentTermsDays')}
        />
        <Controller
          name="creditLimit"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-1 w-full">
              <label className="text-xs font-medium text-foreground">
                {t('master.creditLimit')}
              </label>
              <NumericInput
                ref={field.ref}
                name={field.name}
                decimals={2}
                min={0}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                className={`h-9 font-mono text-right ${
                  errors.creditLimit ? 'border-destructive focus-visible:ring-destructive' : ''
                }`}
              />
              {errors.creditLimit?.message && (
                <p className="text-xs text-destructive font-medium">
                  {errors.creditLimit.message}
                </p>
              )}
            </div>
          )}
        />

        <Controller
          name="discountPercent"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-1 w-full">
              <label className="text-xs font-medium text-foreground">
                {t('pos.discountPercent')}
              </label>
              <NumericInput
                ref={field.ref}
                name={field.name}
                decimals={2}
                min={0}
                max={100}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                className="h-9 font-mono text-right"
              />
            </div>
          )}
        />
        <label className="flex items-center gap-2 text-xs font-medium text-foreground pt-5 cursor-pointer">
          <input type="checkbox" {...register('isActive')} className="rounded border-input" />
          <span>{t('common.active')}</span>
        </label>
      </form>
    </Dialog>
  );
}
