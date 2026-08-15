"use client";

import * as React from "react";
import { Check, Loader2, Sparkles } from "lucide-react";

import {
  progressStepsFor,
  STEP_INTERVAL_MS,
  type ProgressStep,
} from "@/lib/ai-progress";
import { cn } from "@/lib/utils";

/**
 * Live progress while Rego AI works.
 *
 * Advances one step at a time, but deliberately STOPS on the second-to-last
 * step: the final step only completes when a real answer arrives. That way
 * the list can never claim to be finished before the work is.
 */
export function AiThinkingSteps({ query }: { query: string }) {
  const steps: ProgressStep[] = React.useMemo(
    () => progressStepsFor(query),
    [query]
  );
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    setActive(0);
    if (steps.length <= 1) return;

    const id = window.setInterval(() => {
      setActive((i) => {
        // Hold on the last step rather than pretending we're done.
        const max = steps.length - 1;
        return i >= max ? max : i + 1;
      });
    }, STEP_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [steps]);

  return (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-forest text-gold">
        <Sparkles className="h-4 w-4 animate-pulse" />
      </span>

      <ul
        aria-live="polite"
        aria-busy="true"
        className="min-w-0 space-y-1.5 rounded-2xl border border-border/70 bg-card px-4 py-3"
      >
        {steps.slice(0, active + 1).map((s, i) => {
          const done = i < active;
          return (
            <li
              key={s.id}
              className={cn(
                "flex items-center gap-2 text-sm transition-colors",
                done ? "text-muted-foreground" : "font-medium text-forest"
              )}
            >
              {done ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-forest-600" />
              ) : (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-forest-600" />
              )}
              <span className={cn(done && "line-through decoration-forest-200")}>
                {s.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
