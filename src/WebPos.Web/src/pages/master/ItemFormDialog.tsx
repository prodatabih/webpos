import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import { cn, generateUuidV7 } from '../../lib/utils';
import { round4 } from '../../lib/money';
import { useAppStore } from '../../store/useAppStore';
import type {
  Item,
  ItemBarcode,
  ItemBomLine,
  ItemType,
  NormativeMode,
} from '../../types/domain';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { showToast } from '../../components/ui/Toast';
import { ItemBarcodesTab, ItemBomTab, ItemStorePricesTab } from './ItemFormTabs';
import { COMMON_CATEGORIES, suggestNextSku } from './itemSkuHelper';

type ActiveTab = 'basic' | 'barcodes' | 'bom' | 'declaration' | 'prices';

export interface ItemFormDialogProps {
  open: boolean;
  onClose: () => void;
  editingItem?: Item | null;
}

export function ItemFormDialog({ open, onClose, editingItem }: ItemFormDialogProps) {
  const {
    activeCompanyId,
    items,
    itemBarcodes,
    itemBomLines,
    vatRates,
    storeLocations,
    storeItemPrices,
    systemConfig,
    upsertItem,
    upsertStoreItemPrice,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>('basic');
  const [itemId, setItemId] = useState('');
  const [sku, setSku] = useState('');
  const [primaryBarcode, setPrimaryBarcode] = useState('');
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [itemType, setItemType] = useState<ItemType>('GOODS');
  const [normativeMode, setNormativeMode] = useState<NormativeMode>('NONE');
  const [uom, setUom] = useState('kom');
  const [netContentQty, setNetContentQty] = useState('1.0000');
  const [netContentUom, setNetContentUom] = useState('kg');
  const [vatRateId, setVatRateId] = useState('vat-e17');
  const [categoryName, setCategoryName] = useState('');
  const [countryOfOrigin, setCountryOfOrigin] = useState('Bosna i Hercegovina');
  const [isWeighable, setIsWeighable] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [localBarcodes, setLocalBarcodes] = useState<ItemBarcode[]>([]);
  const [localBomLines, setLocalBomLines] = useState<ItemBomLine[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!open) return;
    setActiveTab('basic');
    setErrorMsg('');
    if (editingItem) {
      setItemId(editingItem.id);
      setSku(editingItem.sku);
      setPrimaryBarcode(editingItem.primaryBarcode);
      setName(editingItem.name);
      setShortName(editingItem.shortName);
      setItemType(editingItem.itemType);
      setNormativeMode(editingItem.normativeMode);
      setUom(editingItem.uom);
      setNetContentQty(editingItem.netContentQty);
      setNetContentUom(editingItem.netContentUom);
      setVatRateId(editingItem.vatRateId);
      setCategoryName(editingItem.categoryName);
      setCountryOfOrigin(editingItem.countryOfOrigin);
      setIsWeighable(editingItem.isWeighable);
      setIsActive(editingItem.isActive);
      setLocalBarcodes(itemBarcodes.filter((b) => b.itemId === editingItem.id));
      setLocalBomLines(itemBomLines.filter((b) => b.parentItemId === editingItem.id));
    } else {
      const nextId = generateUuidV7();
      setItemId(nextId);
      setSku(`${10000 + items.length + 1}`);
      setPrimaryBarcode('');
      setName('');
      setShortName('');
      setItemType('GOODS');
      setNormativeMode('NONE');
      setUom('kom');
      setNetContentQty('1.0000');
      setNetContentUom('kg');
      setVatRateId(vatRates[0]?.id ?? 'vat-e17');
      setCategoryName('');
      setCountryOfOrigin('Bosna i Hercegovina');
      setIsWeighable(false);
      setIsActive(true);
      setLocalBarcodes([]);
      setLocalBomLines([]);
    }
  }, [open, editingItem]);

  const handleCategoryChange = (val: string) => {
    setCategoryName(val);
    if (!editingItem && val.trim()) {
      setSku(suggestNextSku(val, items));
    }
  };

  const handleSave = () => {
    if (!sku.trim() || !name.trim() || !primaryBarcode.trim()) {
      setErrorMsg(t('common.requiredField'));
      return;
    }
    const payload: Item = {
      id: itemId,
      companyId: activeCompanyId,
      sku: sku.trim(),
      primaryBarcode: primaryBarcode.trim(),
      name: name.trim(),
      shortName: shortName.trim() || name.trim().slice(0, 24),
      itemType,
      normativeMode: itemType === 'COMPOSITE' ? 'ON_SALE_BACKFLUSH' : normativeMode,
      uom: uom.trim() || 'kom',
      netContentQty: round4(netContentQty),
      netContentUom: netContentUom.trim() || 'kg',
      vatRateId,
      categoryName: categoryName.trim(),
      countryOfOrigin: countryOfOrigin.trim(),
      isWeighable,
      isActive,
    };
    upsertItem(payload, localBarcodes, localBomLines);
    showToast({ title: t('messages.recordSaved'), variant: 'success' });
    onClose();
  };

  const tabs: Array<{ id: ActiveTab; label: string }> = [
    { id: 'basic', label: t('common.description') },
    { id: 'barcodes', label: t('master.additionalBarcodes') },
    { id: 'bom', label: t('master.bomLines') },
    { id: 'declaration', label: t('master.countryOfOrigin') },
    { id: 'prices', label: t('app.storeLocation') },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      title={editingItem ? `${t('common.edit')} — ${editingItem.name}` : t('common.create')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={handleSave}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1 border-b border-border pb-2">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              type="button"
              onClick={() => setActiveTab(tb.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                activeTab === tb.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {errorMsg && <p className="text-xs font-medium text-destructive">{errorMsg}</p>}

        {activeTab === 'basic' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Input label={t('master.sku')} required value={sku} onChange={(e) => setSku(e.target.value)} className="font-mono" />
            <Input label={t('master.barcode')} required value={primaryBarcode} onChange={(e) => setPrimaryBarcode(e.target.value)} className="font-mono" />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-foreground">{t('master.itemType')}</label>
              <select
                value={itemType}
                onChange={(e) => setItemType(e.target.value as ItemType)}
                className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground"
              >
                <option value="GOODS">{t('master.typeGoods')}</option>
                <option value="SERVICE">{t('master.typeService')}</option>
                <option value="COMPOSITE">{t('master.typeComposite')}</option>
                <option value="RAW_MATERIAL">{t('master.typeRawMaterial')}</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Input label={t('common.name')} required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <Input label={t('common.description')} value={shortName} onChange={(e) => setShortName(e.target.value)} />
            <Input label={t('common.uom')} value={uom} onChange={(e) => setUom(e.target.value)} />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-foreground">{t('common.vat')}</label>
              <select
                value={vatRateId}
                onChange={(e) => setVatRateId(e.target.value)}
                className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground"
              >
                {vatRates.map((vr) => (
                  <option key={vr.id} value={vr.id}>{vr.code} — {vr.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-foreground">{t('master.category')}</label>
              <input
                list="item-categories-list"
                value={categoryName}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground"
              />
              <datalist id="item-categories-list">
                {COMMON_CATEGORIES.map((cat) => (
                  <option key={cat.prefix} value={cat.name} />
                ))}
              </datalist>
            </div>
          </div>
        )}

        {activeTab === 'barcodes' && (
          <ItemBarcodesTab itemId={itemId} barcodes={localBarcodes} onChange={setLocalBarcodes} />
        )}

        {activeTab === 'bom' && (
          <ItemBomTab
            parentItemId={itemId}
            allItems={items}
            bomLines={localBomLines}
            stores={storeLocations.filter((s) => s.companyId === activeCompanyId)}
            onChange={setLocalBomLines}
          />
        )}

        {activeTab === 'declaration' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Input label={t('master.countryOfOrigin')} value={countryOfOrigin} onChange={(e) => setCountryOfOrigin(e.target.value)} />
            <Input label={t('master.netContent')} value={netContentQty} onChange={(e) => setNetContentQty(e.target.value)} className="font-mono text-right" />
            <Input label={t('common.uom')} value={netContentUom} onChange={(e) => setNetContentUom(e.target.value)} />
            <label className="flex items-center gap-2 text-xs font-medium text-foreground pt-2 cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-input" />
              <span>{t('common.active')}</span>
            </label>
          </div>
        )}

        {activeTab === 'prices' && (
          <ItemStorePricesTab
            itemId={itemId}
            stores={storeLocations.filter((s) => s.companyId === activeCompanyId)}
            storePrices={storeItemPrices}
            allowPriceChangeWithoutLeveling={systemConfig.allowPriceChangeWithoutLeveling}
            onUpsertPrice={upsertStoreItemPrice}
          />
        )}
      </div>
    </Dialog>
  );
}
