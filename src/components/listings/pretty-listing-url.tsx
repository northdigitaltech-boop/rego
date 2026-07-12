"use client";

import * as React from "react";

import { slugify } from "@/lib/utils";

/**
 * Rewrites the address bar from /listings/<uuid> to a readable
 * /listings/<name-slug>-<uuid> once the page has rendered, using the property's
 * main heading. No navigation happens (history.replaceState), and the detail
 * page still resolves by the trailing uuid on refresh.
 */
export function PrettyListingUrl({ id }: { id: string }) {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    // Only prettify real UUID listings; leave demo/static ids (e.g. "l1") alone.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUuid) return;
    const name = document.querySelector("main h1")?.textContent?.trim();
    if (!name) return;
    const pretty = `/listings/${slugify(name)}-${id}`;
    if (window.location.pathname !== pretty) {
      window.history.replaceState(window.history.state, "", pretty);
    }
  }, [id]);
  return null;
}
