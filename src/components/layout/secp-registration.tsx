import Image from "next/image";
import { BadgeCheck, ExternalLink, ShieldCheck } from "lucide-react";

/* ============================================================
 * SECP registration band — sits directly above the footer.
 *
 * WHY THIS BELONGS ON A MARKETPLACE
 * Travellers hand money to strangers on this site. A verifiable
 * company registration is the single cheapest trust signal
 * available, and it works precisely because it can be CHECKED —
 * so the verify link is the important part, not the picture.
 *
 * The certificate image is decorative proof; the SECP link is
 * the evidence. If the image ever fails to load, the section
 * still does its job.
 *
 * ---------------------------------------------------------------------------
 * EVERY FIGURE HERE COMES FROM THE CERTIFICATE ITSELF.
 * Nothing is rounded, embellished or inferred. Misstating a
 * company registration is not a copy decision, it is a legal
 * one.
 * ---------------------------------------------------------------------------
 */

const COMPANY = {
  legalName: "REGO. (SMC-PRIVATE) LIMITED",
  cuin: "0345252",
  incorporatedOn: "13 July 2026",
  act: "Companies Act, 2017 (XIX of 2017)",
  liability: "Limited by shares",
  registrar: "SECP Business Centre, Head Office Islamabad",
  verifyUrl: "https://leap.secp.gov.pk/#/verify-company-info/0345252",
  /** Put the certificate at public/secp-certificate.png */
  certificate: "/secp-certificate.png",
} as const;

export function SecpRegistration() {
  return (
    <section
      aria-labelledby="secp-heading"
      className="border-t border-border bg-muted/40"
    >
      <div className="container-px py-12 sm:py-14">
        <div className="grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
          {/* ---- Text: the part that actually carries the trust ---- */}
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest-600">
              <ShieldCheck className="h-3.5 w-3.5" />
              Registered company
            </span>

            <h2
              id="secp-heading"
              className="mt-3 font-display text-2xl font-bold text-forest sm:text-3xl"
            >
              Registered with the SECP
            </h2>

            <p className="mt-2 max-w-xl leading-relaxed text-muted-foreground">
              Rego is a company incorporated in Pakistan under the{" "}
              {COMPANY.act}, registered with the Securities and Exchange
              Commission of Pakistan. You can verify our registration directly
              on the SECP portal — you do not have to take our word for it.
            </p>

            {/* Facts, straight off the certificate. */}
            <dl className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <Fact label="Registered name" value={COMPANY.legalName} />
              <Fact label="Corporate Unique ID (CUIN)" value={COMPANY.cuin} />
              <Fact label="Incorporated" value={COMPANY.incorporatedOn} />
              <Fact label="Liability" value={COMPANY.liability} />
              <Fact label="Registrar" value={COMPANY.registrar} wide />
            </dl>

            <a
              href={COMPANY.verifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-forest-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-forest-700"
            >
              <BadgeCheck className="h-4 w-4" />
              Verify on the SECP portal
              <ExternalLink className="h-3.5 w-3.5 opacity-80" />
            </a>
          </div>

          {/* ---- Certificate ----
              A portrait A4 document. Rendered at a deliberately modest size:
              full width on phones where there is nothing to compete with, and
              a capped column on larger screens so a legal document does not
              dominate a page about travel.

              Tapping opens the full-resolution file, which is what someone
              actually wants when they are checking it. */}
          <figure className="mx-auto w-full max-w-[280px] sm:max-w-[320px] lg:max-w-none">
            <a
              href={COMPANY.certificate}
              target="_blank"
              rel="noopener noreferrer"
              className="group block overflow-hidden rounded-xl border border-border bg-white shadow-premium transition-shadow hover:shadow-lg"
              aria-label="Open the full SECP certificate of incorporation"
            >
              <Image
                src={COMPANY.certificate}
                alt={`SECP certificate of incorporation for ${COMPANY.legalName}, corporate unique identification number ${COMPANY.cuin}`}
                width={828}
                height={1064}
                /* Tells the browser roughly how wide this will render so it
                   downloads a sensibly sized file on a phone rather than the
                   full-resolution scan. */
                sizes="(max-width: 640px) 280px, (max-width: 1024px) 320px, 380px"
                className="h-auto w-full transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </a>
            <figcaption className="mt-2 text-center text-xs text-muted-foreground">
              Certificate of Incorporation · tap to view full size
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

function Fact({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold text-forest">{value}</dd>
    </div>
  );
}
