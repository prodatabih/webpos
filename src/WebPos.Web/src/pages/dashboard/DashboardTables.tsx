import { useNavigate } from 'react-router-dom';
import { t } from '../../i18n';
import { formatMoney2 } from '../../lib/money';
import { formatDateBs, formatDateTimeBs } from '../../lib/utils';
import type { DocumentStatus, PosReceipt } from '../../types/domain';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge, DocumentStatusBadge } from '../../components/ui/Badge';

export interface RecentWarehouseDocRow {
  id: string;
  docNumber: string;
  docDate: string;
  typeLabel: string;
  partnerOrInfo: string;
  amount: string;
  status: DocumentStatus;
  path: string;
}

interface DashboardTablesProps {
  recentWarehouseDocs: RecentWarehouseDocRow[];
  recentReceipts: PosReceipt[];
}

export function DashboardTables({ recentWarehouseDocs, recentReceipts }: DashboardTablesProps) {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('nav.groupWarehouse')}</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/warehouse/calculations')}>
            {t('common.view')}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-semibold">{t('warehouse.docNumber')}</th>
                <th className="px-4 py-2 font-semibold">{t('common.date')}</th>
                <th className="px-4 py-2 font-semibold text-right">{t('common.amount')}</th>
                <th className="px-4 py-2 font-semibold text-right">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentWarehouseDocs.map((doc) => (
                <tr
                  key={doc.id}
                  onClick={() => navigate(doc.path)}
                  className="hover:bg-muted/40 cursor-pointer"
                >
                  <td className="px-4 py-2.5">
                    <div className="font-mono font-medium text-foreground">{doc.docNumber}</div>
                    <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                      {doc.typeLabel} — {doc.partnerOrInfo}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatDateBs(doc.docDate)}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium">
                    {formatMoney2(doc.amount, true)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <DocumentStatusBadge status={doc.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('nav.posReceipts')}</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/pos/receipts')}>
            {t('common.view')}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-semibold">{t('warehouse.docNumber')}</th>
                <th className="px-4 py-2 font-semibold">{t('common.date')}</th>
                <th className="px-4 py-2 font-semibold text-right">{t('common.total')}</th>
                <th className="px-4 py-2 font-semibold text-right">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentReceipts.map((rc) => (
                <tr
                  key={rc.id}
                  onClick={() => navigate('/pos/receipts')}
                  className="hover:bg-muted/40 cursor-pointer"
                >
                  <td className="px-4 py-2.5">
                    <div className="font-mono font-medium text-foreground">{rc.receiptNumber}</div>
                    <div className="text-[11px] font-mono text-muted-foreground">
                      {rc.fiscalNumber}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {formatDateTimeBs(rc.issuedAt)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium">
                    {formatMoney2(rc.totalGrossAmount, true)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Badge variant={rc.receiptType === 'REFUND' ? 'destructive' : 'success'}>
                      {rc.receiptType === 'REFUND' ? t('status.REFUND') : t('status.SALE')}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
