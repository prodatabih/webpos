import { describe, expect, it } from 'vitest';
import { getAppStoreState } from './useAppStore';
import type { Item } from '../types/domain';

describe('SystemConfig and Item domain updates', () => {
  it('has default systemConfig.allowPriceChangeWithoutLeveling as false', () => {
    const store = getAppStoreState();
    expect(store.systemConfig.allowPriceChangeWithoutLeveling).toBe(false);
  });

  it('updates systemConfig through setSystemConfig action', () => {
    const store = getAppStoreState();
    store.setSystemConfig({ allowPriceChangeWithoutLeveling: true });

    const updated = getAppStoreState();
    expect(updated.systemConfig.allowPriceChangeWithoutLeveling).toBe(true);

    // Reset back to default
    store.setSystemConfig({ allowPriceChangeWithoutLeveling: false });
    expect(getAppStoreState().systemConfig.allowPriceChangeWithoutLeveling).toBe(false);
  });

  it('supports groupCode and categoryPrefix on Item objects', () => {
    const newItem: Item = {
      id: 'test-item-custom-fields',
      companyId: 'comp-1',
      sku: '99001',
      primaryBarcode: '3879999000011',
      name: 'Test Artikal sa Grupom',
      shortName: 'Test Grupa',
      itemType: 'GOODS',
      normativeMode: 'NONE',
      uom: 'kom',
      netContentQty: '1.0000',
      netContentUom: 'kom',
      vatRateId: 'vat-e17',
      categoryName: 'Pića',
      countryOfOrigin: 'Bosna i Hercegovina',
      isWeighable: false,
      isActive: true,
      groupCode: 'GRP-100',
      categoryPrefix: 'BEV',
    };

    const store = getAppStoreState();
    store.upsertItem(newItem);

    const saved = getAppStoreState().items.find((i) => i.id === 'test-item-custom-fields');
    expect(saved).toBeDefined();
    expect(saved?.groupCode).toBe('GRP-100');
    expect(saved?.categoryPrefix).toBe('BEV');
  });
});
