import * as React from "react";

/* ============================================================
 * Markdown renderer for traveller-written stories.
 *
 * Deliberately NOT using dangerouslySetInnerHTML or a HTML-parsing
 * library: everything below builds React elements directly, so there is
 * no path for a writer to inject script tags, iframes or event handlers.
 * Sanitisation is structural rather than a filter that can be bypassed.
 *
 * Supported: # headings, **bold**, *italic*, `code`, fenced code blocks,
 * - and 1. lists, > quotes, --- dividers, [links](url), ![images](url).
 * ============================================================ */

/** Only allow links/images we're happy to render. Blocks javascript: etc. */
function safeUrl(raw: string): string | null {
  const url = raw.trim();
  if (/^https?:\/\//i.test(url)) return url;
  if (/^\/(?!\/)/.test(url)) return url; // internal, e.g. /destinations/hunza
  if (/^mailto:/i.test(url)) return url;
  return null;
}

/* ---------------- inline formatting ---------------- */

const INLINE = /(!?\[[^\]]*\]\([^)]+\))|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(`[^`]+`)/g;

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-i${i++}`;

    if (tok.startsWith("![")) {
      // ![alt](src) — inline images render as block figures
      const alt = tok.slice(2, tok.indexOf("]"));
      const src = safeUrl(tok.slice(tok.indexOf("(") + 1, -1));
      if (src) {
        out.push(
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={k}
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            className="my-4 w-full rounded-2xl object-cover"
          />
        );
      } else {
        out.push(alt);
      }
    } else if (tok.startsWith("[")) {
      const label = tok.slice(1, tok.indexOf("]"));
      const href = safeUrl(tok.slice(tok.indexOf("(") + 1, -1));
      out.push(
        href ? (
          <a
            key={k}
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel="noopener noreferrer nofollow ugc"
            className="font-semibold text-forest-600 underline underline-offset-2 hover:text-gold"
          >
            {label}
          </a>
        ) : (
          label
        )
      );
    } else if (tok.startsWith("**") || tok.startsWith("__")) {
      out.push(
        <strong key={k} className="font-bold text-forest">
          {tok.slice(2, -2)}
        </strong>
      );
    } else if (tok.startsWith("`")) {
      out.push(
        <code key={k} className="rounded bg-muted px-1.5 py-0.5 text-[0.9em] text-forest">
          {tok.slice(1, -1)}
        </code>
      );
    } else {
      out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

/* ---------------- block parsing ---------------- */

const H_SIZES = [
  "text-2xl sm:text-3xl",
  "text-xl sm:text-2xl",
  "text-lg sm:text-xl",
  "text-base",
  "text-base",
  "text-sm",
];

export function StoryMarkdown({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const blocks = React.useMemo(() => parse(text ?? ""), [text]);
  if (!text?.trim()) return null;
  return <div className={`space-y-4 ${className}`}>{blocks}</div>;
}

function parse(src: string): React.ReactNode[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  const flushParagraph = (buf: string[]) => {
    if (!buf.length) return;
    const joined = buf.join(" ").trim();
    if (joined) {
      out.push(
        <p key={`p${key++}`} className="text-[15px] leading-relaxed text-forest/90">
          {renderInline(joined, `p${key}`)}
        </p>
      );
    }
    buf.length = 0;
  };

  const para: string[] = [];

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // blank line → end of paragraph
    if (!trimmed) {
      flushParagraph(para);
      i += 1;
      continue;
    }

    // fenced code block
    if (/^```/.test(trimmed)) {
      flushParagraph(para);
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence
      out.push(
        <pre
          key={`c${key++}`}
          className="overflow-x-auto rounded-2xl bg-forest-900 p-4 text-xs leading-relaxed text-white"
        >
          <code>{body.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph(para);
      out.push(<hr key={`hr${key++}`} className="border-border" />);
      i += 1;
      continue;
    }

    // heading
    const h = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (h) {
      flushParagraph(para);
      const level = h[1].length;
      const Tag = (`h${Math.min(level + 1, 6)}`) as "h2";
      out.push(
        <Tag
          key={`h${key++}`}
          className={`font-display font-bold text-forest ${H_SIZES[level - 1]} ${
            level <= 2 ? "mt-6" : "mt-4"
          }`}
        >
          {renderInline(h[2], `h${key}`)}
        </Tag>
      );
      i += 1;
      continue;
    }

    // blockquote
    if (/^>\s?/.test(trimmed)) {
      flushParagraph(para);
      const body: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        body.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      out.push(
        <blockquote
          key={`q${key++}`}
          className="border-l-4 border-gold bg-muted/40 py-2 pl-4 text-[15px] italic leading-relaxed text-forest/80"
        >
          {renderInline(body.join(" "), `q${key}`)}
        </blockquote>
      );
      continue;
    }

    // lists
    const isUl = /^[-*+]\s+/.test(trimmed);
    const isOl = /^\d+[.)]\s+/.test(trimmed);
    if (isUl || isOl) {
      flushParagraph(para);
      const items: string[] = [];
      const test = isUl ? /^[-*+]\s+/ : /^\d+[.)]\s+/;
      while (i < lines.length && test.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(test, ""));
        i += 1;
      }
      const ListTag = isUl ? "ul" : "ol";
      out.push(
        <ListTag
          key={`l${key++}`}
          className={`space-y-1.5 pl-5 text-[15px] leading-relaxed text-forest/90 ${
            isUl ? "list-disc" : "list-decimal"
          } marker:text-gold`}
        >
          {items.map((it, n) => (
            <li key={n}>{renderInline(it, `l${key}-${n}`)}</li>
          ))}
        </ListTag>
      );
      continue;
    }

    // standalone image on its own line
    if (/^!\[[^\]]*\]\([^)]+\)$/.test(trimmed)) {
      flushParagraph(para);
      out.push(
        <React.Fragment key={`img${key++}`}>
          {renderInline(trimmed, `img${key}`)}
        </React.Fragment>
      );
      i += 1;
      continue;
    }

    para.push(trimmed);
    i += 1;
  }

  flushParagraph(para);
  return out;
}
