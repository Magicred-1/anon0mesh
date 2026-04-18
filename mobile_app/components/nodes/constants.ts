export const NODES = [
  { handle: '@beacon_prime', hops: 0, iface: 'TCP',   signal: 4, beacon: true, latency: '12ms'  },
  { handle: '@node_a1b2',    hops: 1, iface: 'TCP',   signal: 4,               latency: '48ms'  },
  { handle: '@node_7f3a',    hops: 3, iface: 'RNode', signal: 3, online: true,  latency: '112ms' },
  { handle: '@node_c91d',    hops: 2, iface: 'BLE',   signal: 3,               latency: '89ms'  },
  { handle: '@relay_e2f0',   hops: 4, iface: 'RNode', signal: 2,               latency: '340ms' },
  { handle: '@node_44ab',    hops: 2, iface: 'BLE',   signal: 3,               latency: '76ms'  },
  { handle: '@sensor_9812',  hops: 5, iface: 'RNode', signal: 1, weak: true,   latency: '612ms' },
] as const;

export const MAP_W = 320;
export const MAP_H = 270;

// index order matches MAP_EDGES references:
// 0=beacon, 1=a1b2, 2=44ab, 3=7f3a, 4=c91d, 5=e2f0, 6=9812
export const MAP_NODES = [
  { x: 160, y: 35,  handle: '@beacon_prime', label: 'beacon', tone: 'green' as const, r: 5,   ring: true },
  { x: 100, y: 88,  handle: '@node_a1b2',    label: 'a1b2',  tone: 'green' as const, r: 3.5             },
  { x: 218, y: 88,  handle: '@node_44ab',    label: '44ab',  tone: 'green' as const, r: 3.5             },
  { x: 70,  y: 188, handle: '@node_7f3a',    label: '7f3a',  tone: 'green' as const, r: 3.5             },
  { x: 160, y: 132, handle: '@node_c91d',    label: 'c91d',  tone: 'dim'   as const, r: 3.5             },
  { x: 248, y: 192, handle: '@relay_e2f0',   label: 'e2f0',  tone: 'dim'   as const, r: 3               },
  { x: 158, y: 238, handle: '@sensor_9812',  label: '9812',  tone: 'muted' as const, r: 2.5             },
];

export const MAP_EDGES = [[0,1],[0,2],[1,3],[1,4],[2,4],[2,5],[3,6],[4,6],[5,6]];

export const MAP_CLUSTERS = [
  { label: 'BEACON',    x: 136, y: 13,  w: 48,  h: 44,  r: 22, color: 'cyan' as const },
  { label: 'CLUSTER_A', x: 72,  y: 65,  w: 174, h: 85,  r: 14, color: 'cyan' as const },
  { label: 'CLUSTER_B', x: 38,  y: 162, w: 244, h: 94,  r: 14, color: 'dim'  as const },
];

// Pulse path: beacon(160,35)→a1b2(100,88)→7f3a(70,188)
const PULSE_SEG0 = Math.hypot(160-100, 35-88);
const PULSE_SEG1 = Math.hypot(100-70,  88-188);
export const PULSE_T1 = PULSE_SEG0 / (PULSE_SEG0 + PULSE_SEG1);

export const FILTERS = ['all', 'TCP', 'BLE', 'RNode'] as const;
