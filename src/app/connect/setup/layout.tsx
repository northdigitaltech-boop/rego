import type { Metadata } from "next";

import { noindexMetadata } from "@/lib/seo";

/* This route is a private, signed-in workspace. The page itself is a client
 * component, which cannot export metadata — hence a layout.
 *
 * robots.ts also disallows this path. Both are needed: robots stops crawling,
 * the meta tag handles anything that reaches the page from a link. Neither is
 * the actual protection — authentication is. */
export const metadata: Metadata = noindexMetadata();

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
