"use client";

import * as React from "react";
import { trackViewOnce } from "@/lib/track";

/**
 * Drop-in view tracker for any listing/profile detail page. Fires a single
 * (de-duped) view event attributed to the listing owner so it shows in the
 * owner's CRM → Insights. Renders nothing.
 *
 * Usage (from a server or client page):
 *   <ViewTracker ownerEmail={row.owner_email} listingId={row.id} serviceType="hotels" />
 */
export function ViewTracker({
  ownerEmail,
  listingId,
  serviceType,
  eventType = "listing_view",
}: {
  ownerEmail: string | null;
  listingId: string;
  serviceType: string;
  eventType?: "listing_view" | "profile_view";
}) {
  React.useEffect(() => {
    if (!listingId) return;
    trackViewOnce({ ownerEmail, listingId, serviceType, eventType });
  }, [ownerEmail, listingId, serviceType, eventType]);
  return null;
}
