"use client";

import * as React from "react";

import { useAuth } from "@/components/auth/auth-context";
import { ReviewsSection } from "@/components/listings/reviews-section";
import { hasAcceptedCoworkingBooking } from "@/lib/coworking";

/**
 * Wraps the shared ReviewsSection for a co-working space: reviews live in the
 * shared `reviews` table (keyed by the space id), so ratings, owner replies and
 * new-review notifications all work like every other module.
 */
export function CoworkingReviews({
  spaceId,
  ownerEmail,
  spaceName,
}: {
  spaceId: string;
  ownerEmail: string | null;
  spaceName: string;
}) {
  const { user } = useAuth();
  const [canReview, setCanReview] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    if (!user) {
      setCanReview(false);
      return;
    }
    hasAcceptedCoworkingBooking(user.email, spaceId).then((v) => {
      if (alive) setCanReview(v);
    });
    return () => {
      alive = false;
    };
  }, [user, spaceId]);

  return (
    <ReviewsSection
      itemId={spaceId}
      canReview={canReview}
      ownerEmail={ownerEmail}
      providerName={spaceName}
    />
  );
}
