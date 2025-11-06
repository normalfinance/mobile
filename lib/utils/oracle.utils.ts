
export interface PriceData {
  price: bigint;
  timestamp: number;
}

// Format token amount with oracle decimals (same as web app)
export function formatTokenAmount(amount: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const quotient = amount / divisor;
  const remainder = amount % divisor;

  if (remainder === BigInt(0)) {
    return quotient.toString();
  }

  const remainderStr = remainder.toString().padStart(decimals, "0");
  const trimmedRemainder = remainderStr.replace(/0+$/, "");

  return trimmedRemainder
    ? `${quotient}.${trimmedRemainder}`
    : quotient.toString();
}
