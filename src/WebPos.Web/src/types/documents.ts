import type {
  DocumentStatus,
  OtherWarehouseDocSubtype,
  PaymentMethod,
  PosReceiptType,
} from './domain';

export interface CalculationLine {
  id: string;
  itemId: string;
  quantity: string;
  supplierUnitPrice: string;
  discountPercent: string;
  netSupplierUnitPrice: string;
  dependentCostPerUnit: string;
  purchaseUnitPrice: string;
  purchaseTotalValue: string;
  marginPercent: string;
  marginUnitAmount: string;
  marginTotalAmount: string;
  sellingUnitPriceExclVat: string;
  sellingTotalValueExclVat: string;
  vatRatePercent: string;
  embeddedVatUnitAmount: string;
  embeddedVatTotalAmount: string;
  retailUnitPriceWithVat: string;
  retailTotalValueWithVat: string;
}

export interface CalculationDocument {
  id: string;
  companyId: string;
  fiscalYearId: string;
  storeId: string;
  docNumber: string;
  docDate: string;
  postingDate?: string;
  partnerId: string;
  supplierInvoiceNumber: string;
  supplierInvoiceDate: string;
  status: DocumentStatus;
  reversedByDocId?: string;
  reversalOfDocId?: string;
  dueDate?: string;
  receiptDate?: string;
  ztrFreight?: string;
  ztrCustoms?: string;
  ztrHandling?: string;
  ztrOther?: string;
  ztrAllocationMethod?: 'VALUE' | 'QUANTITY';
  notes: string;
  lines: CalculationLine[];
  totalPurchaseValue: string;
  totalMarginAmount: string;
  totalSellingValueExclVat: string;
  totalEmbeddedVatAmount: string;
  totalRetailValueWithVat: string;
  createdBy: string;
  createdAt: string;
}

export interface PriceLevelingLine {
  id: string;
  itemId: string;
  stockQuantity: string;
  oldRetailPriceWithVat: string;
  newRetailPriceWithVat: string;
  vatRatePercent: string;
  oldTotalRetailValue: string;
  newTotalRetailValue: string;
  totalRetailDifference: string;
  embeddedVatDifference: string;
  marginDifference: string;
}

export interface PriceLevelingDocument {
  id: string;
  companyId: string;
  fiscalYearId: string;
  storeId: string;
  docNumber: string;
  docDate: string;
  postingDate?: string;
  status: DocumentStatus;
  reversedByDocId?: string;
  reversalOfDocId?: string;
  reason: string;
  lines: PriceLevelingLine[];
  totalRetailDifference: string;
  totalVatDifference: string;
  totalMarginDifference: string;
  createdBy: string;
  createdAt: string;
}

export interface TransferLine {
  id: string;
  itemId: string;
  quantity: string;
  purchaseUnitPrice: string;
  purchaseTotalValue: string;
  sourceRetailUnitPrice: string;
  sourceRetailTotalValue: string;
  targetRetailUnitPrice: string;
  targetRetailTotalValue: string;
  vatRatePercent: string;
}

export interface TransferDocument {
  id: string;
  companyId: string;
  fiscalYearId: string;
  sourceStoreId: string;
  targetStoreId: string;
  docNumber: string;
  docDate: string;
  postingDate?: string;
  status: DocumentStatus;
  reversedByDocId?: string;
  reversalOfDocId?: string;
  notes: string;
  lines: TransferLine[];
  totalPurchaseValue: string;
  totalSourceRetailValue: string;
  totalTargetRetailValue: string;
  createdBy: string;
  createdAt: string;
}

export interface InventoryCountLine {
  id: string;
  itemId: string;
  bookQuantity: string;
  countedQuantity: string;
  differenceQuantity: string;
  purchaseUnitPrice: string;
  retailUnitPriceWithVat: string;
  vatRatePercent: string;
  surplusRetailValue: string;
  shortageRetailValue: string;
  allowedWasteQuantity?: string;
  allowedWasteRetailValue?: string;
  unrecognizedShortageQuantity?: string;
  unrecognizedShortageRetailValue?: string;
  unrecognizedShortageVat?: string;
}

export interface InventoryCountDocument {
  id: string;
  companyId: string;
  fiscalYearId: string;
  storeId: string;
  docNumber: string;
  docDate: string;
  postingDate?: string;
  status: DocumentStatus;
  reversedByDocId?: string;
  reversalOfDocId?: string;
  commissionMembers: string;
  notes: string;
  lines: InventoryCountLine[];
  totalSurplusRetailValue: string;
  totalShortageRetailValue: string;
  totalAllowedWasteValue?: string;
  totalUnrecognizedShortageValue?: string;
  totalUnrecognizedShortageVat?: string;
  createdBy: string;
  createdAt: string;
}

export interface OtherWarehouseLine {
  id: string;
  itemId: string;
  quantity: string;
  purchaseUnitPrice: string;
  purchaseTotalValue: string;
  retailUnitPriceWithVat: string;
  retailTotalValueWithVat: string;
  vatRatePercent: string;
}

export interface OtherWarehouseDocument {
  id: string;
  companyId: string;
  fiscalYearId: string;
  storeId: string;
  docNumber: string;
  docDate: string;
  postingDate?: string;
  subtype: OtherWarehouseDocSubtype;
  partnerId?: string;
  status: DocumentStatus;
  reversedByDocId?: string;
  reversalOfDocId?: string;
  notes: string;
  lines: OtherWarehouseLine[];
  totalPurchaseValue: string;
  totalRetailValueWithVat: string;
  createdBy: string;
  createdAt: string;
}

export interface PosReceiptLine {
  id: string;
  itemId: string;
  scannedBarcode: string;
  quantity: string;
  purchaseUnitPrice: string;
  retailUnitPriceWithVat: string;
  discountPercent: string;
  vatRatePercent: string;
  lineTotalWithVat: string;
  lineNetExclVat: string;
  lineVatAmount: string;
}

export interface PosReceipt {
  id: string;
  companyId: string;
  fiscalYearId: string;
  storeId: string;
  terminalId: string;
  receiptNumber: string;
  fiscalNumber: string;
  receiptType: PosReceiptType;
  referenceReceiptId?: string;
  referenceFiscalNumber?: string;
  partnerId?: string;
  paymentMethod: PaymentMethod;
  cashReceivedAmount: string;
  cardAmount: string;
  wireAmount: string;
  changeAmount: string;
  subtotalGrossBeforeDiscount: string;
  totalDiscountAmount: string;
  totalNetExclVat: string;
  totalVatAmount: string;
  totalGrossAmount: string;
  totalCostOfGoodsSold: string;
  realizedMarginAmount: string;
  lines: PosReceiptLine[];
  cashierName: string;
  issuedAt: string;
  status: DocumentStatus;
}
