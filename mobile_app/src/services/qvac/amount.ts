export function formatTransferAmountForRoute(amount: number, maxDecimals: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!Number.isInteger(maxDecimals) || maxDecimals < 0) return null;

  const formatted = amount.toLocaleString('en-US', {
    maximumFractionDigits: maxDecimals,
    minimumFractionDigits: 0,
    useGrouping: false,
  });

  if (!/^\d+(\.\d+)?$/.test(formatted)) return null;
  if (Number(formatted) <= 0) return null;
  return formatted;
}
