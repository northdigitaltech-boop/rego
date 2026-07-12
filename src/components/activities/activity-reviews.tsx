"use client";

import * as React from "react";

import { useAuth } from "@/components/auth/auth-context";
import { ReviewsSection } from "@/components/listings/reviews-section";
import { hasAcceptedActivityBooking } from "@/lib/activities";

export function ActivityReviews({
  activityId,
  ownerEmail,
  title,
}: {
  activityId: string;
  ownerEmail: string | null;
  title: string;
}) {
  const { user } = useAuth();
  const [canReview, setCanReview] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    if (!user) {
      setCanReview(false);
      return;
    }
    hasAcceptedActivityBooking(user.email, activityId).then((v) => {
      if (alive) setCanReview(v);
    });
    return () => {
      alive = false;
    };
  }, [user, activityId]);
  return <ReviewsSection itemId={activityId} canReview={canReview} ownerEmail={ownerEmail} providerName={title} />;
}
