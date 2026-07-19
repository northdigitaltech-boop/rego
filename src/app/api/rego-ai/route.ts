import { NextResponse } from "next/server";

import { rateLimit, clientIp } from "@/lib/rate-limit";
import { answerQuery, buildSystemPrompt } from "@/lib/rego-ai";
import { classifyQuery, answerFromDatabase } from "@/lib/ai-router";

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
  if (!allowedHost(req)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const rl = rateLimit(`regoai:${clientIp(req)}`, 20, 60_000);
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
  const { message } = (body ?? {}) as { message?: unknown };
  if (typeof message !== "string" || !message.trim() || message.length > MAX_MSG) {
    return NextResponse.json({ ok: false, error: "Invalid message" }, { status: 400 });
  }

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
  const decision = classifyQuery(message);

  // Greetings get the friendly canned welcome — no tokens.
  const isGreeting =
    /^(hi|hey|hello|hy|salam|asalam|assalam|aoa|assalamualaikum|good (morning|evening|afternoon))\b/i.test(
      message.trim()
    ) && message.trim().length < 30;

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
      if (db) {
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
    // Feature intents (road updates, roadside, solo, events…) or a DB miss:
    // the deterministic catalogue answer already covers it — still no LLM.
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

  // 3) Generation — only reasoning/planning/comparison queries reach the LLM,
  // grounded with a compact structured context (never raw tables).
  let reply = answer.reply;
  let bullets = answer.bullets;
  let llm = false;
  if (decision.kind === "reasoning" || decision.kind === "other") {
    try {
      const generated = await generate(message, buildSystemPrompt(answer));
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

async function generate(userMsg: string, system: string): Promise<string | null> {
  const provider = (process.env.REGO_AI_PROVIDER || "").toLowerCase();
  if (provider === "groq") {
    return chatCompletions(userMsg, system, {
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: process.env.GROQ_API_KEY,
      model: process.env.REGO_AI_MODEL || "llama-3.3-70b-versatile",
    });
  }
  if (provider === "openrouter") {
    return chatCompletions(userMsg, system, {
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: process.env.OPENROUTER_API_KEY,
      model: process.env.REGO_AI_MODEL || "meta-llama/llama-3.1-8b-instruct:free",
    });
  }
  if (provider === "openai") {
    return chatCompletions(userMsg, system, {
      url: "https://api.openai.com/v1/chat/completions",
      key: process.env.OPENAI_API_KEY,
      model: process.env.REGO_AI_MODEL || "gpt-4o-mini",
    });
  }
  if (provider === "anthropic") return anthropic(userMsg, system);
  if (provider === "gemini") return gemini(userMsg, system);
  return null; // not configured
}

/** Shared OpenAI-compatible chat call (OpenAI, Groq, OpenRouter, etc.). */
async function chatCompletions(
  userMsg: string,
  system: string,
  opts: { url: string; key?: string; model: string }
): Promise<string | null> {
  if (!opts.key) return null;
  const res = await fetch(opts.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model,
      temperature: 0.4,
      max_tokens: 400,
      messages: [
        { role: "system", content: system },
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

async function anthropic(userMsg: string, system: string): Promise<string | null> {
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
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if (!res.ok) {
    console.error("[rego-ai] anthropic", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = await res.json();
  return data?.content?.[0]?.text?.trim() || null;
}

async function gemini(userMsg: string, system: string): Promise<string | null> {
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
        contents: [{ role: "user", parts: [{ text: userMsg }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
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
