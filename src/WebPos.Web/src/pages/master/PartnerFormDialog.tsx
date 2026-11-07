import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
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
import { showToast } from '../../components/ui/Toast';

const partnerSchema = z.object({
  code: z.string().min(1, t('common.requiredField')),
  name: z.string().min(2, t('common.requiredField')),
  partnerType: z.enum(['SUPPLIER', 'BUYER', 'BOTH']),
  taxIdNumber: z.string().regex(/^\d{13}$/, t('common.requiredField')),
  vatIdNumber: z.string().regex(/^(\d{12}|)$/, t('common.requiredField')),
  address: z.string().min(1, t('common.requiredField')),
  city: z.string().min(1, t('common.requiredField')),
  phone: z.string(),
  email: z.string(),
  paymentTermsDays: z.coerce.number().int().min(0).max(365),
  creditLimit: z.string().min(1, t('common.requiredField')),
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

  const {
    register,
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
        taxIdNumber: editingPartner.taxIdNumber,
        vatIdNumber: editingPartner.vatIdNumber,
        address: editingPartner.address,
        city: editingPartner.city,
        phone: editingPartner.phone,
        email: editingPartner.email,
        paymentTermsDays: editingPartner.paymentTermsDays,
        creditLimit: editingPartner.creditLimit,
        discountPercent: '0.00',
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

  const onSubmit = (values: PartnerFormValues) => {
    const payload: Partner = {
      id: editingPartner?.id ?? generateUuidV7(),
      companyId: activeCompanyId,
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
      creditLimit: round2(values.creditLimit),
      isActive: values.isActive,
    };
    upsertPartner(payload);
    showToast({ title: t('messages.recordSaved'), variant: 'success' });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={editingPartner ? `${t('common.edit')} — ${editingPartner.name}` : t('common.create')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSubmit(onSubmit)}>
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
          required
          maxLength={13}
          error={errors.taxIdNumber?.message}
          className="font-mono"
          {...register('taxIdNumber')}
        />
        <Input
          label={t('master.vatIdNumber')}
          maxLength={12}
          error={errors.vatIdNumber?.message}
          className="font-mono"
          {...register('vatIdNumber')}
        />

        <Input
          label={t('master.address')}
          required
          error={errors.address?.message}
          {...register('address')}
        />
        <Input
          label={t('master.city')}
          required
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
        <Input
          label={t('master.creditLimit')}
          error={errors.creditLimit?.message}
          className="font-mono text-right"
          {...register('creditLimit')}
        />

        <Input
          label={t('pos.discountPercent')}
          className="font-mono text-right"
          {...register('discountPercent')}
        />
        <label className="flex items-center gap-2 text-xs font-medium text-foreground pt-5 cursor-pointer">
          <input type="checkbox" {...register('isActive')} className="rounded border-input" />
          <span>{t('common.active')}</span>
        </label>
      </form>
    </Dialog>
  );
}
