/** Converts a duration in seconds to a compact human-readable string. */
export function formatAgo(diffSec: number): string {
  if (diffSec < 5)     return 'now';
  if (diffSec < 60)    return `${Math.round(diffSec)}s`;
  if (diffSec < 3600)  return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  return `${Math.floor(diffSec / 86400)}d`;
}
