"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-context";
import {
  getReviews,
  addReview,
  replyToReview,
  notifyProviderOfReview,
  type ReviewRow,
} from "@/lib/reviews";
import { cn } from "@/lib/utils";

/**
 * Verified-only reviews. Anyone can read; only a registered user who has a
 * confirmed booking for this item (canReview) may post.
 */
export function ReviewsSection({
  itemId,
  canReview,
  ownerEmail,
  providerName,
}: {
  itemId: string;
  canReview: boolean;
  ownerEmail?: string | null;
  providerName?: string | null;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [reviews, setReviews] = React.useState<ReviewRow[]>([]);
  const [rating, setRating] = React.useState(5);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  const load = React.useCallback(async () => {
    setReviews(await getReviews(itemId));
  }, [itemId]);
  React.useEffect(() => {
    load();
  }, [load]);

  const avg = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  const isOwner =
    !!user &&
    !!ownerEmail &&
    user.email.trim().toLowerCase() === ownerEmail.trim().toLowerCase();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push(`/signin?redirect=${encodeURIComponent(`/listings/${itemId}`)}`);
      return;
    }
    setMsg("");
    setBusy(true);
    const { error } = await addReview({
      hotel_id: itemId,
      customer_email: user.email,
      customer_name: user.name,
      customer_avatar: user.avatar ?? null,
      rating,
      text: text.trim() || null,
      owner_email: ownerEmail ?? null,
    });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    // Alert the provider (best-effort; never blocks the review).
    void notifyProviderOfReview({
      ownerEmail,
      providerName,
      reviewerName: user.name,
      rating,
      text: text.trim() || null,
      url: typeof window !== "undefined" ? `${window.location.origin}/listings/${itemId}` : null,
    });
    setText("");
    setRating(5);
    setMsg("Thanks! Your review was posted.");
    await load();
  };

  return (
    <section className="mt-12">
      <h2 className="font-display text-xl font-bold text-forest">Guest reviews</h2>

      <div className="mt-4 flex items-center gap-5 rounded-2xl border border-border bg-card p-6 shadow-premium">
        <div className="shrink-0 text-center">
          <p className="font-display text-5xl font-extrabold text-forest">
            {avg ? avg.toFixed(1) : "—"}
          </p>
          <div className="mt-1 flex justify-center gap-0.5">
            {Array.from({ length: 5 }).map((_, j) => (
              <Star
                key={j}
                className={
                  j < Math.round(avg)
                    ? "h-4 w-4 fill-gold text-gold"
                    : "h-4 w-4 text-border"
                }
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {reviews.length} review{reviews.length === 1 ? "" : "s"}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Only verified guests who booked can leave a review — so every rating
          you see is from a real customer.
        </p>
      </div>

      {/* Write a review (gated) */}
      <div className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-premium">
        <h3 className="font-display text-base font-bold text-forest">
          Write a review
        </h3>
        {!user ? (
          <p className="mt-2 text-sm text-muted-foreground">
            <button
              onClick={() => router.push(`/signin?redirect=${encodeURIComponent(`/listings/${itemId}`)}`)}
              className="font-semibold text-forest-600 hover:text-gold"
            >
              Sign in
            </button>{" "}
            to leave a review.
          </p>
        ) : !canReview ? (
          <p className="mt-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Only guests with a confirmed booking can review this. Book and
            complete your trip to share your experience.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-3">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setRating(i + 1)}
                  aria-label={`${i + 1} star`}
                >
                  <Star
                    className={cn(
                      "h-7 w-7 transition-colors",
                      i < rating ? "fill-gold text-gold" : "text-border"
                    )}
                  />
                </button>
              ))}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="Share your experience…"
              className="auth-input resize-none"
            />
            {msg && (
              <p className="text-sm font-medium text-forest-600">{msg}</p>
            )}
            <Button type="submit" variant="gold" className="rounded-lg" disabled={busy}>
              {busy ? "Posting…" : "Post review"}
            </Button>
          </form>
        )}
      </div>

      {/* List */}
      {reviews.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-border bg-muted/40 py-8 text-center text-sm text-muted-foreground">
          No reviews yet.
        </p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {reviews.map((r) => (
            <ReviewCard key={r.id} review={r} isOwner={isOwner} onChanged={load} />
          ))}
        </div>
      )}
    </section>
  );
}

export function ReviewCard({
  review: r,
  isOwner,
  onChanged,
}: {
  review: ReviewRow;
  isOwner: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [reply, setReply] = React.useState(r.owner_reply ?? "");
  const [busy, setBusy] = React.useState(false);

  const save = async () => {
    setBusy(true);
    const { error } = await replyToReview(r.id, reply);
    setBusy(false);
    if (!error) {
      setEditing(false);
      await onChanged();
    }
  };

  return (
    <figure className="rounded-2xl border border-border bg-card p-5 shadow-premium">
      <div className="flex items-center gap-1">
        {Array.from({ length: r.rating }).map((_, j) => (
          <Star key={j} className="h-4 w-4 fill-gold text-gold" />
        ))}
      </div>
      {r.text && (
        <blockquote className="mt-2 text-sm leading-relaxed text-forest/85">“{r.text}”</blockquote>
      )}
      <figcaption className="mt-4 flex items-center gap-3 border-t border-border pt-3">
        {r.customer_avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.customer_avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <span className="grid h-9 w-9 place-items-center rounded-full bg-forest-50 text-sm font-bold text-forest-600">
            {(r.customer_name ?? "G").charAt(0).toUpperCase()}
          </span>
        )}
        <div>
          <p className="text-sm font-semibold text-forest">{r.customer_name ?? "Guest"}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(r.created_at).toLocaleDateString()}
          </p>
        </div>
      </figcaption>

      {/* Owner reply */}
      {r.owner_reply && !editing && (
        <div className="mt-3 rounded-xl border border-forest-100 bg-forest-50/60 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-forest-600">
            Response from the owner
          </p>
          <p className="mt-1 text-sm text-forest/85">{r.owner_reply}</p>
          {isOwner && (
            <button
              onClick={() => setEditing(true)}
              className="mt-1.5 text-xs font-semibold text-forest-600 hover:text-gold"
            >
              Edit reply
            </button>
          )}
        </div>
      )}

      {/* Owner reply form */}
      {isOwner && (!r.owner_reply || editing) && (
        <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
          {!editing && !r.owner_reply ? (
            <button
              onClick={() => setEditing(true)}
              className="text-sm font-semibold text-forest-600 hover:text-gold"
            >
              Reply to this review
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                rows={2}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write a public response…"
                className="auth-input resize-none"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="gold"
                  className="rounded-lg"
                  disabled={busy}
                  onClick={save}
                >
                  {busy ? "Saving…" : "Post reply"}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setReply(r.owner_reply ?? "");
                  }}
                  className="text-sm font-semibold text-muted-foreground hover:text-forest"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
