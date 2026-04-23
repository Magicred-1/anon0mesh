// Mock wallet activity for the Recent list until the wallet layer emits
// real tx history (Phase 7 / teammate's lane).
//
// HARD RULE: this file is ONLY imported by dev tools or by the
// RecentActivity component under an `if (__DEV__)` check. Never import
// from production code paths that will ship live.

export type MockActivityStatus = "Settled" | "Handed to mesh" | "Queued on device";
export type MockActivityDirection = "send" | "receive";

export interface MockActivity {
  id: string;
  direction: MockActivityDirection;
  counterparty: string;
  amount: string;
  symbol: "SOL" | "USDC";
  status: MockActivityStatus;
  createdAt: number; // unix ms
}

const NOW = Date.now();
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const MOCK_ACTIVITY: MockActivity[] = [
  {
    id: "tx_01",
    direction: "receive",
    counterparty: "@zero_wolf_3760",
    amount: "0.25",
    symbol: "SOL",
    status: "Settled",
    createdAt: NOW - 12 * MIN,
  },
  {
    id: "tx_02",
    direction: "send",
    counterparty: "9A8u…kP8fH",
    amount: "150.00",
    symbol: "USDC",
    status: "Settled",
    createdAt: NOW - 2 * HOUR,
  },
  {
    id: "tx_03",
    direction: "send",
    counterparty: "@mesh_lynx_814",
    amount: "1.500",
    symbol: "SOL",
    status: "Handed to mesh",
    createdAt: NOW - 45 * MIN,
  },
  {
    id: "tx_04",
    direction: "receive",
    counterparty: "@silent_jay",
    amount: "42.00",
    symbol: "USDC",
    status: "Settled",
    createdAt: NOW - 6 * HOUR,
  },
  {
    id: "tx_05",
    direction: "send",
    counterparty: "@offline_fox_221",
    amount: "0.005",
    symbol: "SOL",
    status: "Queued on device",
    createdAt: NOW - 18 * MIN,
  },
  {
    id: "tx_06",
    direction: "receive",
    counterparty: "@beacon_owl",
    amount: "3.200",
    symbol: "SOL",
    status: "Settled",
    createdAt: NOW - 1 * DAY,
  },
];
