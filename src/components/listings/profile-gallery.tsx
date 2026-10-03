"use client";

import * as React from "react";
import { Images, X, ChevronLeft, ChevronRight } from "lucide-react";

import { photo, isStockPhoto } from "@/lib/utils";
import { useScrollLock } from "@/lib/use-scroll-lock";

/**
 * How many photos the hero collage shows: 1 large + a 2×2 grid of 4.
 * The Gallery section below skips this many so nothing is shown twice.
 */
export const HERO_PHOTO_COUNT = 5;

/**
 * Premium property-style gallery: large main image on the left, a 2×2 grid of
 * up to 4 smaller images on the right, a "View all photos" overlay on the last
 * tile, and a full-screen lightbox. Uses the listing's own images.
 */
export function ProfileGallery({ images, title }: { images: string[]; title: string }) {
  const imgs = React.useMemo(
    () => Array.from(new Set((images || []).filter(Boolean))).map((u) => photo(u)),
    [images]
  );
  const [open, setOpen] = React.useState(false);
  const [idx, setIdx] = React.useState(0);

  /* ------------------------------------------------------------------
     NO PHOTOS IS A FACT, NOT A FAILURE

     This used to return null, which left a headline floating above the
     feature cards and read as a page that had not finished loading.
     Galleries were therefore padded with stock images to avoid it —
     five invented photographs to dodge one honest empty state.

     Saying so plainly is better for everyone. A traveller learns
     something real about how far along this listing is, and an owner
     who visits their own page sees the gap and fills it.
     ------------------------------------------------------------------ */
  if (imgs.length === 0) {
    return (
      <div className="grid h-56 place-items-center rounded-2xl border border-dashed border-border bg-muted/40 px-6 text-center sm:h-72">
        <div>
          <Images className="mx-auto h-7 w-7 text-muted-foreground/60" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-forest">No photos yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {title} hasn&rsquo;t uploaded photos. Contact them for pictures before booking.
          </p>
        </div>
      </div>
    );
  }

  const main = imgs[0];
  const side = imgs.slice(1, 5);
  const extra = Math.max(0, imgs.length - 5);

  const openAt = (i: number) => {
    setIdx(i);
    setOpen(true);
  };

  return (
    <>
      <div className="grid grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-3xl sm:gap-2.5 lg:h-[26rem]">
        {/* Main image */}
        <button
          onClick={() => openAt(0)}
          aria-label={`View photos of ${title}`}
          className="group relative col-span-4 row-span-2 h-56 overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2 sm:h-72 lg:col-span-2 lg:h-auto"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={main} alt={title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        </button>

        {/* Side 2×2 grid */}
        {side.map((src, i) => {
          const isLast = i === side.length - 1;
          return (
            <button
              key={src + i}
              onClick={() => openAt(i + 1)}
              aria-label={`View photo ${i + 2} of ${title}`}
              className="group relative col-span-2 hidden h-[8.2rem] overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2 sm:col-span-1 lg:block lg:h-auto"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`${title} ${i + 2}`} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              {isLast && (
                <span className="absolute inset-0 flex items-center justify-center bg-forest-900/55 text-sm font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 lg:opacity-100">
                  <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur-md">
                    <Images className="h-4 w-4" /> View all photos{extra > 0 ? ` (+${extra})` : ""}
                  </span>
                </span>
              )}
            </button>
          );
        })}

        {/* Tablet/mobile: a 2-col strip of the side images below the main */}
        {side.length > 0 && (
          <div className="col-span-4 grid grid-cols-2 gap-2 sm:gap-2.5 lg:hidden">
            {side.map((src, i) => (
              <button
                key={"m" + src + i}
                onClick={() => openAt(i + 1)}
                aria-label={`View photo ${i + 2} of ${title}`}
                className="group relative h-28 overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2 sm:h-32"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`${title} ${i + 2}`} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                {i === side.length - 1 && (
                  <span className="absolute inset-0 flex items-center justify-center bg-forest-900/55 text-xs font-semibold text-white">
                    <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 backdrop-blur-md">
                      <Images className="h-3.5 w-3.5" /> View all{extra > 0 ? ` +${extra}` : ""}
                    </span>
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

        {open && <Lightbox images={imgs} index={idx} setIndex={setIdx} onClose={() => setOpen(false)} title={title} />}
    </>
  );
}

/**
 * Simple clickable photo grid + the same slide lightbox. Drop-in replacement
 * for the plain "Gallery" image grids on service profiles: every photo opens
 * full-screen with previous/next arrows, thumbnails and keyboard navigation.
 */
export function GalleryGrid({
  images,
  title,
  className = "mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4",
  itemClassName = "h-36",
  skip = 0,
}: {
  images: string[];
  title: string;
  className?: string;
  itemClassName?: string;
  /**
   * Hide the first N photos from the grid — used on profile pages where
   * ProfileGallery already shows them in the hero collage, so this section
   * doesn't repeat them. The lightbox still browses the FULL set, so
   * "photo 6 of 14" stays truthful.
   */
  skip?: number;
}) {
  const imgs = React.useMemo(
    () => Array.from(new Set((images || []).filter(Boolean))).map((u) => photo(u, 700)),
    [images]
  );
  const [open, setOpen] = React.useState(false);
  const [idx, setIdx] = React.useState(0);

  const shown = imgs.slice(skip);
  if (shown.length === 0) return null;

  return (
    <>
      <div className={className}>
        {shown.map((src, i) => {
          const realIndex = i + skip;
          return (
            <button
              key={src + realIndex}
              type="button"
              onClick={() => {
                setIdx(realIndex);
                setOpen(true);
              }}
              aria-label={`View photo ${realIndex + 1} of ${title}`}
              className={`group relative overflow-hidden rounded-2xl shadow-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2 ${itemClassName}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`${title} photo ${realIndex + 1}`}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </button>
          );
        })}
      </div>
        {open && <Lightbox images={imgs} index={idx} setIndex={setIdx} onClose={() => setOpen(false)} title={title} />}
    </>
  );
}

/**
 * The photo on the left of a room card ("Standard Chalet"), and the room's
 * own gallery when it is tapped.
 *
 * Owners could already upload photos per room in their dashboard (rooms,
 * homestay_rooms and hostel_rooms all have `images`), but the public room
 * card never showed them, so a traveller choosing between two room types
 * saw two text boxes.
 *
 * Only the room's own uploads — never the property's photos and never stock
 * filler. A room with no photo renders nothing, and the card looks exactly
 * as it did before.
 */
export function RoomPhotos({
  images,
  title,
}: {
  images?: string[] | null;
  title: string;
}) {
  const real = React.useMemo(
    () =>
      Array.from(
        new Set((images || []).filter((u) => typeof u === "string" && u.trim() && !isStockPhoto(u)))
      ),
    [images]
  );
  const big = React.useMemo(() => real.map((u) => photo(u, 1200)), [real]);
  const [open, setOpen] = React.useState(false);
  const [idx, setIdx] = React.useState(0);

  if (real.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIdx(0);
          setOpen(true);
        }}
        aria-label={`View ${real.length} photo${real.length === 1 ? "" : "s"} of ${title}`}
        className="group relative h-40 w-full shrink-0 overflow-hidden rounded-2xl bg-muted shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2 sm:h-28 sm:w-36"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo(real[0], 400)}
          alt={`${title} photo 1`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {real.length > 1 && (
          <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">
            <Images className="h-3 w-3" /> {real.length}
          </span>
        )}
      </button>
      {open && (
        <Lightbox images={big} index={idx} setIndex={setIdx} onClose={() => setOpen(false)} title={title} />
      )}
    </>
  );
}

function Lightbox({
  images,
  index,
  setIndex,
  onClose,
  title,
}: {
  images: string[];
  index: number;
  setIndex: (i: number) => void;
  onClose: () => void;
  title: string;
}) {
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const go = React.useCallback(
    (d: number) => setIndex((index + d + images.length) % images.length),
    [index, images.length, setIndex]
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus(); // move focus into the dialog
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);
  useScrollLock(true);

  const btn =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-forest-900";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} photo gallery`}
      className="fixed inset-0 z-[130] flex flex-col bg-forest-900/90 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-medium">
          {index + 1} / {images.length}
        </span>
        <button ref={closeRef} onClick={onClose} aria-label="Close gallery" className={`grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20 ${btn}`}>
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4 pb-4">
        <button onClick={() => go(-1)} aria-label="Previous photo" className={`absolute left-3 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 ${btn}`}>
          <ChevronLeft className="h-6 w-6" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[index]} alt={`${title} ${index + 1}`} className="max-h-full max-w-full rounded-2xl object-contain" />
        <button onClick={() => go(1)} aria-label="Next photo" className={`absolute right-3 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 ${btn}`}>
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-4">
        {images.map((src, i) => (
          <button
            key={src + i}
            onClick={() => setIndex(i)}
            aria-label={`Go to photo ${i + 1}`}
            aria-current={i === index}
            className={
              "h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition " + btn + " " +
              (i === index ? "border-gold" : "border-transparent opacity-60 hover:opacity-100")
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
