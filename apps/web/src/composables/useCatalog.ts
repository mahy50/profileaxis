import type { ProfileSpec, ConnectorSpec } from '@profileaxis/modeler';

// Inline catalog data (mirrors stdlib fixtures) to avoid Node readFileSync in browser builds
const profiles: ProfileSpec[] = [
  {
    profileKey: 'PA-UC90-70-2.5',
    seriesName: 'UC90',
    crossSection: 'C-channel',
    dimensions: { widthMm: 90, heightMm: 70, wallThicknessMm: 2.5 },
    material: 'Q355 steel',
    weightKgPerM: 5.24,
    loadRatingN: 85000,
    finishOptions: [
      { finishKey: 'FZ-pre galvanized', description: 'Pre-galvanized (Z275 g/m²), interior use' },
      { finishKey: 'PP-RAL5015', description: 'Powder-coated RAL 5015 sky blue' },
      { finishKey: 'PP-RAL6011', description: 'Powder-coated RAL 6011 reseda green' },
      { finishKey: 'EP-electrophoretic', description: 'Electrophoretic dip coating' },
    ],
  },
  {
    profileKey: 'PB-SB60-40-2.0',
    seriesName: 'SB60',
    crossSection: 'C-channel step beam',
    dimensions: { widthMm: 60, heightMm: 40, wallThicknessMm: 2.0 },
    material: 'Q355 steel',
    weightKgPerM: 2.87,
    loadRatingN: 32000,
    finishOptions: [
      { finishKey: 'FZ-pre galvanized', description: 'Pre-galvanized (Z275 g/m²)' },
      { finishKey: 'PP-RAL5015', description: 'Powder-coated RAL 5015 sky blue' },
      { finishKey: 'PP-RAL7035', description: 'Powder-coated RAL 7035 light grey' },
    ],
  },
  {
    profileKey: 'PC-AI50-50-3',
    seriesName: 'AI50',
    crossSection: 'equal angle iron',
    dimensions: { widthMm: 50, heightMm: 50, wallThicknessMm: 3.0 },
    material: 'Q235 steel',
    weightKgPerM: 2.33,
    loadRatingN: 15000,
    finishOptions: [
      { finishKey: 'FZ-pre galvanized', description: 'Pre-galvanized (Z275 g/m²)' },
      { finishKey: 'PP-RAL7042', description: 'Powder-coated RAL 7042 traffic grey B' },
    ],
  },
];

const connectors: ConnectorSpec[] = [
  {
    connectorKey: 'JC3-CORNER',
    connectorFamilyKey: 'corner-3way',
    topology: 'corner-3way',
    compatibleProfileKeys: ['PA-UC90-70-2.5', 'PB-SB60-40-2.0'],
    hardwareItems: [
      { partNumber: 'Bolt-M8x25-10.9', description: 'M8×25 10.9级高强度螺栓', quantity: 4 },
      { partNumber: 'Nut-M8-10', description: 'M8 10级自锁螺母', quantity: 4 },
      { partNumber: 'Washer-M8-200HV', description: 'M8 200HV平垫圈', quantity: 8 },
    ],
  },
  {
    connectorKey: 'JC3-TEE',
    connectorFamilyKey: 'tee-3way',
    topology: 'tee-3way',
    compatibleProfileKeys: ['PA-UC90-70-2.5', 'PB-SB60-40-2.0', 'PC-AI50-50-3'],
    hardwareItems: [
      { partNumber: 'Bolt-M8x30-10.9', description: 'M8×30 10.9级高强度螺栓', quantity: 6 },
      { partNumber: 'Nut-M8-10', description: 'M8 10级自锁螺母', quantity: 6 },
      { partNumber: 'Washer-M8-200HV', description: 'M8 200HV平垫圈', quantity: 12 },
    ],
  },
  {
    connectorKey: 'JC4-CROSS',
    connectorFamilyKey: 'cross-4way',
    topology: 'cross-4way',
    compatibleProfileKeys: ['PA-UC90-70-2.5'],
    hardwareItems: [
      { partNumber: 'Bolt-M10x35-10.9', description: 'M10×35 10.9级高强度螺栓', quantity: 8 },
      { partNumber: 'Nut-M10-10', description: 'M10 10级自锁螺母', quantity: 8 },
      { partNumber: 'Washer-M10-200HV', description: 'M10 200HV平垫圈', quantity: 16 },
    ],
  },
  {
    connectorKey: 'JC3-BRACE-END',
    connectorFamilyKey: 'brace-end',
    topology: 'brace-end',
    compatibleProfileKeys: ['PC-AI50-50-3', 'PB-SB60-40-2.0'],
    hardwareItems: [
      { partNumber: 'Bolt-M8x20-10.9', description: 'M8×20 10.9级高强度螺栓', quantity: 2 },
      { partNumber: 'Nut-M8-10', description: 'M8 10级自锁螺母', quantity: 2 },
      { partNumber: 'Washer-M8-200HV', description: 'M8 200HV平垫圈', quantity: 4 },
    ],
  },
  {
    connectorKey: 'JC-FOOT',
    connectorFamilyKey: 'foot',
    topology: 'foot',
    compatibleProfileKeys: ['PA-UC90-70-2.5'],
    hardwareItems: [
      { partNumber: 'Bolt-M12x50-10.9', description: 'M12×50 10.9级化学锚栓', quantity: 4 },
      { partNumber: 'Nut-M12-10', description: 'M12 10级螺母', quantity: 4 },
      { partNumber: 'Washer-M12-200HV', description: 'M12 200HV平垫圈', quantity: 4 },
    ],
  },
];

export interface CatalogData {
  profiles: ProfileSpec[];
  connectors: ConnectorSpec[];
}

let _catalog: CatalogData | null = null;

export function getCatalog(): CatalogData {
  if (!_catalog) {
    _catalog = { profiles, connectors };
  }
  return _catalog;
}

export function useCatalog(): CatalogData {
  return getCatalog();
}
