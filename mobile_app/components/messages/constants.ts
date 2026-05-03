import type { AnyMsg } from './types';

export const DRAWER_W = 290;
export const BLUE     = '#2775CA';

export const ASSET_COLORS: Record<string, string> = {
  SOL: '#14F195', USDC: '#2775CA', JUP: '#C7F284', BONK: '#FFB020',
};

export const MESSAGES_SEED: AnyMsg[] = [
  { id: 1,  kind: 'sys',             text: 'Successfully connected to anonmesh network' },
  { id: 2,  from: 'node_7f3a', me: false, time: '02:41:07', text: 'package at dead drop. coords in next msg.', enc: true },
  { id: 3,  from: 'node_7f3a', me: false, time: '02:41:22', text: '48.8584°N 2.2945°E — 04:00 window', enc: true },
  { id: 4,  from: 'me',         me: true,  time: '02:42:05', text: 'received. confirming on-site relay is up.', enc: true },
  { id: 9,  kind: 'request-address', from: 'node_7f3a', me: false, time: '02:42:28', asset: 'USDC', note: 'for the relay fee' },
  { id: 10, kind: 'share-address',   from: 'me',         me: true,  time: '02:42:34', asset: 'USDC', address: '7xKq9...3hF2p' },
  { id: 11, kind: 'request-money',   from: 'node_7f3a', me: false, time: '02:42:40', asset: 'SOL',  amount: '2.50', note: 'drop fee + relay' },
  { id: 5,  kind: 'tx',              time: '02:42:48', txid: '5Qf9g..c2a1', to: 'node_7f3a', amount: '2.50', asset: 'SOL', shards: 3, total: 3 },
  { id: 6,  from: 'me',         me: true,  time: '02:42:51', text: 'escrow posted. release on drop confirmation.', enc: true },
  { id: 7,  from: 'node_7f3a', me: false, time: '02:44:12', text: 'ack. relay node_c91d just came online. going dark.', enc: true },
  { id: 8,  kind: 'sys',             text: 'node_7f3a went dark · last seen 02:44' },
];

export interface Peer {
  handle: string;
  hops: number;
  iface: string;
  online: boolean;
  unread: number;
  last: string;
  time: string;
  beacon: boolean;
  destHash?: string;
  isGroup?: boolean;
}

export const PEERS: Peer[] = [
  { handle: 'node_7f3a',    hops: 3, iface: 'RNode', online: true,  unread: 0, last: 'going dark. relay is up.',     time: '02:44', beacon: false },
  { handle: 'beacon_prime', hops: 0, iface: 'TCP',   online: true,  unread: 2, last: 'beacon broadcast · t+47min',  time: '02:41', beacon: true  },
  { handle: 'node_a1b2',    hops: 1, iface: 'TCP',   online: true,  unread: 0, last: 'route table synced.',          time: '02:18', beacon: false },
  { handle: 'node_c91d',    hops: 2, iface: 'BLE',   online: false, unread: 1, last: 'dropped. retrying via rnode…', time: '01:52', beacon: false },
  { handle: 'node_44ab',    hops: 2, iface: 'BLE',   online: true,  unread: 0, last: '0.5 sol received',             time: '23:41', beacon: false },
  { handle: 'relay_e2f0',   hops: 4, iface: 'RNode', online: true,  unread: 0, last: 'relay for node_7f3a',         time: '02:44', beacon: false },
  { handle: 'sensor_9812',  hops: 5, iface: 'RNode', online: false, unread: 0, last: 'telemetry batch · 412B',       time: '3d',    beacon: false },
];
