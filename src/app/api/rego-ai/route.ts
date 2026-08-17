import { NextResponse } from "next/server";

import { clientIp } from "@/lib/rate-limit";
import { limitAndLog } from "@/lib/rate-limit-guard";
import { answerQuery, buildSystemPrompt } from "@/lib/rego-ai";
import { enforceIpBlock } from "@/lib/ip-block";
import {
  classifyQuery,
  answerFromDatabase,
  answerWeather,
  type ChatContext,
} from "@/lib/ai-router";

/* ============================================================
 * Rego AI endpoint.
 * Retrieval (deterministic): always finds matching Rego listings for the query.
 * Generation (optional): if an LLM provider + key is configured in the server
 * env, it writes a natural, grounded reply. Otherwise it returns the built-in
 * rule-based reply — so the assistant always works.
 *
 * To enable the LLM, add to .env.local (server-only, no NEXT_PUBLIC_):
 *   REGO_AI_PROVIDER = openai | anthropic | gemini
 *   OPENAI_API_KEY=...        (for openai)
 *   ANTHROPIC_API_KEY=...     (for anthropic)
 *   GEMINI_API_KEY=...        (for gemini)
 *   REGO_AI_MODEL=...         (optional model override)
 * ============================================================ */

const MAX_MSG = 1000;
/** How many recent turns to remember (3 exchanges) — enough for follow-ups. */
const MAX_TURNS = 6;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Walk the recent turns newest-first and pick up the last location and service
 * the user talked about, so "what about there?" / "a cheaper one" still work.
 */
function deriveContext(turns: ChatTurn[]): ChatContext {
  const ctx: ChatContext = { location: null, intent: null };
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role !== "user") continue;
    const d = classifyQuery(turns[i].content);
    if (!ctx.location && d.filters.location) ctx.location = d.filters.location;
    if (!ctx.intent && d.intent) ctx.intent = d.intent;
    if (ctx.location && ctx.intent) break;
  }
  return ctx;
}

function allowedHost(req: Request): boolean {
  const host = req.headers.get("host");
  const origin = req.headers.get("origin") || req.headers.get("referer");
  if (!host || !origin) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  // Containment: refuse before doing any work.
  const blocked = await enforceIpBlock(req);
  if (blocked) return blocked;

  if (!allowedHost(req)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const rl = limitAndLog(req, `regoai:${clientIp(req)}`, 20, 60_000, { endpoint: "/api/rego-ai", category: "api" });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const { message, history } = (body ?? {}) as { message?: unknown; history?: unknown };
  if (typeof message !== "string" || !message.trim() || message.length > MAX_MSG) {
    return NextResponse.json({ ok: false, error: "Invalid message" }, { status: 400 });
  }

  // Recent turns, so follow-ups like "a cheaper one" or "and transport there?"
  // resolve against what was already discussed. Bounded to keep tokens sane.
  const turns: ChatTurn[] = Array.isArray(history)
    ? (history as unknown[])
        .filter(
          (t): t is ChatTurn =>
            !!t &&
            typeof t === "object" &&
            (("role" in t && (t as ChatTurn).role === "user") ||
              (t as ChatTurn).role === "assistant") &&
            typeof (t as ChatTurn).content === "string"
        )
        .slice(-MAX_TURNS)
        .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_MSG) }))
    : [];

  // What the conversation has established so far (last location / service).
  const ctx = deriveContext(turns);

  // 1) Retrieval — always grounded in real Rego listings.
  const answer = answerQuery(message);

  // Scope guard: off-topic questions get a canned refusal — never sent to the LLM.
  if (!answer.onTopic) {
    return NextResponse.json({
      ok: true,
      reply: answer.reply,
      bullets: [],
      results: [],
      feature: null,
      llm: false,
    });
  }

  // 2) SMART ROUTER — database first, AI only when required.
  // Simple listing searches (hotels/transport/guides/… + location/price/sort)
  // are answered straight from the live catalogue with a template reply and
  // spend ZERO AI tokens. Feature intents & greetings are also deterministic.
  const decision = classifyQuery(message, ctx);

  // Greetings get the friendly canned welcome — no tokens.
  const isGreeting =
    /^(hi|hey|hello|hy|salam|asalam|assalam|aoa|assalamualaikum|good (morning|evening|afternoon))\b/i.test(
      message.trim()
    ) && message.trim().length < 30;

  // Live weather — answered from Open-Meteo (real-time, accurate, 0 tokens).
  if (decision.kind === "weather") {
    const wx = await answerWeather(decision.filters.location);
    if (wx) {
      return NextResponse.json({
        ok: true,
        reply: wx.reply,
        bullets: [],
        results: [],
        viewAllHref: wx.viewAllHref,
        feature: {
          label: "Road Updates & Alerts",
          href: "/roadside/updates",
          description: "Live verified road conditions across GB before you travel.",
        },
        llm: false,
      });
    }
    // Weather API unavailable → let the LLM (if configured) answer generally.
  }

  if (isGreeting || answer.feature || (decision.kind === "search" && decision.confidence >= 0.75)) {
    if (isGreeting) {
      return NextResponse.json({
        ok: true,
        reply: answer.reply,
        bullets: [],
        results: [],
        feature: null,
        llm: false,
      });
    }
    if (!answer.feature) {
      const db = await answerFromDatabase(decision);
      // Only short-circuit when the catalogue actually had something to show.
      // A zero-result search falls through to the model below, which can
      // suggest nearby alternatives instead of a dead-end "nothing found".
      if (db && db.results.length > 0) {
        return NextResponse.json({
          ok: true,
          reply: db.reply,
          bullets: [],
          results: db.results,
          viewAllHref: db.viewAllHref,
          feature: null,
          llm: false,
        });
      }
    }
    // Feature intents (road updates, roadside, solo, events…) are deterministic.
    if (answer.feature || isGreeting) {
      return NextResponse.json({
        ok: true,
        reply: answer.reply,
        bullets: answer.bullets,
        results: answer.results,
        viewAllHref: answer.viewAllHref,
        feature: answer.feature ?? null,
        llm: false,
      });
    }
    // Otherwise: an empty search — let the model help rather than dead-end.
  }

  // 3) Generation — only reasoning/planning/comparison queries reach the LLM,
  // grounded with a compact structured context (never raw tables).
  let reply = answer.reply;
  let bullets = answer.bullets;
  let llm = false;
  // Reasoning, unclassified queries, AND searches that found nothing — the
  // model can suggest alternatives where a template reply would dead-end.
  if (
    decision.kind === "reasoning" ||
    decision.kind === "other" ||
    decision.kind === "search"
  ) {
    try {
      const generated = await generate(message, buildSystemPrompt(answer), turns);
      if (generated) {
        reply = generated;
        bullets = []; // the prose covers the itinerary; avoid duplicate lists
        llm = true;
      }
    } catch (e) {
      console.error("[rego-ai] generation failed:", e);
      // fall back to rule-based reply silently
    }
  }

  return NextResponse.json({
    ok: true,
    reply,
    bullets,
    results: answer.results,
    viewAllHref: answer.viewAllHref,
    feature: answer.feature ?? null,
    llm,
  });
}

/* ---------------- LLM providers ---------------- */

async function generate(
  userMsg: string,
  system: string,
  turns: ChatTurn[] = []
): Promise<string | null> {
  const provider = (process.env.REGO_AI_PROVIDER || "").toLowerCase();
  if (provider === "groq") {
    // Try the configured model first, then fall back through commonly available
    // Groq models (Groq periodically decommissions older ones).
    const models = Array.from(
      new Set([
        process.env.REGO_AI_MODEL || "llama-3.3-70b-versatile",
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
      ])
    );
    for (const model of models) {
      const out = await chatCompletions(userMsg, system, turns, {
        url: "https://api.groq.com/openai/v1/chat/completions",
        key: process.env.GROQ_API_KEY,
        model,
      });
      if (out) return out;
    }
    return null;
  }
  if (provider === "openrouter") {
    return chatCompletions(userMsg, system, turns, {
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: process.env.OPENROUTER_API_KEY,
      model: process.env.REGO_AI_MODEL || "meta-llama/llama-3.1-8b-instruct:free",
    });
  }
  if (provider === "openai") {
    return chatCompletions(userMsg, system, turns, {
      url: "https://api.openai.com/v1/chat/completions",
      key: process.env.OPENAI_API_KEY,
      model: process.env.REGO_AI_MODEL || "gpt-4o-mini",
    });
  }
  if (provider === "anthropic") return anthropic(userMsg, system, turns);
  if (provider === "gemini") return gemini(userMsg, system, turns);
  return null; // not configured
}

/** Shared OpenAI-compatible chat call (OpenAI, Groq, OpenRouter, etc.). */
async function chatCompletions(
  userMsg: string,
  system: string,
  turns: ChatTurn[],
  opts: { url: string; key?: string; model: string }
): Promise<string | null> {
  if (!opts.key) return null;
  const res = await fetch(opts.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model,
      temperature: 0.4,
      max_tokens: 1400,
      messages: [
        { role: "system", content: system },
        // Prior turns give the model the thread, so follow-ups resolve.
        ...turns,
        { role: "user", content: userMsg },
      ],
    }),
  });
  if (!res.ok) {
    console.error("[rego-ai] llm", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

async function anthropic(
  userMsg: string,
  system: string,
  turns: ChatTurn[] = []
): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.REGO_AI_MODEL || "claude-3-5-haiku-latest",
      max_tokens: 1400,
      system,
      messages: [...turns, { role: "user", content: userMsg }],
    }),
  });
  if (!res.ok) {
    console.error("[rego-ai] anthropic", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = await res.json();
  return data?.content?.[0]?.text?.trim() || null;
}

async function gemini(
  userMsg: string,
  system: string,
  turns: ChatTurn[] = []
): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.REGO_AI_MODEL || "gemini-2.0-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [
          // Gemini calls the assistant role "model".
          ...turns.map((t) => ({
            role: t.role === "assistant" ? "model" : "user",
            parts: [{ text: t.content }],
          })),
          { role: "user", parts: [{ text: userMsg }] },
        ],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1400 },
      }),
    }
  );
  if (!res.ok) {
    console.error("[rego-ai] gemini", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}
