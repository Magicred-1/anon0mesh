export const CYAN = '#00e5ff';
export const BG   = '#00080c';
export const DARK = '#041a1d';

const ADJECTIVES = ['silent','dark','ghost','cipher','void','mesh','zero','anon','relay','null'];
const NOUNS      = ['wolf','fox','raven','node','relay','cipher','mask','shade','hawk','drift'];

export function generateNickname(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const d = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `${a}_${n}_${d}`;
}
