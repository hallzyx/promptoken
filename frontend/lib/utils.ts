/**
 * Truncates an Ethereum address for display.
 * @param address - The full address (0x-prefixed).
 * @returns Truncated form like 0x1234...5678.
 */
export function truncateAddress(address: string): string {
  if (!address) return "";
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Formats a wei value as a human-readable 0G string with 4 decimal places.
 * @param wei - The amount in wei.
 * @returns Formatted string like "1.2345 0G".
 */
export function formatEther(wei: bigint): string {
  const divisor = 10_000_000_000_000_000n; // 10^16 — gives 4 decimal places
  const whole = wei / divisor;
  const fraction = wei % divisor;
  const fractionStr = fraction.toString().padStart(16, "0").slice(0, 4);
  return `${whole.toString()}.${fractionStr} 0G`;
}

/**
 * Formats a Unix timestamp (seconds) to a human-readable date string.
 * @param timestamp - Block timestamp in seconds as a bigint.
 * @returns Localized date string.
 */
export function formatDate(timestamp: bigint): string {
  const ms = Number(timestamp) * 1000;
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
