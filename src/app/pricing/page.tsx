import { Suspense } from "react";

import { PricingClient } from "@/components/subscription/pricing-client";

// Pricing is gated at runtime (settings + role); keep it out of the sitemap and
// don't let it be statically prerendered as a public page.
export const metadata = { robots: { index: false, follow: false } };

export default function PricingPage() {
  return (
    <Suspense fallback={null}>
      <PricingClient />
    </Suspense>
  );
}
