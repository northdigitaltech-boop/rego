import * as React from "react";

/* ============================================================
 * Minimal markdown for Rego AI chat bubbles.
 *
 * Supports ONLY what a chat answer needs:
 *   **bold**            → a bold run, used for short headings
 *   - item / • item     → bullet list
 *   1. item             → numbered list
 *   blank line          → paragraph break
 *
 * Deliberately NOT supported: headings, tables, links, images, code
 * blocks, raw HTML. A chat bubble is 300px wide — a markdown table
 * there is unreadable, and every extra feature is another way for
 * model output to render badly.
 *
 * SECURITY: builds React elements directly. Nothing goes through
 * dangerouslySetInnerHTML, so text from the model can never become
 * markup. That matters because the model's output is influenced by
 * whatever a traveller typed.
 * ============================================================ */

/** Split a line into plain and **bold** runs. */
function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // Non-greedy so "**a** and **b**" gives two bold runs, not one.
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <strong key={`${key}-b${i++}`} className="font-semibold text-forest">
        {m[1]}
      </strong>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));

  /* A stray single "*" from an unclosed pair would otherwise show on
     screen. Strip leftovers so a half-formed answer still reads cleanly. */
  return out.map((n) =>
    typeof n === "string" ? n.replace(/\*+/g, "") : n
  );
}

const BULLET = /^\s*[-•*]\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,2})[.)]\s+(.*)$/;

export function ChatMarkdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];

  let bullets: string[] = [];
  let numbers: string[] = [];
  let para: string[] = [];
  let k = 0;

  const flushPara = () => {
    if (!para.length) return;
    blocks.push(
      <p key={`p${k}`} className="leading-relaxed">
        {inline(para.join(" "), `p${k}`)}
      </p>
    );
    k += 1;
    para = [];
  };

  const flushBullets = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`u${k}`} className="space-y-1">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2 leading-relaxed">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-gold" />
            <span>{inline(b, `u${k}-${i}`)}</span>
          </li>
        ))}
      </ul>
    );
    k += 1;
    bullets = [];
  };

  const flushNumbers = () => {
    if (!numbers.length) return;
    blocks.push(
      <ol key={`o${k}`} className="space-y-1">
        {numbers.map((b, i) => (
          <li key={i} className="flex gap-2 leading-relaxed">
            <span className="shrink-0 font-semibold text-forest-600">
              {i + 1}.
            </span>
            <span>{inline(b, `o${k}-${i}`)}</span>
          </li>
        ))}
      </ol>
    );
    k += 1;
    numbers = [];
  };

  const flushAll = () => {
    flushPara();
    flushBullets();
    flushNumbers();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      flushAll();
      continue;
    }

    const bm = line.match(BULLET);
    if (bm) {
      flushPara();
      flushNumbers();
      bullets.push(bm[1]);
      continue;
    }

    const nm = line.match(NUMBERED);
    if (nm) {
      flushPara();
      flushBullets();
      numbers.push(nm[2]);
      continue;
    }

    // A line that is entirely bold reads as a heading — give it its own block.
    const headingOnly = line.match(/^\*\*(.+?)\*\*:?$/);
    if (headingOnly) {
      flushAll();
      blocks.push(
        <p key={`h${k}`} className="font-semibold text-forest">
          {headingOnly[1]}
        </p>
      );
      k += 1;
      continue;
    }

    flushBullets();
    flushNumbers();
    para.push(line);
  }

  flushAll();

  return <div className="space-y-2">{blocks}</div>;
}
