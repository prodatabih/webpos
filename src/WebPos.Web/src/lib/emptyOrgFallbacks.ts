import type { Company, StoreLocation } from '../types/domain';

export const EMPTY_COMPANY_FALLBACK: Company = {
  id: '',
  code: '',
  name: '',
  taxIdNumber: '',
  vatIdNumber: '',
  address: '',
  city: '',
  currencyCode: 'BAM',
  bankAccount: '',
};

export const EMPTY_STORE_FALLBACK: StoreLocation = {
  id: '',
  companyId: '',
  code: '',
  name: '',
  storeType: 'RETAIL',
  address: '',
  city: '',
  isActive: true,
};
