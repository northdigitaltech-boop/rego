import Link from "next/link";
import { FileText } from "lucide-react";

import { partnerTerms } from "@/lib/site";

/* ============================================================
 * Commercial terms a business sees BEFORE creating a partner
 * account (launch review P1-7: no fees or commission were shown).
 *
 * Values come from partnerTerms in lib/site.ts. Any figure the owner
 * has not supplied yet is shown as "confirmed in writing before your
 * listing goes live" — never an invented number. Registration itself
 * costs nothing: no payment is taken at sign-up.
 * ============================================================ */
export function PartnerTermsBox() {
  const pending = "Confirmed in writing before your listing goes live";
  const rows: [string, string][] = [
    ["Registration", "Free — no payment is taken to sign up"],
    ["Commission", partnerTerms.commission ?? pending],
    ["Listing fee", partnerTerms.listingFee ?? pending],
    ["Payouts", partnerTerms.payoutTiming ?? pending],
    [
      "Cancellations",
      "You publish your own cancellation terms; if you cancel, you are responsible for the guest's refund",
    ],
  ];
  return (
    <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-3 text-xs">
      <p className="flex items-center gap-1.5 font-semibold text-forest">
        <FileText className="h-3.5 w-3.5" /> Partner terms
      </p>
      <dl className="mt-2 space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[96px_1fr] gap-2">
            <dt className="font-semibold text-forest/80">{k}</dt>
            <dd className="text-muted-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-muted-foreground">
        Full terms:{" "}
        <Link href="/legal/provider-agreement" target="_blank" className="font-semibold text-forest-600 underline-offset-2 hover:underline">
          Provider Agreement
        </Link>
      </p>
    </div>
  );
}
