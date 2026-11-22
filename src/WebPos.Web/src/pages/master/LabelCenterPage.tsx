import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCheck,
  Edit2,
  Plus,
  Printer,
  Search,
  SlidersHorizontal,
  Tags,
  Trash2,
} from 'lucide-react';
import { t } from '../../i18n';
import { d, formatMoney2, formatQty } from '../../lib/money';
import { formatDateBs, generateUuidV7 } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';
import type { LabelTemplate } from '../../types/domain';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { showToast } from '../../components/ui/Toast';

const FALLBACK_TEMPLATE: LabelTemplate = {
  id: 'default-preview-70x35',
  name: 'Standardna polica 70x35 mm',
  widthMm: 70,
  heightMm: 35,
  fontScale: 1,
  showBarcode: true,
  showUnitPrice: true,
  showOrigin: true,
  showSku: true,
  isDefault: true,
};

const TEMPLATE_PRESETS: Array<Omit<LabelTemplate, 'id' | 'isDefault'>> = [
  {
    name: 'Standardna polica 70x35 mm',
    widthMm: 70,
    heightMm: 35,
    fontScale: 1,
    showBarcode: true,
    showUnitPrice: true,
    showOrigin: true,
    showSku: true,
  },
  {
    name: 'Mala polica 50x25 mm',
    widthMm: 50,
    heightMm: 25,
    fontScale: 0.85,
    showBarcode: true,
    showUnitPrice: false,
    showOrigin: false,
    showSku: true,
  },
  {
    name: 'Akcijska 90x50 mm',
    widthMm: 90,
    heightMm: 50,
    fontScale: 1.25,
    showBarcode: true,
    showUnitPrice: true,
    showOrigin: true,
    showSku: true,
  },
];

export function LabelCenterPage() {
  const {
    activeStoreId,
    storeLocations,
    items,
    storeItemPrices,
    labelTemplates,
    clearLabelPrintFlags,
    saveLabelTemplate,
    deleteLabelTemplate,
  } = useAppStore();

  const [onlyPending, setOnlyPending] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<LabelTemplate | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplWidthMm, setTplWidthMm] = useState('70');
  const [tplHeightMm, setTplHeightMm] = useState('35');
  const [tplFontScale, setTplFontScale] = useState('1');
  const [tplShowBarcode, setTplShowBarcode] = useState(true);
  const [tplShowUnitPrice, setTplShowUnitPrice] = useState(true);
  const [tplShowOrigin, setTplShowOrigin] = useState(true);
  const [tplShowSku, setTplShowSku] = useState(true);
  const [tplIsDefault, setTplIsDefault] = useState(false);
  const [tplError, setTplError] = useState('');
  const [savingTpl, setSavingTpl] = useState(false);

  const [deleteTemplateTarget, setDeleteTemplateTarget] = useState<LabelTemplate | null>(null);
  const [confirmMarkPrintedOpen, setConfirmMarkPrintedOpen] = useState(false);
  const [markingSingleId, setMarkingSingleId] = useState<string | null>(null);

  const activeStore = storeLocations.find((s) => s.id === activeStoreId);

  useEffect(() => {
    if (labelTemplates.length === 0) {
      setSelectedTemplateId('');
      return;
    }
    if (!selectedTemplateId || !labelTemplates.some((tpl) => tpl.id === selectedTemplateId)) {
      const def = labelTemplates.find((tpl) => tpl.isDefault) ?? labelTemplates[0];
      setSelectedTemplateId(def?.id ?? '');
    }
  }, [labelTemplates, selectedTemplateId]);

  const activePersistedTemplate = useMemo(
    () => labelTemplates.find((tpl) => tpl.id === selectedTemplateId) ?? null,
    [labelTemplates, selectedTemplateId]
  );

  const activeTemplate = activePersistedTemplate ?? FALLBACK_TEMPLATE;

  const labelItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return storeItemPrices
      .filter((sp) => sp.storeId === activeStoreId)
      .filter((sp) => (onlyPending ? sp.needsLabelPrint : true))
      .map((sp) => {
        const item = items.find((i) => i.id === sp.itemId);
        if (!item) return null;
        const netQty = d(item.netContentQty || 1);
        const unitPerBase = netQty.gt(0)
          ? d(sp.retailUnitPriceWithVat).div(netQty)
          : d(sp.retailUnitPriceWithVat);
        return {
          sp,
          item,
          unitPerBaseStr: formatMoney2(unitPerBase, true),
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .filter(({ item, sp }) => {
        if (!q) return true;
        return (
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          (item.primaryBarcode ?? '').toLowerCase().includes(q) ||
          (sp.shelfLocation ?? '').toLowerCase().includes(q)
        );
      });
  }, [storeItemPrices, activeStoreId, onlyPending, items, searchQuery]);

  const visibleIdsKey = useMemo(
    () => labelItems.map((x) => x.item.id).join(','),
    [labelItems]
  );

  useEffect(() => {
    setSelectedItemIds(new Set(labelItems.map((x) => x.item.id)));
  }, [visibleIdsKey, activeStoreId, onlyPending]);

  const pendingCount = useMemo(
    () =>
      storeItemPrices.filter((sp) => sp.storeId === activeStoreId && sp.needsLabelPrint).length,
    [storeItemPrices, activeStoreId]
  );

  const selectedIdsArray = useMemo(
    () => labelItems.filter((x) => selectedItemIds.has(x.item.id)).map((x) => x.item.id),
    [labelItems, selectedItemIds]
  );

  const selectedPendingIds = useMemo(
    () =>
      labelItems
        .filter((x) => selectedItemIds.has(x.item.id) && x.sp.needsLabelPrint)
        .map((x) => x.item.id),
    [labelItems, selectedItemIds]
  );

  const allVisibleSelected =
    labelItems.length > 0 && selectedIdsArray.length === labelItems.length;

  const toggleSelectItem = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(labelItems.map((x) => x.item.id)));
    }
  };

  const handlePrintOnly = () => {
    if (selectedIdsArray.length === 0) {
      showToast({ title: 'Odaberite barem jednu etiketu za štampu.', variant: 'error' });
      return;
    }
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  };

  const handleConfirmMarkPrinted = async () => {
    const idsToClear = selectedPendingIds.length > 0 ? selectedPendingIds : selectedIdsArray;
    if (idsToClear.length === 0 || !activeStoreId) {
      setConfirmMarkPrintedOpen(false);
      return;
    }
    const res = await clearLabelPrintFlags(activeStoreId, idsToClear);
    if (!res.ok) {
      showToast({ title: t('common.errorTitle'), description: res.error, variant: 'error' });
      setConfirmMarkPrintedOpen(false);
      return;
    }
    showToast({
      title: `Označeno kao odštampano (${idsToClear.length} etiketa).`,
      variant: 'success',
    });
    setConfirmMarkPrintedOpen(false);
  };

  const handleMarkSinglePrinted = async (itemId: string) => {
    if (!activeStoreId || markingSingleId) return;
    setMarkingSingleId(itemId);
    try {
      const res = await clearLabelPrintFlags(activeStoreId, [itemId]);
      if (!res.ok) {
        showToast({ title: t('common.errorTitle'), description: res.error, variant: 'error' });
        return;
      }
      showToast({ title: 'Etiketa je označena kao odštampana.', variant: 'success' });
    } finally {
      setMarkingSingleId(null);
    }
  };

  const openNewTemplateDialog = () => {
    setEditingTemplate(null);
    setTplName('Standardna polica 70x35 mm');
    setTplWidthMm('70');
    setTplHeightMm('35');
    setTplFontScale('1');
    setTplShowBarcode(true);
    setTplShowUnitPrice(true);
    setTplShowOrigin(true);
    setTplShowSku(true);
    setTplIsDefault(labelTemplates.length === 0);
    setTplError('');
    setTemplateDialogOpen(true);
  };

  const openEditTemplateDialog = () => {
    if (!activePersistedTemplate) return;
    setEditingTemplate(activePersistedTemplate);
    setTplName(activePersistedTemplate.name);
    setTplWidthMm(String(activePersistedTemplate.widthMm));
    setTplHeightMm(String(activePersistedTemplate.heightMm));
    setTplFontScale(String(activePersistedTemplate.fontScale));
    setTplShowBarcode(activePersistedTemplate.showBarcode);
    setTplShowUnitPrice(activePersistedTemplate.showUnitPrice);
    setTplShowOrigin(activePersistedTemplate.showOrigin);
    setTplShowSku(activePersistedTemplate.showSku);
    setTplIsDefault(activePersistedTemplate.isDefault);
    setTplError('');
    setTemplateDialogOpen(true);
  };

  const applyPreset = (preset: Omit<LabelTemplate, 'id' | 'isDefault'>) => {
    setTplName(preset.name);
    setTplWidthMm(String(preset.widthMm));
    setTplHeightMm(String(preset.heightMm));
    setTplFontScale(String(preset.fontScale));
    setTplShowBarcode(preset.showBarcode);
    setTplShowUnitPrice(preset.showUnitPrice);
    setTplShowOrigin(preset.showOrigin);
    setTplShowSku(preset.showSku);
  };

  const handleSaveTemplate = async () => {
    if (savingTpl) return;
    const widthNum = Number(tplWidthMm.replace(',', '.'));
    const heightNum = Number(tplHeightMm.replace(',', '.'));
    const scaleNum = Number(tplFontScale.replace(',', '.'));

    if (!tplName.trim()) {
      setTplError('Unesite naziv šablona etikete.');
      return;
    }
    if (!Number.isFinite(widthNum) || widthNum < 20 || widthNum > 210) {
      setTplError('Širina etikete mora biti između 20 i 210 mm.');
      return;
    }
    if (!Number.isFinite(heightNum) || heightNum < 15 || heightNum > 297) {
      setTplError('Visina etikete mora biti između 15 i 297 mm.');
      return;
    }
    if (!Number.isFinite(scaleNum) || scaleNum < 0.8 || scaleNum > 1.5) {
      setTplError('Skala fonta mora biti između 0.8 i 1.5.');
      return;
    }

    setTplError('');
    setSavingTpl(true);
    try {
      const payload: LabelTemplate = {
        id: editingTemplate?.id ?? generateUuidV7(),
        name: tplName.trim(),
        widthMm: Math.round(widthNum),
        heightMm: Math.round(heightNum),
        fontScale: Number(scaleNum.toFixed(2)),
        showBarcode: tplShowBarcode,
        showUnitPrice: tplShowUnitPrice,
        showOrigin: tplShowOrigin,
        showSku: tplShowSku,
        isDefault: tplIsDefault,
      };
      const res = await saveLabelTemplate(payload);
      if (!res.ok) {
        setTplError(res.error ?? 'Greška pri snimanju šablona.');
        showToast({ title: t('common.errorTitle'), description: res.error, variant: 'error' });
        return;
      }
      setSelectedTemplateId(payload.id);
      showToast({ title: 'Šablon etikete je uspješno snimljen.', variant: 'success' });
      setTemplateDialogOpen(false);
    } finally {
      setSavingTpl(false);
    }
  };

  const handleConfirmDeleteTemplate = async () => {
    if (!deleteTemplateTarget) return;
    const res = await deleteLabelTemplate(deleteTemplateTarget.id);
    if (!res.ok) {
      showToast({ title: t('common.errorTitle'), description: res.error, variant: 'error' });
      setDeleteTemplateTarget(null);
      return;
    }
    showToast({ title: 'Šablon etikete je obrisan.', variant: 'success' });
    setDeleteTemplateTarget(null);
  };

  return (
    <div className="flex flex-col min-h-full">
      <style>{`
        @media print {
          @page {
            margin: 6mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .label-print-grid {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 2mm !important;
            padding: 0 !important;
          }
          .shelf-label-card {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            box-shadow: none !important;
            border: 1px solid #000000 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
        }
      `}</style>

      <div className="print:hidden">
        <PageHeader
          title={t('nav.labelCenter')}
          subtitle={activeStore ? `${activeStore.code} — ${activeStore.name}` : undefined}
          breadcrumbs={[
            { label: t('nav.groupMasterData') },
            { label: t('nav.labelCenter') },
          ]}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={onlyPending ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setOnlyPending(true)}
              >
                <Tags className="h-3.5 w-3.5" />
                <span>
                  {t('master.labelQueueCount')} ({pendingCount})
                </span>
              </Button>
              <Button
                variant={!onlyPending ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setOnlyPending(false)}
              >
                <span>{t('common.all')}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmMarkPrintedOpen(true)}
                disabled={selectedIdsArray.length === 0}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Označi kao odštampano ({selectedIdsArray.length})</span>
              </Button>
            </div>
          }
          primaryAction={
            <Button
              variant="success"
              onClick={handlePrintOnly}
              disabled={selectedIdsArray.length === 0}
            >
              <Printer className="h-4 w-4" />
              <span>{t('common.print')} ({selectedIdsArray.length})</span>
            </Button>
          }
        />
      </div>

      <div className="p-6 space-y-5 print:p-0 print:space-y-0">
        {/* Template & Search Toolbar — hidden on print */}
        <Card className="print:hidden">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground mr-1">
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  <span>Šablon etikete:</span>
                </div>
                <select
                  aria-label="Šablon etikete"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="h-8 rounded-md border border-input bg-card px-2.5 text-xs text-foreground min-w-[220px]"
                >
                  {labelTemplates.length === 0 ? (
                    <option value="">
                      {FALLBACK_TEMPLATE.name} ({FALLBACK_TEMPLATE.widthMm}×{FALLBACK_TEMPLATE.heightMm} mm — podrazumijevano)
                    </option>
                  ) : (
                    labelTemplates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name} ({tpl.widthMm}×{tpl.heightMm} mm){tpl.isDefault ? ' ★' : ''}
                      </option>
                    ))
                  )}
                </select>
                <Button variant="outline" size="sm" onClick={openNewTemplateDialog}>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Novi šablon</span>
                </Button>
                {activePersistedTemplate && (
                  <>
                    <Button variant="ghost" size="sm" onClick={openEditTemplateDialog}>
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>Uredi šablon</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTemplateTarget(activePersistedTemplate)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Obriši šablon</span>
                    </Button>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1 sm:flex-none">
                  <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Pretraga po nazivu, šifri, barkodu..."
                    className="h-8 w-full rounded-md border border-input bg-card pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                  disabled={labelItems.length === 0}
                >
                  <span>{allVisibleSelected ? 'Poništi odabir' : 'Označi sve'}</span>
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground border-t border-border pt-2.5">
              <span>
                Dimenzije:{' '}
                <strong className="font-mono text-foreground">
                  {activeTemplate.widthMm} × {activeTemplate.heightMm} mm
                </strong>
              </span>
              <span>
                Skala fonta:{' '}
                <strong className="font-mono text-foreground">{activeTemplate.fontScale}×</strong>
              </span>
              <span>
                Odabrano za štampu:{' '}
                <strong className="font-mono text-foreground">
                  {selectedIdsArray.length} / {labelItems.length}
                </strong>
              </span>
            </div>
          </CardContent>
        </Card>

        {labelItems.length === 0 ? (
          <Card className="print:hidden">
            <CardContent className="py-12 text-center">
              <p className="text-sm font-semibold text-foreground">{t('common.noResults')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('common.noResultsDesc')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="label-print-grid flex flex-wrap gap-4 items-start">
            {labelItems.map(({ sp, item, unitPerBaseStr }) => {
              const isSelected = selectedItemIds.has(item.id);
              const scale = activeTemplate.fontScale || 1;
              return (
                <div
                  key={sp.id}
                  className={isSelected ? 'flex flex-col gap-1.5' : 'flex flex-col gap-1.5 print:hidden'}
                >
                  {/* Selection / actions bar above label — NEVER printed */}
                  <div className="flex items-center justify-between gap-2 px-0.5 print:hidden">
                    <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectItem(item.id)}
                        className="rounded border-input"
                      />
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {item.sku}
                      </span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      {sp.needsLabelPrint && (
                        <Badge variant="warning" className="text-[10px]">
                          Za štampu
                        </Badge>
                      )}
                      {sp.needsLabelPrint && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[11px]"
                          isLoading={markingSingleId === item.id}
                          onClick={() => void handleMarkSinglePrinted(item.id)}
                        >
                          <Check className="h-3 w-3" />
                          <span>Odštampano</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Actual shelf label card sized in exact mm */}
                  <div
                    style={{
                      width: `${activeTemplate.widthMm}mm`,
                      minHeight: `${activeTemplate.heightMm}mm`,
                      fontSize: `${scale}em`,
                    }}
                    className={`shelf-label-card flex flex-col justify-between rounded-sm border-2 bg-card p-2 text-foreground shadow-xs overflow-hidden transition-opacity ${
                      isSelected
                        ? 'border-foreground/30 opacity-100'
                        : 'border-border opacity-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div
                        className="font-bold leading-tight text-foreground break-words"
                        style={{ fontSize: '0.82em' }}
                      >
                        {item.name}
                      </div>
                      {activeTemplate.showOrigin && item.countryOfOrigin && (
                        <div
                          className="text-muted-foreground leading-tight mt-0.5 truncate"
                          style={{ fontSize: '0.58em' }}
                        >
                          {t('master.countryOfOrigin')}: {item.countryOfOrigin}
                        </div>
                      )}
                    </div>

                    <div className="flex items-end justify-between gap-2 border-y border-dashed border-border py-1 my-1">
                      <div
                        className="space-y-0.5 text-muted-foreground min-w-0"
                        style={{ fontSize: '0.58em' }}
                      >
                        {activeTemplate.showSku && (
                          <div className="font-mono truncate">
                            Šifra: <strong className="text-foreground">{item.sku}</strong>
                          </div>
                        )}
                        {activeTemplate.showBarcode && item.primaryBarcode && (
                          <div className="font-mono truncate">{item.primaryBarcode}</div>
                        )}
                        {sp.shelfLocation && (
                          <div className="font-mono truncate">Polica: {sp.shelfLocation}</div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div
                          className="font-extrabold font-mono text-foreground leading-none tracking-tight"
                          style={{ fontSize: '1.35em' }}
                        >
                          {formatMoney2(sp.retailUnitPriceWithVat, true)}
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex items-center justify-between gap-1 text-muted-foreground"
                      style={{ fontSize: '0.55em' }}
                    >
                      {activeTemplate.showUnitPrice ? (
                        <span className="truncate">
                          1 {item.netContentUom} ={' '}
                          <strong className="font-mono text-foreground">{unitPerBaseStr}</strong> (
                          {formatQty(item.netContentQty, 2)} {item.netContentUom})
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className="font-mono shrink-0">{formatDateBs(sp.updatedAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Template Create / Edit Dialog */}
      <Dialog
        open={templateDialogOpen}
        onClose={() => {
          if (!savingTpl) setTemplateDialogOpen(false);
        }}
        size="md"
        title={
          editingTemplate
            ? `Uredi šablon etikete — ${editingTemplate.name}`
            : 'Novi šablon etikete'
        }
        description="Definišite dimenzije police u milimetrima, veličinu fonta i polja koja se prikazuju na etiketi."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setTemplateDialogOpen(false)}
              disabled={savingTpl}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleSaveTemplate()}
              isLoading={savingTpl}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {!editingTemplate && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">Brzi predlošci:</div>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_PRESETS.map((preset) => (
                  <Button
                    key={preset.name}
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(preset)}
                  >
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {tplError && <p className="text-xs font-medium text-destructive">{tplError}</p>}

          <Input
            label="Naziv šablona"
            required
            placeholder="npr. Standardna polica 70x35 mm"
            value={tplName}
            onChange={(e) => setTplName(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Širina (mm)"
              type="number"
              min={20}
              max={210}
              required
              value={tplWidthMm}
              onChange={(e) => setTplWidthMm(e.target.value)}
              className="font-mono text-right"
            />
            <Input
              label="Visina (mm)"
              type="number"
              min={15}
              max={297}
              required
              value={tplHeightMm}
              onChange={(e) => setTplHeightMm(e.target.value)}
              className="font-mono text-right"
            />
            <Input
              label="Skala fonta (0.8–1.5)"
              type="number"
              step={0.05}
              min={0.8}
              max={1.5}
              required
              value={tplFontScale}
              onChange={(e) => setTplFontScale(e.target.value)}
              className="font-mono text-right"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={tplShowBarcode}
                onChange={(e) => setTplShowBarcode(e.target.checked)}
                className="rounded border-input"
              />
              <span>Prikaži barkod</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={tplShowUnitPrice}
                onChange={(e) => setTplShowUnitPrice(e.target.checked)}
                className="rounded border-input"
              />
              <span>Prikaži jediničnu cijenu po kg/L</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={tplShowOrigin}
                onChange={(e) => setTplShowOrigin(e.target.checked)}
                className="rounded border-input"
              />
              <span>Prikaži zemlju porijekla</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={tplShowSku}
                onChange={(e) => setTplShowSku(e.target.checked)}
                className="rounded border-input"
              />
              <span>Prikaži šifru</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer sm:col-span-2 pt-1 border-t border-border">
              <input
                type="checkbox"
                checked={tplIsDefault}
                onChange={(e) => setTplIsDefault(e.target.checked)}
                className="rounded border-input"
              />
              <span>Zadani šablon</span>
            </label>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTemplateTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTemplateTarget(null);
        }}
        variant="destructive"
        title={
          deleteTemplateTarget
            ? `Obrisati šablon "${deleteTemplateTarget.name}"?`
            : 'Obrisati šablon?'
        }
        description="Brisanje šablona etikete je nepovratno."
        confirmLabel={t('common.delete')}
        onConfirm={handleConfirmDeleteTemplate}
      />

      <ConfirmDialog
        open={confirmMarkPrintedOpen}
        onOpenChange={setConfirmMarkPrintedOpen}
        variant="primary"
        title="Označiti odabrane etikete kao odštampane?"
        description={`Oznaka „za štampu” bit će uklonjena za ${
          selectedPendingIds.length > 0 ? selectedPendingIds.length : selectedIdsArray.length
        } odabranih artikala u aktivnom objektu.`}
        confirmLabel="Označi kao odštampano"
        onConfirm={handleConfirmMarkPrinted}
      />
    </div>
  );
}

export default LabelCenterPage;
