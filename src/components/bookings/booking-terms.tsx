import Link from "next/link";
import { Info } from "lucide-react";

/* ============================================================
 * What the traveller agrees to, shown ABOVE the "Book now" button.
 *
 * A launch review found bookings could be submitted without any
 * cancellation or terms shown first. This states, before submit,
 * exactly what the existing flow does — nothing more:
 *   • the booking is recorded with a reference and the provider is
 *     emailed (notifyBookingSubmitted);
 *   • nothing is charged at this step — payment is arranged on the
 *     next screen by the method the traveller picks;
 *   • cancellation follows the published policy, and the provider's
 *     own policy where one is set.
 * No "instant" or "guaranteed" claim, because payment and provider
 * availability are confirmed outside the site.
 * ============================================================ */
export function BookingTerms({
  providerPolicy,
}: {
  /** The provider's own cancellation text, when the listing has one. */
  providerPolicy?: string | null;
}) {
  const policy = providerPolicy?.trim();
  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
      <p className="flex gap-1.5">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest-600" />
        <span>
          You&apos;ll get a booking reference and the provider is notified by email.
          Nothing is charged now — you choose how to pay on the next step.
        </span>
      </p>
      {policy && (
        <p className="mt-1.5">
          <strong className="text-forest">Cancellation:</strong> {policy}
        </p>
      )}
      <p className="mt-1.5">
        By booking you agree to the{" "}
        <Link href="/legal/terms" className="font-semibold text-forest-600 underline-offset-2 hover:underline">
          Terms
        </Link>
        ,{" "}
        <Link href="/legal/booking" className="font-semibold text-forest-600 underline-offset-2 hover:underline">
          Booking Policy
        </Link>{" "}
        and{" "}
        <Link href="/legal/cancellation" className="font-semibold text-forest-600 underline-offset-2 hover:underline">
          Cancellation Policy
        </Link>
        .
      </p>
    </div>
  );
}
