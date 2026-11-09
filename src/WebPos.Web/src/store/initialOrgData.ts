import type {
  Company,
  FiscalPeriod,
  FiscalYear,
  Partner,
  PosTerminal,
  StoreLocation,
  VatRate,
} from '../types/domain';

export const initialCompanies: Company[] = [
  {
    id: 'comp-1',
    code: 'PRODATA-BA',
    name: 'BosnaTrgovina d.o.o. Sarajevo',
    taxIdNumber: '4200158960005',
    vatIdNumber: '200158960005',
    address: 'Zmaja od Bosne 74',
    city: 'Sarajevo',
    currencyCode: 'BAM',
    bankAccount: '1610000012345678',
  },
];

export const initialFiscalYears: FiscalYear[] = [
  {
    id: 'fy-2026',
    companyId: 'comp-1',
    year: 2026,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    isLocked: false,
  },
  {
    id: 'fy-2025',
    companyId: 'comp-1',
    year: 2025,
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    isLocked: true,
  },
];

export const initialFiscalPeriods: FiscalPeriod[] = [
  {
    id: 'fp-2026-10',
    fiscalYearId: 'fy-2026',
    companyId: 'comp-1',
    month: 10,
    name: '10/2026 - Oktobar',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    isLocked: true,
    lockedAt: '2026-11-02T09:00:00Z',
    lockedBy: 'tenant.admin',
  },
  {
    id: 'fp-2026-11',
    fiscalYearId: 'fy-2026',
    companyId: 'comp-1',
    month: 11,
    name: '11/2026 - Novembar',
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    isLocked: false,
  },
  {
    id: 'fp-2026-12',
    fiscalYearId: 'fy-2026',
    companyId: 'comp-1',
    month: 12,
    name: '12/2026 - Decembar',
    startDate: '2026-12-01',
    endDate: '2026-12-31',
    isLocked: false,
  },
];

export const initialStoreLocations: StoreLocation[] = [
  {
    id: 'store-1',
    companyId: 'comp-1',
    code: 'PJ-01',
    name: 'Supermarket Centar Sarajevo',
    storeType: 'RETAIL',
    address: 'Ferhadija 18',
    city: 'Sarajevo',
    isActive: true,
  },
  {
    id: 'store-2',
    companyId: 'comp-1',
    code: 'PJ-02',
    name: 'Market Novi Grad',
    storeType: 'RETAIL',
    address: 'Bulevar Meše Selimovića 42',
    city: 'Sarajevo',
    isActive: true,
  },
  {
    id: 'store-3',
    companyId: 'comp-1',
    code: 'VP-01',
    name: 'Centralno skladište Rajlovac',
    storeType: 'WHOLESALE',
    address: 'Rajlovačka cesta bb',
    city: 'Sarajevo',
    isActive: true,
  },
  {
    id: 'store-4',
    companyId: 'comp-1',
    code: 'MAT-01',
    name: 'Magacin sirovina i repromaterijala',
    storeType: 'RAW_MATERIAL',
    address: 'Rajlovačka cesta bb',
    city: 'Sarajevo',
    isActive: true,
  },
];

export const initialPosTerminals: PosTerminal[] = [
  {
    id: 'term-1',
    storeId: 'store-1',
    code: 'K1',
    name: 'Blagajna 1 - Glavni ulaz',
    fiscalPrefix: 'PJ01-K1-2026',
    lastSequenceNumber: 1004,
    isOnline: true,
    isActive: true,
  },
  {
    id: 'term-2',
    storeId: 'store-1',
    code: 'K2',
    name: 'Blagajna 2 - Brza kasa',
    fiscalPrefix: 'PJ01-K2-2026',
    lastSequenceNumber: 412,
    isOnline: true,
    isActive: true,
  },
  {
    id: 'term-3',
    storeId: 'store-2',
    code: 'K1',
    name: 'Blagajna 1 - Novi Grad',
    fiscalPrefix: 'PJ02-K1-2026',
    lastSequenceNumber: 620,
    isOnline: true,
    isActive: true,
  },
];

export const initialVatRates: VatRate[] = [
  {
    id: 'vat-e17',
    companyId: 'comp-1',
    code: 'E',
    name: 'Opšta stopa PDV 17%',
    ratePercent: '17.00',
    validFrom: '2006-01-01',
    isActive: true,
  },
  {
    id: 'vat-k0',
    companyId: 'comp-1',
    code: 'K',
    name: 'Nulta stopa / Izvoz 0%',
    ratePercent: '0.00',
    validFrom: '2006-01-01',
    isActive: true,
  },
];

import { seedCatalogPartners } from './seedCatalogPartners';

export const initialPartners: Partner[] = seedCatalogPartners;

