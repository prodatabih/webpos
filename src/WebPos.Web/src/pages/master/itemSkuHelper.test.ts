import { describe, expect, it } from 'vitest';
import { getCategoryPrefix, suggestNextSku } from './itemSkuHelper';
import type { Item } from '../../types/domain';

const mockItems: Item[] = [
  {
    id: 'it-1',
    companyId: 'comp-1',
    sku: 'MLI-00044',
    primaryBarcode: '387001',
    name: 'Mlijeko',
    shortName: 'Mlijeko',
    itemType: 'GOODS',
    normativeMode: 'NONE',
    uom: 'kom',
    netContentQty: '1.0000',
    netContentUom: 'l',
    vatRateId: 'vat-e17',
    categoryName: 'Mliječni proizvodi',
    countryOfOrigin: 'BiH',
    isWeighable: false,
    isActive: true,
  },
  {
    id: 'it-2',
    companyId: 'comp-1',
    sku: 'PEK-00010',
    primaryBarcode: '387002',
    name: 'Kroasan',
    shortName: 'Kroasan',
    itemType: 'GOODS',
    normativeMode: 'NONE',
    uom: 'kom',
    netContentQty: '0.1000',
    netContentUom: 'kg',
    vatRateId: 'vat-e17',
    categoryName: 'Pekarski proizvodi',
    countryOfOrigin: 'BiH',
    isWeighable: false,
    isActive: true,
  },
];

describe('itemSkuHelper', () => {
  it('identifies predefined and custom category prefixes', () => {
    expect(getCategoryPrefix('Mliječni proizvodi')).toBe('MLI');
    expect(getCategoryPrefix('Pekarski proizvodi')).toBe('PEK');
    expect(getCategoryPrefix('Sirovine i repromaterijal')).toBe('MAT');
    expect(getCategoryPrefix('Elektronika')).toBe('ELE');
  });

  it('suggests the next sequential SKU based on category prefix', () => {
    // Highest MLI is MLI-00044 -> next is MLI-00045
    const nextMli = suggestNextSku('Mliječni proizvodi', mockItems);
    expect(nextMli).toBe('MLI-00045');

    // Highest PEK is PEK-00010 -> next is PEK-00011
    const nextPek = suggestNextSku('Pekarski proizvodi', mockItems);
    expect(nextPek).toBe('PEK-00011');

    // No existing items with MAT -> starts at MAT-00001
    const nextMat = suggestNextSku('Sirovine i repromaterijal', mockItems);
    expect(nextMat).toBe('MAT-00001');
  });
});
