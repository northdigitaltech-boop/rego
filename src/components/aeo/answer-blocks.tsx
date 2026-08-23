import Link from "next/link";
import { AlertTriangle, ExternalLink, ShieldCheck } from "lucide-react";

import {
  freshness,
  type PublicAnswer,
  type SourceRef,
} from "@/lib/answers";
import { FaqJsonLd } from "@/components/seo/json-ld";
import { cn } from "@/lib/utils";

/* ============================================================
 * Answer components.
 *
 * ALL SERVER-RENDERED. No "use client" anywhere in this file.
 *
 * The whole point of answer content is that it exists in the
 * HTML a crawler and a reader both receive on first paint. An
 * answer revealed by JavaScript after a click is invisible to
 * an answer engine and slower for a human — so the disclosure
 * below uses <details>, which is native, keyboard-accessible,
 * and ships the answer text in the markup whether it is open or
 * not.
 * ============================================================ */

/* ------------------------------------------------------------------ */
/* Sources & verification                                              */
/* ------------------------------------------------------------------ */

export function AnswerSource({ sources }: { sources: SourceRef[] }) {
  const valid = (sources ?? []).filter((s) => s?.url && /^https?:\/\//i.test(s.url));
  if (valid.length === 0) return null;

  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span>Source:</span>
      {valid.map((s, i) => (
        <a
          key={i}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-1 underline decoration-border underline-offset-2 hover:text-forest"
        >
          {s.label || new URL(s.url).hostname}
          <ExternalLink className="h-3 w-3" />
        </a>
      ))}
    </p>
  );
}

export function LastVerified({ answer }: { answer: PublicAnswer }) {
  const f = freshness(answer);
  if (!f.label) return null;
  return (
    <p
      className={cn(
        "mt-1.5 text-xs",
        f.stale ? "font-medium text-gold-700" : "text-muted-foreground"
      )}
    >
      {f.label}
    </p>
  );
}

/**
 * Shown when a time-sensitive answer is getting old.
 *
 * Deliberately not alarming — this is "check before you rely on it", not an
 * error. Overstating it teaches readers to ignore the warning entirely.
 */
export function TimeSensitiveWarning({ answer }: { answer: PublicAnswer }) {
  const f = freshness(answer);
  if (!answer.is_time_sensitive || !f.stale) return null;

  return (
    <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-gold/10 px-3 py-2 text-xs leading-relaxed text-forest">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-700" />
      <span>
        This can change at short notice. Confirm locally before you travel.
      </span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Direct answer                                                       */
/* ------------------------------------------------------------------ */

/**
 * One question, answered immediately.
 *
 * Structure is deliberate and fixed: heading → short answer → supporting
 * detail → source. A reader who stops after the first paragraph should
 * already have their answer.
 */
export function DirectAnswer({
  answer,
  as: Heading = "h2",
  className,
}: {
  answer: PublicAnswer;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <section className={cn("max-w-3xl", className)}>
      <Heading className="font-display text-xl font-bold text-forest sm:text-2xl">
        {answer.question}
      </Heading>

      <p className="mt-2 text-base leading-relaxed text-foreground">
        {answer.short_answer}
      </p>

      {answer.detailed_answer?.trim() && (
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
          {answer.detailed_answer.split(/\n{2,}/).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}

      <TimeSensitiveWarning answer={answer} />
      <AnswerSource sources={answer.source_references} />
      <LastVerified answer={answer} />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Key facts                                                           */
/* ------------------------------------------------------------------ */

/**
 * A short scannable summary.
 *
 * Renders nothing when there is nothing to say — an empty facts box is worse
 * than no box, because it looks like something failed to load.
 */
export function KeyFacts({
  items,
  title = "At a glance",
}: {
  items: { label: string; value: string | null | undefined }[];
  title?: string;
}) {
  const real = items.filter((i) => i.value && String(i.value).trim());
  if (real.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-4 sm:p-5">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {real.map((i) => (
          <div key={i.label}>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              {i.label}
            </dt>
            <dd className="mt-0.5 font-semibold text-forest">{i.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Related questions                                                   */
/* ------------------------------------------------------------------ */

/**
 * Disclosure list built on native <details>.
 *
 * Native rather than a JS accordion because:
 *   • the answer text is in the HTML whether open or closed
 *   • keyboard and screen-reader behaviour is correct with no ARIA to get
 *     wrong
 *   • it costs no JavaScript
 *
 * The first item is open so the page never presents a wall of closed rows.
 */
export function RelatedQuestions({
  answers,
  title = "Related questions",
  max = 8,
}: {
  answers: PublicAnswer[];
  title?: string;
  max?: number;
}) {
  /* Cap the list. Twenty accordions is not a helpful page, it is a wall. */
  const items = answers.slice(0, max);
  if (items.length === 0) return null;

  return (
    <section className="max-w-3xl">
      <h2 className="font-display text-xl font-bold text-forest sm:text-2xl">
        {title}
      </h2>
      <div className="mt-4 divide-y divide-border rounded-2xl border border-border">
        {items.map((a, i) => (
          <details key={a.id} open={i === 0} className="group px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-forest marker:content-none">
              {a.question}
              <span
                aria-hidden
                className="shrink-0 text-muted-foreground transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <div className="pt-2">
              <p className="text-sm leading-relaxed text-foreground">
                {a.short_answer}
              </p>
              {a.detailed_answer?.trim() && (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {a.detailed_answer}
                </p>
              )}
              <TimeSensitiveWarning answer={a} />
              <AnswerSource sources={a.source_references} />
              <LastVerified answer={a} />
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Service availability                                                */
/* ------------------------------------------------------------------ */

/**
 * Answers "are there hotels in Skardu?" from real configuration.
 *
 * ---------------------------------------------------------------------------
 * THE RULE THIS ENFORCES
 *
 * If a service is switched off in an area, this must NOT say it is available.
 * That is not a copy preference — a traveller who is told guides are bookable
 * and then finds none has been misled by the site, and it is the fastest way
 * to lose them.
 *
 * When the service is off and no coming-soon message is configured, this
 * renders nothing at all. Silence beats a placeholder.
 * ---------------------------------------------------------------------------
 */
export function ServiceAvailabilityAnswer({
  service,
  place,
  enabled,
  comingSoon,
  comingSoonMessage,
  countSentence: sentence,
  browseHref,
}: {
  service: string;
  place: string;
  enabled: boolean;
  comingSoon?: boolean;
  comingSoonMessage?: string | null;
  /** Pre-computed factual sentence, or null when a number can't be trusted. */
  countSentence?: string | null;
  browseHref?: string;
}) {
  if (!enabled) {
    if (comingSoon && comingSoonMessage?.trim()) {
      return (
        <section className="max-w-3xl rounded-2xl border border-border bg-muted/30 p-4">
          <h2 className="font-display text-lg font-bold text-forest">
            {service} in {place}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {comingSoonMessage}
          </p>
        </section>
      );
    }
    // Not available, nothing configured to say → say nothing.
    return null;
  }

  return (
    <section className="max-w-3xl">
      <h2 className="font-display text-lg font-bold text-forest">
        {service} in {place}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-foreground">
        {sentence ?? `Browse ${service.toLowerCase()} currently listed in ${place} on Rego.`}
      </p>
      {browseHref && (
        <Link
          href={browseHref}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-forest hover:text-gold"
        >
          View {service.toLowerCase()} in {place}
          <span aria-hidden>→</span>
        </Link>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* TravelFAQ — visible questions AND their schema, from one array      */
/* ------------------------------------------------------------------ */

/**
 * The only component that emits FAQPage structured data.
 *
 * ---------------------------------------------------------------------------
 * SCHEMA AND SCREEN COME FROM THE SAME VARIABLE.
 *
 * Google requires FAQ markup to match content the user can see. The usual way
 * sites break that rule is by building the schema from one source and the
 * visible list from another, then letting them drift. Here `items` is
 * rendered and serialised in the same component, so they cannot disagree.
 *
 * Two deliberate restrictions:
 *   • Fewer than MIN_FOR_SCHEMA questions → visible FAQ, no schema. Marking
 *     up one question is not a FAQ page.
 *   • A time-sensitive answer that has gone stale is shown with its warning
 *     but kept OUT of the schema, because schema has no way to carry
 *     "verify this before relying on it".
 * ---------------------------------------------------------------------------
 */
const MIN_FOR_SCHEMA = 3;

export function TravelFAQ({
  answers,
  title = "Common questions",
  max = 8,
  /** Set false to render the FAQ without any structured data. */
  withSchema = true,
}: {
  answers: PublicAnswer[];
  title?: string;
  max?: number;
  withSchema?: boolean;
}) {
  const items = answers.slice(0, max);
  if (items.length === 0) return null;

  const schemaItems = items
    .filter((a) => !freshness(a).stale)
    .map((a) => ({
      q: a.question,
      a: [a.short_answer, a.detailed_answer ?? ""].join(" ").trim(),
    }))
    .filter((x) => x.q && x.a);

  const emitSchema = withSchema && schemaItems.length >= MIN_FOR_SCHEMA;

  return (
    <>
      {emitSchema && <FaqJsonLd items={schemaItems} />}
      <RelatedQuestions answers={items} title={title} max={max} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Verified-provider note                                              */
/* ------------------------------------------------------------------ */

/** Explains what "verified" means, rather than asserting quality. */
export function VerifiedNote() {
  return (
    <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest-600" />
      <span>
        Verified means Rego has checked the provider&apos;s registration and
        contact details. It is not a rating of service quality.
      </span>
    </p>
  );
}
