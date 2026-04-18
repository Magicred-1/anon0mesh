export const ASSETS = [
  { sym: 'SOL',  name: 'Solana',     bal: '48.124',   usd: 9128.21, color: '#14F195', priv: true  },
  { sym: 'USDC', name: 'USDC (SPL)', bal: '2,184.50', usd: 2184.50, color: '#2775CA', priv: true  },
  { sym: 'JUP',  name: 'Jupiter',    bal: '1,420.00', usd: 612.60,  color: '#C7F284', priv: false },
  { sym: 'BONK', name: 'Bonk',       bal: '12.4M',    usd: 278.40,  color: '#FFB020', priv: false },
] as const;

export const TOTAL_USD = 12203.71;

export const VAULTS = [
  { name: 'marinade liquid stake', asset: 'SOL',  apy: 7.24,  tvl: '$1.1B', risk: 'low',    color: '#14F195', deposited: '12.50'    },
  { name: 'kamino usdc lending',   asset: 'USDC', apy: 8.42,  tvl: '$420M', risk: 'low',    color: '#2775CA', deposited: '1,200.00' },
  { name: 'jito restaking',        asset: 'SOL',  apy: 9.18,  tvl: '$680M', risk: 'medium', color: '#14F195', deposited: undefined   },
  { name: 'drift usdc vault',      asset: 'USDC', apy: 12.88, tvl: '$88M',  risk: 'medium', color: '#2775CA', deposited: undefined   },
] as const;
