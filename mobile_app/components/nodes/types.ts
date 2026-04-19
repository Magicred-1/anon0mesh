import { FILTERS } from './constants';

export interface NodeData {
  handle: string;
  hops: number;
  iface: 'TCP' | 'BLE' | 'RNode';
  signal: number;
  latency: string;
  beacon?: boolean;
  online?: boolean;
  weak?: boolean;
}

export type Filter = typeof FILTERS[number];
