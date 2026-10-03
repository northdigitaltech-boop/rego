"use client";

import * as React from "react";
import { BedDouble, ChevronDown, Maximize2, Mountain, Award, Users, Wifi } from "lucide-react";

import { cn } from "@/lib/utils";

/* ============================================================
 * "Room details" on a public room card: up to six cards —
 * Room size · Max guests · Bed setup · Classification ·
 * Scenic view · Wi-Fi & climate.
 *
 * Every value is what the owner typed for THIS room. Nothing is
 * defaulted: a field left empty is not shown, and if the owner
 * filled none of the four extra details the toggle does not
 * appear at all (guests and beds are already on the card).
 * ============================================================ */

export interface RoomDetailValues {
  room_size?: string | null;
  guests?: number | null;
  beds?: string | null;
  classification?: string | null;
  view_type?: string | null;
  wifi_climate?: string | null;
}

const clean = (v?: string | null) => (v ?? "").trim();

export function RoomDetails({ room }: { room: RoomDetailValues }) {
  const [open, setOpen] = React.useState(false);

  const hasExtra = [room.room_size, room.classification, room.view_type, room.wifi_climate].some(
    (v) => clean(v)
  );
  if (!hasExtra) return null;

  const cards: { label: string; value: string; icon: typeof Users }[] = [];
  if (clean(room.room_size)) cards.push({ label: "Room size", value: clean(room.room_size), icon: Maximize2 });
  if (room.guests && room.guests > 0)
    cards.push({
      label: "Max guests",
      value: `Up to ${room.guests} ${room.guests === 1 ? "person" : "persons"}`,
      icon: Users,
    });
  if (clean(room.beds)) cards.push({ label: "Bed setup", value: clean(room.beds), icon: BedDouble });
  if (clean(room.classification))
    cards.push({ label: "Classification", value: clean(room.classification), icon: Award });
  if (clean(room.view_type)) cards.push({ label: "Scenic view", value: clean(room.view_type), icon: Mountain });
  if (clean(room.wifi_climate))
    cards.push({ label: "Wi-Fi & climate", value: clean(room.wifi_climate), icon: Wifi });

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-sm font-semibold text-forest-600 hover:text-gold"
      >
        {open ? "Hide room details" : "Room details"}
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.label}
                className="rounded-xl border border-border bg-muted/30 px-3 py-3 text-center"
              >
                <Icon className="mx-auto h-5 w-5 text-gold-700" />
                <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {c.label}
                </p>
                <p className="mt-0.5 break-words text-sm font-bold text-forest">{c.value}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
