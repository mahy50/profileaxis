// TradeBomItem — BOM line item mapped to supplier catalog SKUs (M1)
// Aligned with packages/bom types (P0-008)

export interface TradeBomItem {
  sku: string;
  supplierId: string;
  quantity: number;
  unitPrice: number;
  leadTimeDays: number;
  totalCost: number;
  mappingStatus: 'mapped' | 'unmapped' | 'ambiguous';
  designBomItemIds: string[];
}
