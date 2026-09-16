/* ============================================================
 * Tidying names people type.
 *
 * THE PROBLEM
 *   Business and person names arrive as "GILGIT TOURS",
 *   "hunza rides", "K2TREKKINGANDEXPEDITION". On a listing card
 *   next to properly-cased names they look like shouting or like
 *   a mistake, and it is the provider who looks careless.
 *
 * THE TRAP
 *   The obvious fix — uppercase the first letter, lowercase the
 *   rest — is wrong on real names:
 *
 *     PIA        → Pia         (an airline, not a girl's name)
 *     K2         → K2          (must survive)
 *     McDonald   → Mcdonald
 *     O'Brien    → O'brien
 *     NLI        → Nli
 *
 *   So this does less than that, on purpose.
 *
 * THE RULE
 *   1. If the text already has mixed case, LEAVE IT ALONE. The
 *      person made a choice — "iPhone", "McDonald", "DHA Phase 6"
 *      — and second-guessing it is how you break a brand name.
 *   2. Only all-UPPER or all-lower input is touched. That is the
 *      shouting and the lazy typing, and neither carries meaning.
 *   3. Even then, short tokens (1–3 characters) are left as they
 *      were: PIA, K2, DHA, NLI, UK. Acronyms are short; words
 *      worth casing are not.
 *   4. Mc/Mac, O', hyphens and apostrophes are handled inside the
 *      word, so "o'brien" becomes "O'Brien" and "abdul-rehman"
 *      becomes "Abdul-Rehman".
 *
 * WHAT IT IS NOT
 *   Not validation, and not a gate. It never rejects anything and
 *   never blocks a save. The worst case is a name left exactly as
 *   the person typed it, which is where we started.
 * ============================================================ */

/** Words that stay lowercase inside a longer name, not at the start. */
const MINOR_WORDS = new Set([
  "a", "an", "and", "as", "at", "by", "de", "del", "der", "di", "du",
  "for", "in", "la", "le", "of", "on", "or", "the", "to", "van", "von",
  /* Common in Pakistani names, and conventionally lowercase mid-name. */
  "bin", "binte", "ud", "ul", "al",
]);

/** True when the text carries a casing decision worth preserving. */
function hasMeaningfulCase(s: string): boolean {
  const letters = s.replace(/[^A-Za-z]/g, "");
  if (letters.length === 0) return false;
  const upper = letters.replace(/[^A-Z]/g, "").length;
  const lower = letters.length - upper;
  /* Mixed means someone chose. All-upper or all-lower means they did not. */
  return upper > 0 && lower > 0;
}

/** Capitalise one word, respecting Mc/Mac, O', hyphens and apostrophes. */
function caseWord(word: string, isFirst: boolean): string {
  if (!word) return word;

  /* Short tokens are almost always acronyms or codes — PIA, K2, DHA, UK.
     Casing them does more harm than leaving them. */
  if (word.replace(/[^A-Za-z0-9]/g, "").length <= 3) return word;

  const lower = word.toLowerCase();

  if (!isFirst && MINOR_WORDS.has(lower)) return lower;

  /* Split on hyphens and apostrophes, keeping the separators, so each part
     gets its own capital: abdul-rehman → Abdul-Rehman, o'brien → O'Brien. */
  const cased = lower
    .split(/([-'’])/)
    .map((part) => {
      if (part === "-" || part === "'" || part === "’") return part;
      if (!part) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("");

  /* Mc and Mac take a second capital: mcdonald → McDonald. Only when what
     follows is long enough to be a name — "mac" alone stays "Mac". */
  const mc = cased.match(/^(Ma?c)([a-z]{3,})$/);
  if (mc) return `${mc[1]}${mc[2].charAt(0).toUpperCase()}${mc[2].slice(1)}`;

  return cased;
}

/**
 * Tidy a name for display and storage.
 *
 * Returns the input unchanged when it already carries a casing decision.
 */
export function toTitleCase(input: string): string {
  const trimmed = input.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";

  /* The whole point: do not touch what somebody deliberately cased. */
  if (hasMeaningfulCase(trimmed)) return trimmed;

  return trimmed
    .split(" ")
    .map((w, i) => caseWord(w, i === 0))
    .join(" ");
}

/**
 * For a person's name. Same rules, and it also collapses the stray
 * punctuation that comes from copy-paste.
 */
export function toPersonName(input: string): string {
  return toTitleCase(input.replace(/[.,;:]+$/g, ""));
}

/** Emails are always lowercase — "Ali@Gmail.com" and "ali@gmail.com" are
 *  the same mailbox, and storing both makes two accounts out of one person. */
export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}
