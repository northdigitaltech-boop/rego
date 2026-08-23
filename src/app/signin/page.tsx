import type { Metadata } from "next";

import { noindexMetadata } from "@/lib/seo";

import { AuthForm } from "@/components/auth/auth-form";

/* Private / utility route — never a search result.
 *
 * robots.txt also disallows this path, but robots.txt only stops
 * CRAWLING. Google can still index a URL it was never allowed to fetch
 * if something links to it, showing a bare result with no description.
 * The meta tag is what actually keeps it out of the index.
 *
 * Neither is the real protection — authentication is. */
export const metadata: Metadata = noindexMetadata("Sign in");

export default function SignInPage() {
  return <AuthForm mode="signin" />;
}
