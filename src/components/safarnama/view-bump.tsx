"use client";

import * as React from "react";

import { bumpStoryViews } from "@/lib/safarnama";

/** Fires a one-time view increment when a story detail page mounts. */
export function StoryViewBump({ storyId }: { storyId: string }) {
  React.useEffect(() => {
    let done = false;
    const key = `rego-viewed-${storyId}`;
    // Only count once per browser session to avoid inflating on re-render.
    if (typeof window !== "undefined" && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      if (!done) void bumpStoryViews(storyId);
    }
    return () => {
      done = true;
    };
  }, [storyId]);
  return null;
}
