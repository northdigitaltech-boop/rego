import Image from "next/image";

import { cn } from "@/lib/utils";

/* ============================================================
 * User avatar.
 *
 * Shows a photo when one exists, and initials when it does not.
 *
 * WHY INITIALS RATHER THAN A GENERIC ICON: every row currently
 * shows the same grey speech bubble, so a list of ten people
 * looks like ten copies of the same thing. Initials plus a
 * stable colour make each person recognisable at a glance —
 * you learn "Ali is the teal one" without reading the address.
 *
 * The colour is derived from the email, so it never changes for
 * the same person and no colour has to be stored anywhere.
 *
 * `src` is optional and currently unused by callers because
 * profiles have no avatar column yet. When one is added, pass it
 * here and photos appear with no other change.
 * ============================================================ */

/** Brand-adjacent palette. Muted on purpose — this sits in dense lists. */
const TONES = [
  "bg-forest-100 text-forest-700",
  "bg-gold-100 text-gold-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
  "bg-teal-100 text-teal-700",
];

/** Stable hash → the same person always gets the same colour. */
function toneFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return TONES[h % TONES.length];
}

/**
 * Two letters where a real name exists, otherwise the first two
 * of the email — "ali@gmail.com" reads better as AL than as A.
 */
function initialsFor(name: string | null | undefined, email: string): string {
  const n = (name ?? "").trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  const local = (email || "?").split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
  return (local.slice(0, 2) || "?").toUpperCase();
}

export function UserAvatar({
  email,
  name,
  src,
  size = 44,
  className,
}: {
  email: string;
  name?: string | null;
  /** Photo URL, when the account has one. */
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const initials = initialsFor(name, email);

  if (src) {
    return (
      <span
        className={cn("relative shrink-0 overflow-hidden rounded-full", className)}
        style={{ width: size, height: size }}
      >
        <Image
          src={src}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-display font-bold",
        toneFor(email || initials),
        className
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials}
    </span>
  );
}
