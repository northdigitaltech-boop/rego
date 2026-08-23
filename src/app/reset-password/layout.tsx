import type { Metadata } from "next";

import { noindexMetadata } from "@/lib/seo";

/* "use client" pages cannot export metadata, so the noindex lives here.
 *
 * A password-reset URL must never reach a search index — it is a utility
 * page with no content, and reset links are sensitive by nature. */
export const metadata: Metadata = noindexMetadata("Reset password");

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
