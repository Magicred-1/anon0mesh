export function parseBaseUnits(amount: string, decimals: number): bigint {
  const normalized = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("Invalid amount");
  }

  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > decimals) {
    throw new Error("Too many decimal places for this token");
  }

  const units = `${whole}${fraction.padEnd(decimals, "0")}`.replace(/^0+(?=\d)/, "");
  const value = BigInt(units || "0");
  if (value <= 0n) {
    throw new Error("Invalid amount");
  }
  return value;
}
