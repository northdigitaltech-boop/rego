"use client";

import * as React from "react";
import Link from "next/link";
import {
  Star,
  MapPin,
  BadgeCheck,
  ShieldCheck,
  Clock,
  Phone,
  MessageCircle,
  LifeBuoy,
  Mail,
  Navigation,
  UserRound,
  Wrench,
  Award,
  Loader2,
  CheckCircle2,
  PencilLine,
} from "lucide-react";

import { photo, formatPrice, cn } from "@/lib/utils";
import {
  serviceName,
  addRoadsideReview,
  replyToRoadsideReview,
  hasCompletedRequest,
  type RoadsideProviderRow,
  type RoadsideServiceRow,
  type RoadsideReviewRow,
} from "@/lib/roadside";
import { notifyProviderOfReview } from "@/lib/reviews";
import { trackEvent, trackViewOnce } from "@/lib/track";
import { useAuth } from "@/components/auth/auth-context";
import { AvailabilityDot, waLink } from "@/components/roadside/provider-list";
import { RoadsideRequestModal } from "@/components/roadside/request-modal";

export function RoadsideProviderProfile({
  provider,
  services,
  reviews,
}: {
  provider: RoadsideProviderRow;
  services: RoadsideServiceRow[];
  reviews: RoadsideReviewRow[];
}) {
  const [showRequest, setShowRequest] = React.useState(false);
  const track = (eventType: Parameters<typeof trackEvent>[0]["eventType"]) =>
    trackEvent({ ownerEmail: provider.owner_email, listingId: provider.id, serviceType: "roadside", eventType });
  React.useEffect(() => {
    trackViewOnce({ ownerEmail: provider.owner_email, listingId: provider.id, serviceType: "roadside", eventType: "profile_view" });
  }, [provider.owner_email, provider.id]);
  const cover = photo(provider.cover_image || provider.profile_image || "");
  const logo = photo(provider.profile_image || provider.cover_image || "");
  const rank = provider.ranking_badge || "";
  const mapQuery = encodeURIComponent(
    `${provider.address || ""} ${provider.city || "Gilgit Baltistan"}`.trim()
  );

  return (
    <div className="pb-16">
      {/* Cover */}
      <div className="container-px mt-4">
        <div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium">
          <div className="relative h-40 sm:h-56">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt={provider.business_name} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-forest" />
            )}
          </div>

          {/* Header — avatar sits below the cover, not overlapping */}
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <div className="shrink-0">
              <span className="grid h-24 w-24 place-items-center overflow-hidden rounded-3xl border-4 border-card bg-forest-50 text-forest-600 shadow-premium">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt={provider.business_name} className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="h-10 w-10" />
                )}
              </span>
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold text-forest sm:text-3xl">
                  {provider.business_name}
                </h1>
                {provider.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-semibold text-forest-600">
                    <BadgeCheck className="h-3.5 w-3.5" /> Verified
                  </span>
                )}
                {rank && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-gold-700">
                    <Award className="h-3.5 w-3.5" /> {rank}
                  </span>
                )}
                <AvailabilityDot status={provider.availability_status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="flex items-center gap-1 font-semibold text-forest">
                  <Star className="h-4 w-4 fill-gold text-gold" /> {Number(provider.rating).toFixed(1)}
                  <span className="font-normal text-muted-foreground">
                    ({provider.total_reviews} reviews)
                  </span>
                </span>
                {provider.response_time && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-4 w-4" /> {provider.response_time}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-4 w-4" /> {provider.city || "Gilgit Baltistan"}
                </span>
                {provider.is_24_7 && (
                  <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                    <ShieldCheck className="h-4 w-4" /> 24/7 Emergency
                  </span>
                )}
              </div>

              {/* Service badges */}
              {services.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {services.map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-forest"
                    >
                      <Wrench className="h-3 w-3" /> {serviceName(s.service_type)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container-px mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        {/* Main */}
        <div className="order-2 min-w-0 space-y-8 lg:order-1">
          {provider.description && (
            <section>
              <h2 className="font-display text-xl font-bold text-forest">About</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">
                {provider.description}
              </p>
            </section>
          )}

          {/* Services offered + prices */}
          {services.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-bold text-forest">Services offered</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {services.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-premium"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-semibold text-forest">
                        <Wrench className="h-4 w-4 text-gold" /> {serviceName(s.service_type)}
                      </p>
                      {s.description && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.description}</p>
                      )}
                    </div>
                    <span className="shrink-0 font-display text-sm font-bold text-forest">
                      {formatPrice(Number(s.starting_price))}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Service areas */}
          {(provider.service_areas?.length ?? 0) > 0 && (
            <section>
              <h2 className="font-display text-xl font-bold text-forest">Service areas</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {provider.service_areas!.map((a) => (
                  <span
                    key={a}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-3 py-1 text-sm text-forest"
                  >
                    <MapPin className="h-3.5 w-3.5" /> {a}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Gallery */}
          {(provider.gallery_images?.length ?? 0) > 0 && (
            <section>
              <h2 className="font-display text-xl font-bold text-forest">Gallery</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {provider.gallery_images!.map((g, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={photo(g)}
                    alt=""
                    className="h-32 w-full rounded-xl object-cover"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Reviews */}
          <ReviewsSection provider={provider} initial={reviews} />

          {/* Location map */}
          <section>
            <h2 className="font-display text-xl font-bold text-forest">Location</h2>
            {provider.address && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" /> {provider.address}
                {provider.city ? `, ${provider.city}` : ""}
              </p>
            )}
            <div className="mt-3 overflow-hidden rounded-2xl border border-border">
              <iframe
                title="Provider location"
                className="h-64 w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
              />
            </div>
          </section>
        </div>

        {/* Sticky action rail */}
        <aside className="order-1 lg:order-2">
          <div className="space-y-4 rounded-3xl border border-border/70 bg-card p-6 shadow-premium-lg lg:sticky lg:top-28">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Starting from</span>
              <span className="font-display text-2xl font-bold text-forest">
                {formatPrice(
                  services.length > 0
                    ? Math.min(...services.map((s) => Number(s.starting_price)))
                    : 0
                )}
              </span>
            </div>

            <button
              onClick={() => {
                void track("booking_request_click");
                setShowRequest(true);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-forest px-4 py-3 font-semibold text-white shadow-soft hover:opacity-95"
            >
              <LifeBuoy className="h-5 w-5" /> Request Help
            </button>

            <div className="grid grid-cols-2 gap-2">
              {provider.phone ? (
                <a
                  href={`tel:${provider.phone}`}
                  onClick={() => void track("phone_click")}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm font-semibold text-forest hover:bg-muted"
                >
                  <Phone className="h-4 w-4" /> Call Now
                </a>
              ) : (
                <span className="rounded-lg border border-border px-3 py-2.5 text-center text-sm text-muted-foreground">
                  No phone
                </span>
              )}
              {waLink(provider.whatsapp) ? (
                <a
                  href={waLink(provider.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => void track("whatsapp_click")}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm font-semibold text-green-700 hover:bg-green-100"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              ) : (
                <span className="rounded-lg border border-border px-3 py-2.5 text-center text-sm text-muted-foreground">
                  No WhatsApp
                </span>
              )}
            </div>

            <div className="space-y-2 border-t border-border pt-4 text-sm">
              {provider.phone && (
                <Row icon={Phone} label="Phone" value={provider.phone} />
              )}
              {provider.whatsapp && (
                <Row icon={MessageCircle} label="WhatsApp" value={provider.whatsapp} />
              )}
              {provider.email && <Row icon={Mail} label="Email" value={provider.email} />}
              {provider.address && (
                <Row icon={MapPin} label="Address" value={provider.address} />
              )}
              {provider.response_time && (
                <Row icon={Clock} label="Response time" value={provider.response_time} />
              )}
              <Row
                icon={ShieldCheck}
                label="Emergency 24/7"
                value={provider.is_24_7 ? "Yes" : "No"}
              />
              {mapQuery && (
                <a
                  href={`https://www.google.com/maps?q=${mapQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 pt-1 text-sm font-semibold text-forest-600 hover:text-gold"
                >
                  <Navigation className="h-4 w-4" /> Get directions
                </a>
              )}
            </div>
          </div>
        </aside>
      </div>

      {showRequest && (
        <RoadsideRequestModal
          provider={{
            id: provider.id,
            business_name: provider.business_name,
            owner_email: provider.owner_email,
            email: provider.email,
            services: services.map((s) => s.service_type),
          }}
          onClose={() => setShowRequest(false)}
        />
      )}
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </span>
      <span className={cn("text-right font-medium text-forest")}>{value}</span>
    </div>
  );
}

/* ---------------- Reviews (with customer submit) ---------------- */

function ReviewsSection({
  provider,
  initial,
}: {
  provider: RoadsideProviderRow;
  initial: RoadsideReviewRow[];
}) {
  const { user } = useAuth();
  const [reviews, setReviews] = React.useState<RoadsideReviewRow[]>(initial);
  const [canReview, setCanReview] = React.useState(false);
  const [rating, setRating] = React.useState(5);
  const [hover, setHover] = React.useState(0);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState("");

  const isOwner =
    !!user &&
    user.email.trim().toLowerCase() === (provider.owner_email ?? "").trim().toLowerCase();

  React.useEffect(() => {
    let alive = true;
    if (!user) {
      setCanReview(false);
      return;
    }
    hasCompletedRequest(user.email, provider.id).then((v) => {
      if (alive) setCanReview(v);
    });
    return () => {
      alive = false;
    };
  }, [user, provider.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!user) return;
    if (rating < 1) {
      setError("Please choose a star rating.");
      return;
    }
    setBusy(true);
    try {
      const { data, error: err } = await addRoadsideReview({
        provider_id: provider.id,
        customer_email: user.email,
        customer_name: user.name,
        rating,
        review_text: text.trim() || null,
      });
      if (err) throw err;
      if (data) setReviews([data as RoadsideReviewRow, ...reviews]);
      void notifyProviderOfReview({
        ownerEmail: provider.owner_email,
        providerName: provider.business_name,
        reviewerName: user.name,
        rating,
        text: text.trim() || null,
        url:
          typeof window !== "undefined"
            ? `${window.location.origin}/roadside/provider/${provider.id}`
            : null,
      });
      setText("");
      setRating(5);
      setDone(true);
    } catch {
      setError("Could not submit your review. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h2 className="font-display text-xl font-bold text-forest">
        Customer reviews {reviews.length > 0 && `(${reviews.length})`}
      </h2>

      {/* Submit form — only for customers with a completed request */}
      {canReview && !done && (
        <form onSubmit={submit} className="mt-3 rounded-2xl border border-border bg-card p-4 shadow-premium">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-forest">
            <PencilLine className="h-4 w-4 text-gold" /> Write a review
          </p>
          <div className="mt-2 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                className="p-0.5"
              >
                <Star
                  className={cn(
                    "h-6 w-6 transition-colors",
                    (hover || rating) >= n ? "fill-gold text-gold" : "text-border"
                  )}
                />
              </button>
            ))}
          </div>
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Share how the service went (optional)…"
            className="auth-input mt-3 resize-none"
          />
          {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gradient-forest px-5 py-2.5 text-sm font-semibold text-white shadow-soft hover:opacity-95 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
            Submit review
          </button>
        </form>
      )}

      {done && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-forest-200 bg-forest-50 px-4 py-3 text-sm font-medium text-forest-600">
          <CheckCircle2 className="h-4 w-4" /> Thanks for your review!
        </div>
      )}

      {/* Signed-in but not eligible yet */}
      {user && !canReview && !done && (
        <p className="mt-3 text-sm text-muted-foreground">
          You can leave a review once you have a completed request with this provider.
        </p>
      )}

      {/* List */}
      {reviews.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No reviews yet.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {reviews.map((r) => (
            <RoadsideReviewCard
              key={r.id}
              review={r}
              isOwner={isOwner}
              onSaved={(reply) =>
                setReviews((prev) =>
                  prev.map((x) =>
                    x.id === r.id
                      ? {
                          ...x,
                          owner_reply: reply || null,
                          owner_reply_at: reply ? new Date().toISOString() : null,
                        }
                      : x
                  )
                )
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function RoadsideReviewCard({
  review: r,
  isOwner,
  onSaved,
}: {
  review: RoadsideReviewRow;
  isOwner: boolean;
  onSaved: (reply: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [reply, setReply] = React.useState(r.owner_reply ?? "");
  const [busy, setBusy] = React.useState(false);

  const save = async () => {
    setBusy(true);
    const { error } = await replyToRoadsideReview(r.id, reply);
    setBusy(false);
    if (!error) {
      setEditing(false);
      onSaved(reply.trim());
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-premium">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-forest">{r.customer_name || "Customer"}</p>
        <span className="flex items-center gap-1 text-sm font-semibold text-forest">
          <Star className="h-3.5 w-3.5 fill-gold text-gold" /> {r.rating}
        </span>
      </div>
      {r.review_text && <p className="mt-1 text-sm text-muted-foreground">{r.review_text}</p>}

      {/* Owner reply */}
      {r.owner_reply && !editing && (
        <div className="mt-3 rounded-xl border border-forest-100 bg-forest-50/60 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-forest-600">
            Response from the provider
          </p>
          <p className="mt-1 text-sm text-forest/85">{r.owner_reply}</p>
          {isOwner && (
            <button onClick={() => setEditing(true)} className="mt-1.5 text-xs font-semibold text-forest-600 hover:text-gold">
              Edit reply
            </button>
          )}
        </div>
      )}

      {/* Owner reply form */}
      {isOwner && (!r.owner_reply || editing) && (
        <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
          {!editing && !r.owner_reply ? (
            <button onClick={() => setEditing(true)} className="text-sm font-semibold text-forest-600 hover:text-gold">
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
                <button
                  type="button"
                  onClick={save}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-forest px-4 py-2 text-sm font-semibold text-white shadow-soft hover:opacity-95 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Post reply
                </button>
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
    </div>
  );
}
