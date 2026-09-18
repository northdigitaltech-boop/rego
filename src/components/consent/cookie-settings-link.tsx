"use client";

import { resetConsent } from "@/lib/consent";

/* ============================================================
 * "Cookie settings" in the footer.
 *
 * Withdrawing consent has to be as easy as giving it — that is
 * the rule, not a courtesy. Without a way back, the banner is a
 * one-way gate and the consent it collected is not valid.
 *
 * Clearing the choice also deletes the visitor id and the GA
 * cookies (see clearAnalyticsStorage in lib/consent), so this is
 * a real withdrawal rather than a flag that stops future writes
 * while the identifier sits there.
 *
 * The banner then reappears, because the answer is genuinely
 * unknown again — which is the honest state after someone asks
 * to be forgotten.
 * ============================================================ */

export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={resetConsent}
      className={className}
    >
      Cookie settings
    </button>
  );
}
