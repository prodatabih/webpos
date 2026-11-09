import type { Item, ItemBarcode, ItemBomLine, Partner, StoreItemPrice } from '../types/domain';
import { seedCatalogItems } from './seedCatalogItems';
import { seedCatalogPrices } from './seedCatalogPrices';
import { seedCatalogPartners } from './seedCatalogPartners';

export const initialItems: Item[] = seedCatalogItems;

export const initialItemBarcodes: ItemBarcode[] = [
  { id: 'bc-1', itemId: 'item-1', barcode: '3871234900018', uom: 'pak', packMultiplier: '12.0000', description: 'Transportni karton 12x500g' },
  { id: 'bc-2', itemId: 'item-6', barcode: '3871234900063', uom: 'pak', packMultiplier: '6.0000', description: 'Baksa 6x1,5L' },
];

export const initialItemBomLines: ItemBomLine[] = [
  { id: 'bom-1', parentItemId: 'item-5', componentItemId: 'item-2', quantity: '0.1000', wastePercent: '2.00', sourceStoreId: 'store-4' },
];

export const initialStoreItemPrices: StoreItemPrice[] = seedCatalogPrices;

export const initialPartners: Partner[] = seedCatalogPartners;
