import Decimal from 'decimal.js';
import type { StoreItemPrice } from '../types/domain';

interface SeedPriceSpec {
  id: string;
  nc: string;
  mpc: string;
  shelf: string;
}

const priceSpecs: SeedPriceSpec[] = [
  { id: 'item-1', nc: '7.2000', mpc: '9.50', shelf: 'A-01-02' },
  { id: 'item-2', nc: '2.4500', mpc: '3.40', shelf: 'B-02-01' },
  { id: 'item-3', nc: '1.6500', mpc: '2.30', shelf: 'H-01-01' },
  { id: 'item-4', nc: '2.3000', mpc: '3.15', shelf: 'B-03-04' },
  { id: 'item-5', nc: '0.6500', mpc: '1.20', shelf: 'P-01-01' },
  { id: 'item-6', nc: '0.8800', mpc: '1.35', shelf: 'C-04-02' },
  { id: 'item-7', nc: '1.8000', mpc: '2.45', shelf: 'H-01-03' },
  { id: 'item-8', nc: '0.9000', mpc: '1.30', shelf: 'H-01-04' },
  { id: 'item-9', nc: '1.8500', mpc: '2.50', shelf: 'H-01-05' },
  { id: 'item-10', nc: '3.2000', mpc: '4.40', shelf: 'H-01-06' },
  { id: 'item-11', nc: '2.8000', mpc: '3.90', shelf: 'H-01-07' },
  { id: 'item-12', nc: '1.8000', mpc: '2.45', shelf: 'H-01-08' },
  { id: 'item-13', nc: '0.5000', mpc: '0.75', shelf: 'H-01-09' },
  { id: 'item-14', nc: '1.6000', mpc: '2.25', shelf: 'H-01-10' },
  { id: 'item-15', nc: '4.5000', mpc: '6.20', shelf: 'H-01-11' },
  { id: 'item-16', nc: '8.2000', mpc: '11.50', shelf: 'H-02-01' },
  { id: 'item-17', nc: '3.9000', mpc: '5.50', shelf: 'H-02-02' },
  { id: 'item-18', nc: '6.5000', mpc: '9.20', shelf: 'H-02-03' },
  { id: 'item-19', nc: '2.1000', mpc: '2.95', shelf: 'H-02-04' },
  { id: 'item-20', nc: '1.2500', mpc: '1.80', shelf: 'H-02-05' },
  { id: 'item-21', nc: '0.9500', mpc: '1.50', shelf: 'P-01-02' },
  { id: 'item-22', nc: '1.0000', mpc: '1.60', shelf: 'P-01-03' },
  { id: 'item-23', nc: '0.7000', mpc: '1.20', shelf: 'P-01-04' },
  { id: 'item-24', nc: '1.3000', mpc: '1.85', shelf: 'B-02-02' },
  { id: 'item-25', nc: '5.6000', mpc: '7.90', shelf: 'B-02-03' },
  { id: 'item-26', nc: '0.8500', mpc: '1.25', shelf: 'B-02-04' },
  { id: 'item-27', nc: '1.1000', mpc: '1.65', shelf: 'B-02-05' },
  { id: 'item-28', nc: '1.1000', mpc: '1.65', shelf: 'B-02-06' },
  { id: 'item-29', nc: '1.2000', mpc: '1.75', shelf: 'B-02-07' },
  { id: 'item-30', nc: '1.9500', mpc: '2.85', shelf: 'B-02-08' },
  { id: 'item-31', nc: '1.9500', mpc: '2.85', shelf: 'B-02-09' },
  { id: 'item-32', nc: '1.2000', mpc: '1.75', shelf: 'B-02-10' },
  { id: 'item-33', nc: '1.5000', mpc: '2.20', shelf: 'P-01-05' },
  { id: 'item-34', nc: '3.1000', mpc: '4.20', shelf: 'A-01-03' },
  { id: 'item-35', nc: '1.6000', mpc: '2.15', shelf: 'A-01-04' },
  { id: 'item-36', nc: '6.8000', mpc: '9.10', shelf: 'A-01-05' },
  { id: 'item-37', nc: '2.9000', mpc: '3.95', shelf: 'A-01-06' },
  { id: 'item-38', nc: '3.9000', mpc: '5.30', shelf: 'A-01-07' },
  { id: 'item-39', nc: '5.8000', mpc: '7.90', shelf: 'A-01-08' },
  { id: 'item-40', nc: '8.5000', mpc: '11.90', shelf: 'A-02-01' },
  { id: 'item-41', nc: '6.2000', mpc: '8.70', shelf: 'A-02-02' },
  { id: 'item-42', nc: '0.3500', mpc: '0.55', shelf: 'A-02-03' },
  { id: 'item-43', nc: '9.1000', mpc: '12.80', shelf: 'A-02-04' },
  { id: 'item-44', nc: '1.1000', mpc: '1.65', shelf: 'A-03-01' },
  { id: 'item-45', nc: '1.1000', mpc: '1.65', shelf: 'A-03-02' },
  { id: 'item-46', nc: '1.4000', mpc: '2.10', shelf: 'A-03-03' },
  { id: 'item-47', nc: '2.8000', mpc: '3.95', shelf: 'A-03-04' },
  { id: 'item-48', nc: '0.5500', mpc: '0.90', shelf: 'C-04-03' },
  { id: 'item-49', nc: '0.9500', mpc: '1.50', shelf: 'C-04-04' },
  { id: 'item-50', nc: '0.6500', mpc: '1.05', shelf: 'C-04-05' },
  { id: 'item-51', nc: '0.4500', mpc: '0.75', shelf: 'C-04-06' },
  { id: 'item-52', nc: '0.6000', mpc: '1.00', shelf: 'C-04-07' },
  { id: 'item-53', nc: '0.9000', mpc: '1.40', shelf: 'C-04-08' },
  { id: 'item-54', nc: '1.9500', mpc: '2.70', shelf: 'C-01-01' },
  { id: 'item-55', nc: '0.8500', mpc: '1.30', shelf: 'C-01-02' },
  { id: 'item-56', nc: '1.9500', mpc: '2.70', shelf: 'C-01-03' },
  { id: 'item-57', nc: '1.8500', mpc: '2.60', shelf: 'C-01-04' },
  { id: 'item-58', nc: '1.7000', mpc: '2.40', shelf: 'C-01-05' },
  { id: 'item-59', nc: '1.9000', mpc: '2.75', shelf: 'C-02-01' },
  { id: 'item-60', nc: '2.2000', mpc: '3.15', shelf: 'C-02-02' },
  { id: 'item-61', nc: '6.8000', mpc: '9.50', shelf: 'C-02-03' },
  { id: 'item-62', nc: '2.5000', mpc: '3.60', shelf: 'D-01-01' },
  { id: 'item-63', nc: '3.2000', mpc: '4.60', shelf: 'D-01-02' },
  { id: 'item-64', nc: '6.9000', mpc: '9.80', shelf: 'D-01-03' },
  { id: 'item-65', nc: '1.2500', mpc: '1.85', shelf: 'D-01-04' },
  { id: 'item-66', nc: '1.2000', mpc: '1.80', shelf: 'D-01-05' },
  { id: 'item-67', nc: '1.1500', mpc: '1.70', shelf: 'D-02-01' },
  { id: 'item-68', nc: '0.5500', mpc: '0.85', shelf: 'D-02-02' },
  { id: 'item-69', nc: '0.3000', mpc: '0.50', shelf: 'D-02-03' },
  { id: 'item-70', nc: '1.3500', mpc: '1.95', shelf: 'D-02-04' },
  { id: 'item-71', nc: '1.7000', mpc: '2.45', shelf: 'D-03-01' },
  { id: 'item-72', nc: '1.8500', mpc: '2.65', shelf: 'D-03-02' },
  { id: 'item-73', nc: '1.8000', mpc: '2.60', shelf: 'D-04-01' },
  { id: 'item-74', nc: '1.8000', mpc: '2.60', shelf: 'D-04-02' },
  { id: 'item-75', nc: '2.4000', mpc: '3.45', shelf: 'D-04-03' },
  { id: 'item-76', nc: '2.5000', mpc: '3.60', shelf: 'D-04-04' },
  { id: 'item-77', nc: '10.5000', mpc: '14.80', shelf: 'B-03-05' },
  { id: 'item-78', nc: '13.5000', mpc: '18.90', shelf: 'B-03-06' },
  { id: 'item-79', nc: '0.6500', mpc: '1.05', shelf: 'B-04-01' },
  { id: 'item-80', nc: '0.8000', mpc: '1.25', shelf: 'B-04-02' },
  { id: 'item-81', nc: '1.3500', mpc: '1.95', shelf: 'B-04-03' },
  { id: 'item-82', nc: '0.7000', mpc: '1.10', shelf: 'B-04-04' },
  { id: 'item-83', nc: '1.8000', mpc: '2.55', shelf: 'B-04-05' },
  { id: 'item-84', nc: '2.8000', mpc: '3.95', shelf: 'B-05-01' },
  { id: 'item-85', nc: '2.1000', mpc: '3.00', shelf: 'B-05-02' },
  { id: 'item-86', nc: '3.4000', mpc: '4.80', shelf: 'B-05-03' },
  { id: 'item-87', nc: '2.3000', mpc: '3.25', shelf: 'B-05-04' },
  { id: 'item-88', nc: '3.9000', mpc: '5.60', shelf: 'B-05-05' },
  { id: 'item-89', nc: '0.8000', mpc: '1.25', shelf: 'B-05-06' },
  { id: 'item-90', nc: '2.1000', mpc: '3.05', shelf: 'B-05-07' },
  { id: 'item-91', nc: '8.5000', mpc: '12.00', shelf: 'M-01-01' },
  { id: 'item-92', nc: '4.8000', mpc: '6.90', shelf: 'M-01-02' },
  { id: 'item-93', nc: '1.4000', mpc: '2.10', shelf: 'M-01-03' },
  { id: 'item-94', nc: '1.1000', mpc: '1.65', shelf: 'M-01-04' },
  { id: 'item-95', nc: '3.8000', mpc: '5.40', shelf: 'M-01-05' },
  { id: 'item-96', nc: '1.9500', mpc: '2.80', shelf: 'M-01-06' },
  { id: 'item-97', nc: '1.3000', mpc: '1.90', shelf: 'M-01-07' },
  { id: 'item-98', nc: '5.9000', mpc: '8.50', shelf: 'M-02-01' },
  { id: 'item-99', nc: '2.8000', mpc: '4.10', shelf: 'M-02-02' },
  { id: 'item-100', nc: '3.5000', mpc: '5.10', shelf: 'M-02-03' },
  { id: 'item-101', nc: '6.8000', mpc: '9.70', shelf: 'M-02-04' },
  { id: 'item-102', nc: '24.0000', mpc: '34.00', shelf: 'M-02-05' },
  { id: 'item-103', nc: '0.9000', mpc: '1.35', shelf: 'M-03-01' },
  { id: 'item-104', nc: '1.3500', mpc: '1.95', shelf: 'M-03-02' },
  { id: 'item-105', nc: '1.3500', mpc: '1.95', shelf: 'M-03-03' },
  { id: 'item-106', nc: '4.2000', mpc: '5.95', shelf: 'K-01-01' },
  { id: 'item-107', nc: '1.8000', mpc: '2.65', shelf: 'K-01-02' },
  { id: 'item-108', nc: '1.7000', mpc: '2.50', shelf: 'K-01-03' },
  { id: 'item-109', nc: '2.1000', mpc: '3.10', shelf: 'K-02-01' },
  { id: 'item-110', nc: '4.1000', mpc: '5.90', shelf: 'K-02-02' },
  { id: 'item-111', nc: '2.4000', mpc: '3.45', shelf: 'K-02-03' },
  { id: 'item-112', nc: '7.9000', mpc: '11.50', shelf: 'K-03-01' },
  { id: 'item-113', nc: '2.3000', mpc: '3.35', shelf: 'K-03-02' },
  { id: 'item-114', nc: '1.8000', mpc: '2.65', shelf: 'K-03-03' },
  { id: 'item-115', nc: '3.2000', mpc: '4.65', shelf: 'K-03-04' },
];

const calculateWholesale = (retailPrice: string): string =>
  new Decimal(retailPrice).dividedBy('1.17').toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);

export const seedCatalogPrices: StoreItemPrice[] = priceSpecs.flatMap((spec, index) => {
  const itemIndex = index + 1;
  const wholesale1 = calculateWholesale(spec.mpc);
  const stock1 = (40 + ((itemIndex * 7) % 110)).toFixed(4);
  const stock2 = (25 + ((itemIndex * 5) % 65)).toFixed(4);
  const stock3 = (200 + ((itemIndex * 17) % 350)).toFixed(4);

  // Exact match for historical items 1 to 6 on store-1 and store-2
  if (spec.id === 'item-1') {
    return [
      { id: 'sip-1-1', storeId: 'store-1', itemId: 'item-1', purchaseUnitPrice: '7.2000', wholesaleUnitPriceExclVat: '8.1197', retailUnitPriceWithVat: '9.50', promoRetailPriceWithVat: '8.95', lowestPrice30Days: '9.20', currentStockQty: '148.0000', minStockQty: '30.0000', shelfLocation: 'A-01-02', needsLabelPrint: true, updatedAt: '2026-11-07T08:00:00Z' },
      { id: 'sip-2-1', storeId: 'store-2', itemId: 'item-1', purchaseUnitPrice: '7.2000', wholesaleUnitPriceExclVat: '8.2051', retailUnitPriceWithVat: '9.60', lowestPrice30Days: '9.50', currentStockQty: '75.0000', minStockQty: '20.0000', shelfLocation: 'A-01-01', needsLabelPrint: false, updatedAt: '2026-11-07T08:00:00Z' },
      { id: 'sip-3-1', storeId: 'store-3', itemId: 'item-1', purchaseUnitPrice: '7.2000', wholesaleUnitPriceExclVat: '8.1197', retailUnitPriceWithVat: '8.12', lowestPrice30Days: '8.12', currentStockQty: '450.0000', minStockQty: '50.0000', shelfLocation: 'WH-A-01', needsLabelPrint: false, updatedAt: '2026-11-07T08:00:00Z' },
    ];
  }
  if (spec.id === 'item-2') {
    return [
      { id: 'sip-1-2', storeId: 'store-1', itemId: 'item-2', purchaseUnitPrice: '2.4500', wholesaleUnitPriceExclVat: '2.9060', retailUnitPriceWithVat: '3.40', lowestPrice30Days: '3.40', currentStockQty: '210.0000', minStockQty: '50.0000', shelfLocation: 'B-02-01', needsLabelPrint: false, updatedAt: '2026-11-07T08:00:00Z' },
      { id: 'sip-2-2', storeId: 'store-2', itemId: 'item-2', purchaseUnitPrice: '2.4500', wholesaleUnitPriceExclVat: '2.9915', retailUnitPriceWithVat: '3.50', lowestPrice30Days: '3.40', currentStockQty: '120.0000', minStockQty: '30.0000', shelfLocation: 'B-02-01', needsLabelPrint: false, updatedAt: '2026-11-07T08:00:00Z' },
      { id: 'sip-3-2', storeId: 'store-3', itemId: 'item-2', purchaseUnitPrice: '2.4500', wholesaleUnitPriceExclVat: '2.9060', retailUnitPriceWithVat: '2.91', lowestPrice30Days: '2.91', currentStockQty: '600.0000', minStockQty: '100.0000', shelfLocation: 'WH-B-02', needsLabelPrint: false, updatedAt: '2026-11-07T08:00:00Z' },
    ];
  }
  if (spec.id === 'item-3') {
    return [
      { id: 'sip-1-3', storeId: 'store-1', itemId: 'item-3', purchaseUnitPrice: '1.6500', wholesaleUnitPriceExclVat: '1.9658', retailUnitPriceWithVat: '2.30', lowestPrice30Days: '2.25', currentStockQty: '95.0000', minStockQty: '40.0000', shelfLocation: 'H-01-01', needsLabelPrint: false, updatedAt: '2026-11-07T08:00:00Z' },
      { id: 'sip-2-3', storeId: 'store-2', itemId: 'item-3', purchaseUnitPrice: '1.6500', wholesaleUnitPriceExclVat: '2.0085', retailUnitPriceWithVat: '2.35', lowestPrice30Days: '2.30', currentStockQty: '54.0000', minStockQty: '25.0000', shelfLocation: 'H-01-02', needsLabelPrint: false, updatedAt: '2026-11-07T08:00:00Z' },
      { id: 'sip-3-3', storeId: 'store-3', itemId: 'item-3', purchaseUnitPrice: '1.6500', wholesaleUnitPriceExclVat: '1.9658', retailUnitPriceWithVat: '1.97', lowestPrice30Days: '1.97', currentStockQty: '320.0000', minStockQty: '60.0000', shelfLocation: 'WH-H-01', needsLabelPrint: false, updatedAt: '2026-11-07T08:00:00Z' },
    ];
  }
  if (spec.id === 'item-4') {
    return [
      { id: 'sip-1-4', storeId: 'store-1', itemId: 'item-4', purchaseUnitPrice: '2.3000', wholesaleUnitPriceExclVat: '2.6923', retailUnitPriceWithVat: '3.15', lowestPrice30Days: '3.10', currentStockQty: '82.0000', minStockQty: '25.0000', shelfLocation: 'B-03-04', needsLabelPrint: true, updatedAt: '2026-11-07T08:00:00Z' },
      { id: 'sip-2-4', storeId: 'store-2', itemId: 'item-4', purchaseUnitPrice: '2.3000', wholesaleUnitPriceExclVat: '2.7350', retailUnitPriceWithVat: '3.20', lowestPrice30Days: '3.15', currentStockQty: '65.0000', minStockQty: '20.0000', shelfLocation: 'B-03-02', needsLabelPrint: false, updatedAt: '2026-11-07T08:00:00Z' },
      { id: 'sip-3-4', storeId: 'store-3', itemId: 'item-4', purchaseUnitPrice: '2.3000', wholesaleUnitPriceExclVat: '2.6923', retailUnitPriceWithVat: '2.69', lowestPrice30Days: '2.69', currentStockQty: '500.0000', minStockQty: '80.0000', shelfLocation: 'WH-B-03', needsLabelPrint: false, updatedAt: '2026-11-07T08:00:00Z' },
    ];
  }
  if (spec.id === 'item-5') {
    return [
      { id: 'sip-1-5', storeId: 'store-1', itemId: 'item-5', purchaseUnitPrice: '0.6500', wholesaleUnitPriceExclVat: '1.0256', retailUnitPriceWithVat: '1.20', lowestPrice30Days: '1.20', currentStockQty: '64.0000', minStockQty: '20.0000', shelfLocation: 'P-01-01', needsLabelPrint: false, updatedAt: '2026-11-07T08:00:00Z' },
      { id: 'sip-2-5', storeId: 'store-2', itemId: 'item-5', purchaseUnitPrice: '0.6500', wholesaleUnitPriceExclVat: '1.0684', retailUnitPriceWithVat: '1.25', lowestPrice30Days: '1.20', currentStockQty: '40.0000', minStockQty: '15.0000', shelfLocation: 'P-01-01', needsLabelPrint: false, updatedAt: '2026-11-07T08:00:00Z' },
      { id: 'sip-3-5', storeId: 'store-3', itemId: 'item-5', purchaseUnitPrice: '0.6500', wholesaleUnitPriceExclVat: '1.0256', retailUnitPriceWithVat: '1.03', lowestPrice30Days: '1.03', currentStockQty: '200.0000', minStockQty: '30.0000', shelfLocation: 'WH-P-01', needsLabelPrint: false, updatedAt: '2026-11-07T08:00:00Z' },
    ];
  }
  if (spec.id === 'item-6') {
    return [
      { id: 'sip-1-6', storeId: 'store-1', itemId: 'item-6', purchaseUnitPrice: '0.8800', wholesaleUnitPriceExclVat: '1.1538', retailUnitPriceWithVat: '1.35', lowestPrice30Days: '1.30', currentStockQty: '180.0000', minStockQty: '60.0000', shelfLocation: 'C-04-02', needsLabelPrint: false, updatedAt: '2026-11-07T08:00:00Z' },
      { id: 'sip-2-6', storeId: 'store-2', itemId: 'item-6', purchaseUnitPrice: '0.8800', wholesaleUnitPriceExclVat: '1.1966', retailUnitPriceWithVat: '1.40', lowestPrice30Days: '1.35', currentStockQty: '95.0000', minStockQty: '30.0000', shelfLocation: 'C-04-01', needsLabelPrint: false, updatedAt: '2026-11-07T08:00:00Z' },
      { id: 'sip-3-6', storeId: 'store-3', itemId: 'item-6', purchaseUnitPrice: '0.8800', wholesaleUnitPriceExclVat: '1.1538', retailUnitPriceWithVat: '1.15', lowestPrice30Days: '1.15', currentStockQty: '800.0000', minStockQty: '100.0000', shelfLocation: 'WH-C-04', needsLabelPrint: false, updatedAt: '2026-11-07T08:00:00Z' },
    ];
  }

  const retail2 = new Decimal(spec.mpc).times('1.03').toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  const wholesale2 = calculateWholesale(retail2);

  return [
    {
      id: `sip-1-${itemIndex}`,
      storeId: 'store-1',
      itemId: spec.id,
      purchaseUnitPrice: spec.nc,
      wholesaleUnitPriceExclVat: wholesale1,
      retailUnitPriceWithVat: spec.mpc,
      lowestPrice30Days: spec.mpc,
      currentStockQty: stock1,
      minStockQty: '20.0000',
      shelfLocation: spec.shelf,
      needsLabelPrint: false,
      updatedAt: '2026-11-07T08:00:00Z',
    },
    {
      id: `sip-2-${itemIndex}`,
      storeId: 'store-2',
      itemId: spec.id,
      purchaseUnitPrice: spec.nc,
      wholesaleUnitPriceExclVat: wholesale2,
      retailUnitPriceWithVat: retail2,
      lowestPrice30Days: spec.mpc,
      currentStockQty: stock2,
      minStockQty: '15.0000',
      shelfLocation: spec.shelf,
      needsLabelPrint: false,
      updatedAt: '2026-11-07T08:00:00Z',
    },
    {
      id: `sip-3-${itemIndex}`,
      storeId: 'store-3',
      itemId: spec.id,
      purchaseUnitPrice: spec.nc,
      wholesaleUnitPriceExclVat: wholesale1,
      retailUnitPriceWithVat: new Decimal(wholesale1).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
      lowestPrice30Days: wholesale1,
      currentStockQty: stock3,
      minStockQty: '50.0000',
      shelfLocation: `WH-${spec.shelf}`,
      needsLabelPrint: false,
      updatedAt: '2026-11-07T08:00:00Z',
    },
  ];
});
