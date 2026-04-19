// TradeBomItem — BOM line item mapped to supplier catalog SKUs (M1)

export type MappingStatus = 'mapped' | 'unmapped' | 'partial';

export interface TradeBomItem {
  itemId: string;
  sku: string | null;
  supplierCode: string;
  productName: string;
  description: string;
  quantity: number;
  unit: 'pcs' | 'm' | 'kg';
  unitPrice: number | null;
  currency: string;
  leadTimeDays: number | null;
  mappingStatus: MappingStatus;
  matchedDesignItemIds: string[]; // links to DesignBomItem.itemId
}
