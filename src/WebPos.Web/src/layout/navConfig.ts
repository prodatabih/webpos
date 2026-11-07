import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ShoppingCart,
  ReceiptText,
  FilePlus2,
  TrendingUp,
  ArrowLeftRight,
  ClipboardCheck,
  FileStack,
  BookOpen,
  Package,
  Users,
  Building2,
  CalendarRange,
  Percent,
  Tags,
  ShieldCheck,
} from 'lucide-react';
import type { TranslationKey } from '../i18n';

export interface NavItemConfig {
  id: string;
  path: string;
  labelKey: TranslationKey;
  groupKey: TranslationKey;
  icon: LucideIcon;
  shortcut?: string;
}

export const NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'dashboard',
    path: '/',
    labelKey: 'nav.dashboard',
    groupKey: 'nav.groupPos',
    icon: LayoutDashboard,
  },
  {
    id: 'pos-register',
    path: '/pos',
    labelKey: 'nav.posRegister',
    groupKey: 'nav.groupPos',
    icon: ShoppingCart,
    shortcut: 'F1',
  },
  {
    id: 'pos-receipts',
    path: '/pos/receipts',
    labelKey: 'nav.posReceipts',
    groupKey: 'nav.groupPos',
    icon: ReceiptText,
  },
  {
    id: 'calculations',
    path: '/warehouse/calculations',
    labelKey: 'nav.calculations',
    groupKey: 'nav.groupWarehouse',
    icon: FilePlus2,
  },
  {
    id: 'price-leveling',
    path: '/warehouse/price-leveling',
    labelKey: 'nav.priceLeveling',
    groupKey: 'nav.groupWarehouse',
    icon: TrendingUp,
  },
  {
    id: 'transfers',
    path: '/warehouse/transfers',
    labelKey: 'nav.transfers',
    groupKey: 'nav.groupWarehouse',
    icon: ArrowLeftRight,
  },
  {
    id: 'inventory-count',
    path: '/warehouse/inventory-count',
    labelKey: 'nav.inventoryCount',
    groupKey: 'nav.groupWarehouse',
    icon: ClipboardCheck,
  },
  {
    id: 'other-warehouse-docs',
    path: '/warehouse/other-documents',
    labelKey: 'nav.otherWarehouseDocs',
    groupKey: 'nav.groupWarehouse',
    icon: FileStack,
  },
  {
    id: 'items',
    path: '/master/items',
    labelKey: 'nav.items',
    groupKey: 'nav.groupMasterData',
    icon: Package,
  },
  {
    id: 'partners',
    path: '/master/partners',
    labelKey: 'nav.partners',
    groupKey: 'nav.groupMasterData',
    icon: Users,
  },
  {
    id: 'organizations',
    path: '/master/organizations',
    labelKey: 'nav.organizations',
    groupKey: 'nav.groupMasterData',
    icon: Building2,
  },
  {
    id: 'fiscal-periods',
    path: '/master/fiscal-periods',
    labelKey: 'nav.fiscalPeriods',
    groupKey: 'nav.groupMasterData',
    icon: CalendarRange,
  },
  {
    id: 'vat-rates',
    path: '/master/vat-rates',
    labelKey: 'nav.vatRates',
    groupKey: 'nav.groupMasterData',
    icon: Percent,
  },
  {
    id: 'labels',
    path: '/master/labels',
    labelKey: 'nav.labelCenter',
    groupKey: 'nav.groupMasterData',
    icon: Tags,
  },
  {
    id: 'kep-ledger',
    path: '/reports/kep-ledger',
    labelKey: 'nav.kepLedger',
    groupKey: 'nav.groupReports',
    icon: BookOpen,
  },
  {
    id: 'audit-log',
    path: '/reports/audit-log',
    labelKey: 'nav.auditLog',
    groupKey: 'nav.groupReports',
    icon: ShieldCheck,
  },
];

export const NAV_GROUPS: TranslationKey[] = [
  'nav.groupPos',
  'nav.groupWarehouse',
  'nav.groupMasterData',
  'nav.groupReports',
];
