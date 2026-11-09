import type { Item } from '../types/domain';
import { seedCatalogItems1 } from './seedCatalogItems1';
import { seedCatalogItems2 } from './seedCatalogItems2';
import { seedCatalogItems3 } from './seedCatalogItems3';

export const seedCatalogItems: Item[] = [
  ...seedCatalogItems1,
  ...seedCatalogItems2,
  ...seedCatalogItems3,
];
