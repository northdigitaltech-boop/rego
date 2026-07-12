"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import {
  getSoloByOwner,
  compatibilityScore,
  type SoloTravelerRow,
} from "@/lib/solo";

/**
 * Compatibility score between the signed-in viewer's own traveller profile and
 * the profile being viewed. Only shows when the viewer has a profile of their
 * own to compare against.
 */
export function SoloCompatibility({ target }: { target: SoloTravelerRow }) {
  const { user } = useAuth();
  const [score, setScore] = React.useState<number | null>(null);

  React.useEffect(() => {
    let alive = true;
    if (!user) return;
    getSoloByOwner(user.email).then((mine) => {
      if (!alive || !mine || mine.id === target.id) return;
      setScore(compatibilityScore(mine, target));
    });
    return () => {
      alive = false;
    };
  }, [user, target]);

  if (score == null) return null;

  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Sparkles className="h-4 w-4 text-gold" /> Compatibility
      </span>
      <span className="font-semibold text-forest">{score}%</span>
    </div>
  );
}
