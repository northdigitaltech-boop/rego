"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Sparkles, Send, MapPin, Star, ArrowRight, Compass, Mic } from "lucide-react";

import { answerQuery, AI_SUGGESTIONS, type AiAnswer } from "@/lib/rego-ai";
import { type Listing } from "@/lib/data";
import { photo, formatPrice, cn } from "@/lib/utils";

interface Msg {
  id: number;
  role: "user" | "ai";
  text: string;
  answer?: AiAnswer;
}

export function RegoAiChat() {
  const params = useSearchParams();
  const initialQ = params.get("q") ?? "";
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [thinking, setThinking] = React.useState(false);
  const idRef = React.useRef(0);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const started = React.useRef(false);

  // Voice input (browser Web Speech API — free, no key).
  const [listening, setListening] = React.useState(false);
  const [voiceSupported, setVoiceSupported] = React.useState(false);
  const [voiceLang, setVoiceLang] = React.useState<"en-US" | "ur-PK">("en-US");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = React.useRef<any>(null);
  const finalRef = React.useRef("");

  const ask = React.useCallback((text: string) => {
    const q = text.trim();
    if (!q) return;
    setInput("");
    setMessages((m) => [...m, { id: ++idRef.current, role: "user", text: q }]);
    setThinking(true);

    const push = (answer: AiAnswer) => {
      setMessages((m) => [...m, { id: ++idRef.current, role: "ai", text: answer.reply, answer }]);
      setThinking(false);
    };

    // Ask the server (LLM-grounded if configured). Fall back to the on-device
    // brain if the request fails, so the assistant always responds.
    (async () => {
      try {
        const res = await fetch("/api/rego-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: q }),
        });
        const data = await res.json();
        if (data?.ok) {
          push({
            reply: data.reply,
            bullets: data.bullets ?? [],
            results: data.results ?? [],
            viewAllHref: data.viewAllHref,
            feature: data.feature ?? undefined,
          });
          return;
        }
        throw new Error("bad response");
      } catch {
        push(answerQuery(q));
      }
    })();
  }, []);

  // Auto-send the query passed from the homepage CTA.
  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (initialQ) ask(initialQ);
  }, [initialQ, ask]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // Set up speech recognition once (if the browser supports it).
  React.useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setVoiceSupported(true);
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setInput(text);
      finalRef.current = text;
    };
    rec.onend = () => {
      setListening(false);
      const t = finalRef.current.trim();
      finalRef.current = "";
      if (t) ask(t); // hands-free: send what was heard
    };
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    };
  }, [ask]);

  const toggleVoice = () => {
    const rec = recRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      return;
    }
    setInput("");
    finalRef.current = "";
    try {
      rec.lang = voiceLang; // English or Urdu, chosen via the toggle
      rec.start();
      setListening(true);
    } catch {
      /* already started */
    }
  };

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col">
      {/* Conversation */}
      <div className="flex-1 space-y-4">
        {messages.length === 0 && !thinking && (
          <div className="rounded-3xl border border-border/70 bg-card p-6 text-center shadow-premium">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-forest text-gold">
              <Compass className="h-6 w-6" />
            </span>
            <p className="mt-3 font-display text-lg font-bold text-forest">Ask me anything about your GB trip</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Hotels, jeeps &amp; rentals, tour packages, guides, food or a full day-by-day plan — just ask.
            </p>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-forest-600 px-4 py-2.5 text-sm text-white">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-forest text-gold">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="rounded-2xl rounded-tl-sm border border-border/70 bg-card px-4 py-3 text-sm text-forest shadow-sm">
                  {m.text}
                </div>

                {m.answer && m.answer.bullets.length > 0 && (
                  <div className="rounded-2xl border border-forest-100 bg-forest-50/50 px-4 py-3">
                    <ol className="space-y-1.5 text-sm text-forest">
                      {m.answer.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {m.answer?.feature && (
                  <Link
                    href={m.answer.feature.href}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-forest-100 bg-gradient-to-br from-forest-50/70 to-gold/5 px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-premium"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-forest text-gold">
                        <Compass className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block font-display text-sm font-bold text-forest">{m.answer.feature.label}</span>
                        <span className="block text-xs text-muted-foreground">Open this feature</span>
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-forest-600" />
                  </Link>
                )}

                {m.answer && m.answer.results.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {m.answer.results.map((l) => (
                      <ResultCard key={l.id} listing={l} />
                    ))}
                  </div>
                )}

                {m.answer?.viewAllHref && m.answer.results.length > 0 && (
                  <Link
                    href={m.answer.viewAllHref}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-forest-600 hover:text-gold"
                  >
                    View all matching listings <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          )
        )}

        {thinking && (
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-forest text-gold">
              <Sparkles className="h-4 w-4 animate-pulse" />
            </span>
            <div className="flex gap-1 rounded-2xl border border-border/70 bg-card px-4 py-3">
              <Dot /> <Dot delay={150} /> <Dot delay={300} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {AI_SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-forest transition-colors hover:border-gold/60 hover:text-gold"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="sticky bottom-4 mt-6 flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-premium"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={listening ? "Listening… speak now" : "e.g. Find a budget hotel in Hunza, or plan a 4-day Skardu trip…"}
          className="flex-1 bg-transparent px-3 py-2 text-sm text-forest focus:outline-none"
        />
        {voiceSupported && (
          <button
            type="button"
            onClick={() => setVoiceLang((l) => (l === "en-US" ? "ur-PK" : "en-US"))}
            aria-label="Voice language"
            title="Switch voice language"
            className="grid h-10 w-11 place-items-center rounded-xl border border-border text-xs font-bold text-forest hover:bg-muted"
          >
            {voiceLang === "en-US" ? "EN" : "اردو"}
          </button>
        )}
        {voiceSupported && (
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={listening ? "Stop voice input" : "Ask by voice"}
            title={listening ? "Stop" : `Ask by voice (${voiceLang === "en-US" ? "English" : "Urdu"})`}
            className={cn(
              "relative grid h-10 w-10 place-items-center rounded-xl transition-colors",
              listening ? "bg-red-500 text-white" : "border border-border text-forest hover:bg-muted"
            )}
          >
            {listening && (
              <span className="absolute inset-0 animate-ping rounded-xl bg-red-500/50" />
            )}
            <Mic className="relative h-4 w-4" />
          </button>
        )}
        <button
          type="submit"
          disabled={!input.trim()}
          className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-gold text-forest-900 disabled:opacity-50"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function ResultCard({ listing: l }: { listing: Listing }) {
  return (
    <Link
      href={`/listings/${l.id}`}
      className="group flex gap-3 rounded-2xl border border-border/70 bg-card p-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-premium"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo(l.image)} alt={l.title} className="h-20 w-20 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <span className="rounded-full bg-forest-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-forest-600">
          {l.categoryLabel}
        </span>
        <p className="mt-1 line-clamp-1 font-display text-sm font-bold text-forest group-hover:text-forest-600">{l.title}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {l.location}</span>
          <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-gold text-gold" /> {l.rating.toFixed(1)}</span>
        </div>
        <p className="mt-1 font-display text-sm font-bold text-forest">
          {l.price > 0 ? <>{formatPrice(l.price)}<span className="text-[10px] font-normal text-muted-foreground">/{l.unit}</span></> : "Enquire"}
        </p>
      </div>
    </Link>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <span
      className="h-2 w-2 animate-bounce rounded-full bg-forest-600"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}
