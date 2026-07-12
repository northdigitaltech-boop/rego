"use client";

import * as React from "react";
import Link from "next/link";
import {
  Star,
  MapPin,
  ShieldCheck,
  Clock,
  Phone,
  MessageCircle,
  LifeBuoy,
  UserRound,
  BadgeCheck,
} from "lucide-react";

import { photo, formatPrice, cn } from "@/lib/utils";
import { serviceName, type RoadsideProviderRow } from "@/lib/roadside";
import { RoadsideRequestModal } from "@/components/roadside/request-modal";

export type ProviderListItem = {
  provider: RoadsideProviderRow;
  startingPrice: number;
};

export function waLink(num?: string | null) {
  const digits = (num ?? "").replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

export function AvailabilityDot({ status }: { status: string }) {
  const online = status === "available";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        online ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", online ? "bg-green-500" : "bg-gray-400")} />
      {online ? "Available" : "Offline"}
    </span>
  );
}

export function RoadsideProviderList({
  items,
  service,
}: {
  items: ProviderListItem[];
  service: string;
}) {
  const [requesting, setRequesting] = React.useState<ProviderListItem | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-20 text-center">
        <LifeBuoy className="mx-auto h-10 w-10 text-forest-600" />
        <p className="mt-3 font-display text-lg font-semibold text-forest">
          No providers available yet
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          No verified providers have listed {serviceName(service)} yet. Check back soon or explore
          other roadside services.
        </p>
        <Link
          href="/roadside"
          className="mt-4 inline-block rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-forest hover:bg-muted"
        >
          Back to all services
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(({ provider: p, startingPrice }) => (
          <div
            key={p.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-premium transition-shadow hover:shadow-card"
          >
            <div className="flex items-start gap-3 p-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-forest-50 text-forest-600">
                {p.profile_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo(p.profile_image)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="h-7 w-7" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/roadside/provider/${p.id}`}
                    className="truncate font-display font-bold text-forest hover:text-gold"
                  >
                    {p.business_name}
                  </Link>
                  {p.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-gold" />}
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {p.city || "Gilgit Baltistan"}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1 text-xs font-semibold text-forest">
                    <Star className="h-3.5 w-3.5 fill-gold text-gold" />
                    {Number(p.rating).toFixed(1)}
                    <span className="font-normal text-muted-foreground">({p.total_reviews})</span>
                  </span>
                  <AvailabilityDot status={p.availability_status} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 px-4 pb-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {p.response_time || "Fast response"}
              </span>
              {p.is_24_7 && (
                <span className="flex items-center gap-1 font-semibold text-red-600">
                  <ShieldCheck className="h-3.5 w-3.5" /> 24/7 Emergency
                </span>
              )}
              <span className="col-span-2 mt-0.5 font-display text-sm font-bold text-forest">
                From {formatPrice(startingPrice)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">/ callout</span>
              </span>
            </div>

            <div className="mt-auto grid grid-cols-2 gap-2 border-t border-border p-3">
              {p.phone ? (
                <a
                  href={`tel:${p.phone}`}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-forest hover:bg-muted"
                >
                  <Phone className="h-4 w-4" /> Call
                </a>
              ) : (
                <span className="rounded-lg border border-border px-3 py-2 text-center text-sm text-muted-foreground">
                  No phone
                </span>
              )}
              {waLink(p.whatsapp) ? (
                <a
                  href={waLink(p.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-100"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              ) : (
                <span className="rounded-lg border border-border px-3 py-2 text-center text-sm text-muted-foreground">
                  No WhatsApp
                </span>
              )}
              <button
                onClick={() => setRequesting({ provider: p, startingPrice })}
                className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg bg-gradient-forest px-3 py-2.5 text-sm font-semibold text-white shadow-soft hover:opacity-95"
              >
                <LifeBuoy className="h-4 w-4" /> Request Help
              </button>
              <Link
                href={`/roadside/provider/${p.id}`}
                className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-forest hover:bg-muted"
              >
                <UserRound className="h-4 w-4" /> View Profile
              </Link>
            </div>
          </div>
        ))}
      </div>

      {requesting && (
        <RoadsideRequestModal
          provider={{
            id: requesting.provider.id,
            business_name: requesting.provider.business_name,
            owner_email: requesting.provider.owner_email,
            email: requesting.provider.email,
            services: [service],
          }}
          defaultService={service}
          onClose={() => setRequesting(null)}
        />
      )}
    </>
  );
}
