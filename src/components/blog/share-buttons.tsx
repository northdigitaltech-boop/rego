"use client";

import * as React from "react";
import { Check, Facebook, Link2, Linkedin, MessageCircle } from "lucide-react";

/* ============================================================
 * Share buttons.
 *
 * The only client component on the article page — copying to the
 * clipboard and the native share sheet both need the browser.
 *
 * No third-party share widgets. Facebook's and LinkedIn's SDKs
 * load tracking scripts on every page view whether or not
 * anyone shares; plain links to their share endpoints do the
 * same job with no script and no tracking of readers who never
 * click.
 * ============================================================ */

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard access can be refused — an older browser, an insecure
         context, or a permissions policy. Silent is right here: the other
         share buttons still work and the URL is in the address bar. */
    }
  };

  const enc = encodeURIComponent;
  const links = [
    {
      label: "Share on WhatsApp",
      icon: MessageCircle,
      href: `https://wa.me/?text=${enc(`${title} ${url}`)}`,
    },
    {
      label: "Share on Facebook",
      icon: Facebook,
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
    },
    {
      label: "Share on LinkedIn",
      icon: Linkedin,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Share
      </span>

      {links.map(({ label, icon: Icon, href }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-forest transition-colors hover:border-forest-600 hover:bg-forest-50"
        >
          <Icon className="h-4 w-4" />
        </a>
      ))}

      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Link copied" : "Copy link"}
        title={copied ? "Copied" : "Copy link"}
        className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-forest transition-colors hover:border-forest-600 hover:bg-forest-50"
      >
        {copied ? (
          <Check className="h-4 w-4 text-forest-600" />
        ) : (
          <Link2 className="h-4 w-4" />
        )}
      </button>

      {/* Screen readers get the confirmation the icon change conveys visually. */}
      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied to clipboard" : ""}
      </span>
    </div>
  );
}
