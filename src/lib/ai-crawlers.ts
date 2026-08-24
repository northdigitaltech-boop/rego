/* ============================================================
 * AI crawler policy.
 *
 * ---------------------------------------------------------------------------
 * THIS IS A BUSINESS DECISION, NOT A TECHNICAL ONE.
 *
 * Allowing these crawlers means ChatGPT, Claude, Perplexity and Gemini can
 * read Rego and cite it when someone asks "what is the best time to visit
 * Skardu". Blocking them means they cannot — and a site they cannot read is
 * a site they cannot recommend.
 *
 * The trade is real in both directions:
 *
 *   ALLOW  → Rego can be cited and linked in AI answers. Some users get the
 *            answer without visiting the site. For a marketplace this is
 *            usually still worth it: the citation is where the booking
 *            intent starts, and the booking has to happen here.
 *
 *   BLOCK  → the content is not used for training or answering. Rego becomes
 *            invisible in a channel that is taking a growing share of travel
 *            research, and competitors who allow it get cited instead.
 *
 * Rego's whole direction — answer-first content, verifiable sources, an
 * editorial policy — only pays off if the crawlers can actually read it.
 * So the default here is ALLOW.
 *
 * Change ONE constant below to reverse it. Nothing else needs editing.
 * ---------------------------------------------------------------------------
 *
 * A separate matter: some of these agents fetch a page live when a user asks
 * a question, rather than crawling in advance. Blocking those breaks the
 * "read this page for me" flow for a real person who chose to visit Rego.
 * They are listed separately so the two decisions stay separate.
 */

/** Set to false to keep Rego out of AI answers entirely. */
export const ALLOW_AI_CRAWLERS = true;

/**
 * Bots that crawl in advance to build an index or a training corpus.
 * Governed by ALLOW_AI_CRAWLERS.
 */
export const AI_TRAINING_BOTS = [
  "GPTBot",              // OpenAI — training and ChatGPT search
  "ClaudeBot",           // Anthropic
  "anthropic-ai",        // Anthropic, older token
  "PerplexityBot",       // Perplexity
  "Google-Extended",     // Google — Gemini training, NOT Googlebot
  "Applebot-Extended",   // Apple Intelligence
  "CCBot",               // Common Crawl, feeds many models
  "Bytespider",          // ByteDance
  "meta-externalagent",  // Meta
] as const;

/**
 * Agents that fetch a page ON DEMAND because a user asked about it.
 *
 * Deliberately always allowed, even when ALLOW_AI_CRAWLERS is false.
 * Blocking these does not protect content from training — it just breaks the
 * page for a person who is standing there waiting for it.
 */
export const AI_USER_AGENTS = [
  "ChatGPT-User",     // someone pasted a Rego link into ChatGPT
  "OAI-SearchBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot-User",
] as const;

/** robots.txt rules for the AI bots, in Next's MetadataRoute.Robots shape. */
export function aiCrawlerRules(): {
  userAgent: string | string[];
  allow?: string | string[];
  disallow?: string | string[];
}[] {
  const rules: {
    userAgent: string | string[];
    allow?: string | string[];
    disallow?: string | string[];
  }[] = [];

  /* Private areas stay private for every agent, including the ones we are
     happy to have reading the public site. */
  const PRIVATE = [
    "/admin",
    "/cyber",
    "/dashboard",
    "/api/",
    "/signin",
    "/signup",
    "/reset-password",
    "/wishlist",
    "/messages",
  ];

  rules.push({
    userAgent: [...AI_TRAINING_BOTS],
    ...(ALLOW_AI_CRAWLERS ? { allow: "/", disallow: PRIVATE } : { disallow: "/" }),
  });

  rules.push({
    userAgent: [...AI_USER_AGENTS],
    allow: "/",
    disallow: PRIVATE,
  });

  return rules;
}
