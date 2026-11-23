/* Mirrors phase140: a price above 0 and under PKR 500 is almost always a
   typo (missing zeros, or a per-km rate typed into a per-day box). The
   database holds such a listing for admin review; this asks the partner
   first, so they can fix it before it ever leaves the site. */
export const LOW_PRICE_LIMIT = 500;

export function isImplausiblyLow(price: number): boolean {
  return Number.isFinite(price) && price > 0 && price < LOW_PRICE_LIMIT;
}

/** true = go ahead and save. */
export function confirmLowPrice(prices: number[]): boolean {
  const low = prices.find(isImplausiblyLow);
  if (low === undefined || typeof window === "undefined") return true;
  return window.confirm(
    `PKR ${low} looks very low for this listing. Is a zero missing?\n\n` +
      `Press Cancel to fix the price. If you save it, it will be hidden from ` +
      `the website until the Rego team checks it.`
  );
}
