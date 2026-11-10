import type { ColumnDef } from '@tanstack/react-table';
import { Eye, CheckCircle2, RotateCcw } from 'lucide-react';
import { t } from '../../i18n';
import { formatMoney2 } from '../../lib/money';
import { formatDateBs } from '../../lib/utils';
import type { CalculationDocument, Partner, StoreType } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { DocumentStatusBadge } from '../../components/ui/Badge';

interface CalculationColumnsOptions {
  partners: Partner[];
  storeType: StoreType;
  onEdit: (doc: CalculationDocument) => void;
  onPost: (docId: string) => void;
  onReverse: (docId: string) => void;
}

export function getCalculationColumns({
  partners,
  storeType,
  onEdit,
  onPost,
  onReverse,
}: CalculationColumnsOptions): ColumnDef<CalculationDocument>[] {
  const isRaw = storeType === 'RAW_MATERIAL' || storeType === 'PRODUCTION';
  const isWholesale = storeType === 'WHOLESALE';

  return [
    {
      accessorKey: 'docNumber',
      header: t('warehouse.docNumber'),
      cell: ({ row }) => (
        <span className="font-mono font-semibold text-foreground">{row.original.docNumber}</span>
      ),
    },
    {
      accessorKey: 'docDate',
      header: t('warehouse.docDate'),
      cell: ({ row }) => formatDateBs(row.original.docDate),
    },
    {
      accessorKey: 'partnerId',
      header: t('warehouse.supplier'),
      cell: ({ row }) => partners.find((p) => p.id === row.original.partnerId)?.name ?? '-',
    },
    {
      accessorKey: 'supplierInvoiceNumber',
      header: t('warehouse.supplierInvoiceNumber'),
      cell: ({ row }) => <span className="font-mono">{row.original.supplierInvoiceNumber}</span>,
    },
    {
      accessorKey: 'totalPurchaseValue',
      header: isRaw ? t('warehouse.totalDebitRaw') : t('warehouse.purchaseValue'),
      cell: ({ row }) => (
        <span className="font-mono font-semibold">{formatMoney2(row.original.totalPurchaseValue, true)}</span>
      ),
    },
    ...(!isRaw
      ? [
          {
            accessorKey: 'totalMarginAmount',
            header: t('warehouse.marginAmount'),
            cell: ({ row }: { row: { original: CalculationDocument } }) => (
              <span className="font-mono">{formatMoney2(row.original.totalMarginAmount, true)}</span>
            ),
          } as ColumnDef<CalculationDocument>,
        ]
      : []),
    ...(isWholesale
      ? [
          {
            accessorKey: 'totalSellingValueExclVat',
            header: t('warehouse.wholesaleTotalValue'),
            cell: ({ row }: { row: { original: CalculationDocument } }) => (
              <span className="font-mono font-bold text-info">
                {formatMoney2(row.original.totalSellingValueExclVat, true)}
              </span>
            ),
          } as ColumnDef<CalculationDocument>,
        ]
      : []),
    ...(!isRaw && !isWholesale
      ? [
          {
            accessorKey: 'totalEmbeddedVatAmount',
            header: t('warehouse.embeddedVat'),
            cell: ({ row }: { row: { original: CalculationDocument } }) => (
              <span className="font-mono">
                {formatMoney2(row.original.totalEmbeddedVatAmount, true)}
              </span>
            ),
          } as ColumnDef<CalculationDocument>,
          {
            accessorKey: 'totalRetailValueWithVat',
            header: t('warehouse.retailValueWithVat'),
            cell: ({ row }: { row: { original: CalculationDocument } }) => (
              <span className="font-mono font-bold text-success">
                {formatMoney2(row.original.totalRetailValueWithVat, true)}
              </span>
            ),
          } as ColumnDef<CalculationDocument>,
        ]
      : []),
    {
      accessorKey: 'status',
      header: t('common.status'),
      cell: ({ row }) => <DocumentStatusBadge status={row.original.status} />,
    },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" onClick={() => onEdit(c)}>
              <Eye className="h-3.5 w-3.5" />
              <span>{c.status === 'DRAFT' ? t('common.edit') : t('common.view')}</span>
            </Button>
            {c.status === 'DRAFT' && (
              <Button variant="success" size="sm" onClick={() => onPost(c.id)}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{t('common.postDocument')}</span>
              </Button>
            )}
            {c.status === 'POSTED' && (
              <Button variant="destructive" size="sm" onClick={() => onReverse(c.id)}>
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{t('common.reverseDocument')}</span>
              </Button>
            )}
          </div>
        );
      },
    },
  ];
}
