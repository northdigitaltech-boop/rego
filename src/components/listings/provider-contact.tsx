import { MessageCircle, Phone } from "lucide-react";

import { cn } from "@/lib/utils";

/* ============================================================
 * Call / WhatsApp the provider directly.
 *
 * Listings only offered Rego's helpline, so a traveller could not reach
 * the hotel or operator themselves. These buttons use ONLY the number the
 * provider entered in their own profile — nothing is ever filled in or
 * guessed. No number on file → nothing is rendered, and the helpline in
 * the header/footer stays as the support line.
 * ============================================================ */

const digits = (n?: string | null) => (n ?? "").replace(/[^\d+]/g, "");

/** Pakistani mobile "0317…" → "92317…" for wa.me; keeps an existing 92/+92. */
function waNumber(n?: string | null): string {
  let d = (n ?? "").replace(/[^\d]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0") && d.length === 11) d = `92${d.slice(1)}`;
  return d.length >= 10 ? d : "";
}

export function ProviderContact({
  phone,
  whatsapp,
  name,
  className,
}: {
  phone?: string | null;
  whatsapp?: string | null;
  name: string;
  className?: string;
}) {
  const tel = digits(phone);
  const wa = waNumber(whatsapp || phone);
  if (!tel && !wa) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {tel && (
        <a
          href={`tel:${tel}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-semibold text-forest hover:border-forest-600 hover:bg-forest-50"
          aria-label={`Call ${name}`}
        >
          <Phone className="h-4 w-4" /> Call
        </a>
      )}
      {wa && (
        <a
          href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hi ${name}, I found you on Rego.`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-semibold text-forest hover:border-forest-600 hover:bg-forest-50"
          aria-label={`WhatsApp ${name}`}
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
      )}
    </div>
  );
}
