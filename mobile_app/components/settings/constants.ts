export type PairedDevice = { id: string; name: string; rssi: number; serial: string } | null;

export const DEVICES = [
  { id: 'rnode_001', name: 'RNode · 410MHz', rssi: -42, serial: 'RN-914-4f2a' },
  { id: 'rnode_002', name: 'RNode · 868MHz', rssi: -61, serial: 'RN-868-9c1b' },
  { id: 'rnode_003', name: 'LilyGO T-Beam',  rssi: -74, serial: 'TB-2c1d-7f09' },
];

export const HANDSHAKE_LINES = [
  'connecting over ble…',
  'negotiating keys…',
  'verifying reticulum identity…',
];
