/** Formats a dollar amount for display, e.g. `40000` -> `"$40,000"`, `-26000` -> `"-$26,000"`. */
export function formatUsd(amount: number): string {
  const formatted = `$${Math.abs(amount).toLocaleString('en-US')}`;
  return amount < 0 ? `-${formatted}` : formatted;
}
