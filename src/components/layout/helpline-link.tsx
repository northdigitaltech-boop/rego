"use client";

import * as React from "react";

import { useContactPhone } from "@/lib/use-contact-phone";

/* ============================================================
 * The helpline number, wherever it appears.
 *
 * A tiny client component rather than a hook, because the
 * footer is a SERVER component and cannot call hooks. Dropping
 * this in keeps the footer server-rendered while still reading
 * the admin-editable number.
 *
 * Every place the number is shown should use this. It was
 * hardcoded in three files, which is how the navbar ended up
 * showing an old number after the Contact page was edited.
 * ============================================================ */

export function HelplineLink({
  className,
  icon,
  prefix,
}: {
  className?: string;
  /** Rendered before the number — the phone icon, styled by the caller. */
  icon?: React.ReactNode;
  /** e.g. "Helpline: " or "24/7 · ". Omitted when not given. */
  prefix?: string;
}) {
  const { dial, display } = useContactPhone();
  return (
    <a href={`tel:${dial}`} className={className}>
      {icon}
      {prefix}
      {display}
    </a>
  );
}
