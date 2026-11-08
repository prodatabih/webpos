import { Badge } from '../../components/ui/Badge';
import { t } from '../../i18n';

export function PosShortcutsBanner() {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <Badge variant="outline">{t('pos.shortcutScan')}</Badge>
      <Badge variant="outline">{t('pos.shortcutQty')}</Badge>
      <Badge variant="outline">{t('pos.shortcutHold')}</Badge>
      <Badge variant="outline">{t('pos.shortcutCash')}</Badge>
      <Badge variant="outline">{t('pos.shortcutCard')}</Badge>
      <Badge variant="outline">{t('pos.shortcutRefund')}</Badge>
      <Badge variant="outline">{t('pos.shortcutPay')}</Badge>
    </div>
  );
}
