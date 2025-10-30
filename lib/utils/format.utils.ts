import { NormalTokenFormat } from "../types/format.types";
/**
 * Format a Normal Token (prefixed with 'n') based on the desired output.
 *
 * @param input - The token name, e.g., "nBTC", "BTC"
 * @param format - Desired output format: "with-n" or "without-n"
 * @returns The formatted token name
 */

export function formatNormalToken(
  input: string,
  format: NormalTokenFormat
): string {
  const hasPrefix = input.startsWith("n");

  if (input === "XLM") {
    return "XLM";
  }

  if (input === "USDC") {
    return "USDC";
  }

  if (format === "with-n") {
    return hasPrefix ? input : `n${input}`;
  } else if (format === "without-n") {
    return hasPrefix ? input.slice(1) : input;
  } else {
    throw new Error(`Invalid format type: ${format}`);
  }
}
