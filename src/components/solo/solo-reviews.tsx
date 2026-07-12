"use client";

import * as React from "react";

import { useAuth } from "@/components/auth/auth-context";
import { ReviewsSection } from "@/components/listings/reviews-section";
import { hasAcceptedConnectionWith } from "@/lib/solo";

/**
 * Reviews for a solo traveller. Uses the shared `reviews` table (keyed by the
 * traveller id), so ratings, owner replies and new-review notifications all
 * work like every other module. Only travellers with an accepted connection
 * (i.e. actually travelled/planned together) may post — verified reviews only.
 */
export function SoloReviews({
  travelerId,
  ownerEmail,
  travelerName,
}: {
  travelerId: string;
  ownerEmail: string | null;
  travelerName: string;
}) {
  const { user } = useAuth();
  const [canReview, setCanReview] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    if (!user || !ownerEmail) {
      setCanReview(false);
      return;
    }
    hasAcceptedConnectionWith(user.email, ownerEmail).then((v) => {
      if (alive) setCanReview(v);
    });
    return () => {
      alive = false;
    };
  }, [user, ownerEmail]);

  return (
    <ReviewsSection
      itemId={travelerId}
      canReview={canReview}
      ownerEmail={ownerEmail}
      providerName={travelerName}
    />
  );
}
