import Link from "next/link";
import {
  Aperture,
  Bike,
  Building2,
  Camera,
  Car,
  Home,
  Package,
  Search,
  Star,
  Tent,
  Truck,
  type LucideIcon,
} from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ServiceCard } from "@/components/home/service-cards";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { buildMetadata } from "@/lib/seo";
import {
  RENTAL_TYPE_DEFS,
  getRentalCounts,
  getRentals,
  rentalToListing,
  rentalTypeBySlug,
  type RentalSort,
} from "@/lib/rentals";
import { cn } from "@/lib/utils";

/* ============================================================
 * /rentals — one page for everything on Rego that can be hired.
 *
 * A DISCOVERY layer, not a second marketplace. Every card here
 * links to the listing's own detail page — the same URL it has
 * under Transport, Photography or Accommodation — so the two
 * routes never compete with each other in search results.
 *
 * Fully server-rendered, and every filter is a real URL. That
 * makes "jeep rental skardu" a crawlable page rather than a
 * state a crawler cannot reach, and it means the back button
 * works. There is no client component on this page at all.
 * ============================================================ */

export const revalidate = 300;

const ICONS: Record<string, LucideIcon> = {
  Car,
  Bike,
  Truck,
  Camera,
  Aperture,
  Tent,
  Home,
  Building2,
  Package,
};

const SORTS: { id: RentalSort; label: string }[] = [
  { id: "recommended", label: "Recommended" },
  { id: "price_asc", label: "Price: Low to High" },
  { id: "price_desc", label: "Price: High to Low" },
  { id: "rating", label: "Highest Rated" },
  { id: "newest", label: "Newest" },
];

const PER_PAGE = 24;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined): string =>
  (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const def = rentalTypeBySlug(one(sp.type));
  const place = one(sp.location);

  /* A filtered view gets its own title, but the canonical points back at
     the type page without the extra filters — otherwise every price
     bracket becomes a near-duplicate of the same list. */
  if (def) {
    /* A type with nothing listed is a dead end — keep it out of the index
       until somebody lists one (the sitemap applies the same rule). {}
       means the count failed, which is not the same as empty. */
    /* GSC (24 Nov): the /rentals?type= pages were reported as duplicates of
       /rentals and not indexed. They are filters of one list, so they now
       point at /rentals and are not indexed on their own; they stay fully
       usable and crawlable (follow) for visitors. */
    return buildMetadata({
      noindex: true,
      title: place
        ? `${def.label} in ${place} | REGO`
        : `${def.label} in Gilgit-Baltistan | REGO`,
      description: `${def.blurb} available to hire across Gilgit-Baltistan through REGO. Compare prices, providers and locations.`,
      path: "/rentals",
    });
  }

  return buildMetadata({
    title: "Rentals in Gilgit-Baltistan | Cars, Jeeps, Cameras & Camping Gear | REGO",
    description:
      "Rent cars, jeeps, bikes, cameras, camping equipment, houses and co-working spaces across Gilgit-Baltistan through REGO.",
    path: "/rentals",
  });
}

export default async function RentalsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;

  const typeDef = rentalTypeBySlug(one(sp.type));
  const q = one(sp.q);
  const location = one(sp.location);
  const sortParam = one(sp.sort) as RentalSort;
  const sort: RentalSort = SORTS.some((s) => s.id === sortParam) ? sortParam : "recommended";
  const driverParam = one(sp.driver);
  const driver = driverParam === "with" || driverParam === "without" ? driverParam : null;
  const verifiedOnly = one(sp.verified) === "1";
  const minRating = one(sp.rating) ? Number(one(sp.rating)) : null;
  const maxPrice = one(sp.max) ? Number(one(sp.max)) : null;
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const [counts, result] = await Promise.all([
    getRentalCounts(),
    getRentals({
      type: typeDef?.type ?? null,
      search: q || null,
      location: location || null,
      maxPrice: Number.isFinite(maxPrice) ? maxPrice : null,
      minRating: Number.isFinite(minRating) ? minRating : null,
      driver,
      verifiedOnly,
      sort,
      limit: PER_PAGE,
      offset: (page - 1) * PER_PAGE,
    }),
  ]);

  const { rentals, total, degraded } = result;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  /* Build a URL from the current one plus a patch. Every control on this
     page is a link, so this is the only navigation primitive needed. */
  const href = (patch: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const base: Record<string, string> = {
      type: typeDef?.slug ?? "",
      q,
      location,
      sort: sort === "recommended" ? "" : sort,
      driver: driver ?? "",
      verified: verifiedOnly ? "1" : "",
      rating: minRating ? String(minRating) : "",
      max: maxPrice ? String(maxPrice) : "",
    };
    for (const [k, v] of Object.entries({ ...base, ...patch })) {
      const s = v === undefined ? "" : String(v);
      if (s) p.set(k, s);
    }
    const qs = p.toString();
    return qs ? `/rentals?${qs}` : "/rentals";
  };

  const isFiltered = !!(q || location || driver || verifiedOnly || minRating || maxPrice);
  const vehicleView = !typeDef || ["car", "bike", "jeep_4x4"].includes(typeDef.type);

  return (
    <>
      <BreadcrumbJsonLd
        items={
          typeDef
            ? [
                { name: "Home", path: "/" },
                { name: "Rentals", path: "/rentals" },
                { name: typeDef.label, path: `/rentals?type=${typeDef.slug}` },
              ]
            : [
                { name: "Home", path: "/" },
                { name: "Rentals", path: "/rentals" },
              ]
        }
      />
      <Navbar />
      <main className="min-h-screen bg-background">
        {/* ---- Header ---- */}
        <section className="border-b border-border bg-forest-50/50">
          <div className="container-px py-8">
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-gold">
                Home
              </Link>
              <span>/</span>
              {typeDef ? (
                <>
                  <Link href="/rentals" className="hover:text-gold">
                    Rentals
                  </Link>
                  <span>/</span>
                  <span className="font-medium text-forest">{typeDef.label}</span>
                </>
              ) : (
                <span className="font-medium text-forest">Rentals</span>
              )}
            </nav>

            <h1 className="mt-3 font-display text-3xl font-bold text-forest sm:text-4xl">
              {typeDef ? typeDef.label : "Rentals in Gilgit-Baltistan"}
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {typeDef
                ? typeDef.blurb
                : "Cars, jeeps, bikes, cameras, camping gear, houses and workspaces — everything on Rego that you can hire, in one place."}
            </p>

            {/* Search. A GET form, so the result is a shareable URL. */}
            <form action="/rentals" method="get" className="mt-4 flex max-w-xl flex-wrap gap-2">
              {typeDef && <input type="hidden" name="type" value={typeDef.slug} />}
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 shadow-premium">
                <Search className="h-5 w-5 shrink-0 text-forest-600" />
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Search by vehicle, item, provider or area…"
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="rounded-xl bg-gradient-forest px-5 py-2.5 text-sm font-semibold text-white shadow-soft"
              >
                Search
              </button>
            </form>
          </div>
        </section>

        {/* ---- Rental category cards ---- */}
        <section className="container-px pt-8">
          <h2 className="sr-only">Rental categories</h2>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <CategoryTile
              href={href({ type: "", page: undefined })}
              label="All Rentals"
              blurb="Everything for hire"
              Icon={Package}
              count={Object.values(counts).reduce((a, b) => a + b, 0)}
              active={!typeDef}
            />
            {RENTAL_TYPE_DEFS.filter((d) => d.type !== "other").map((d) => (
              <CategoryTile
                key={d.slug}
                href={href({ type: d.slug, page: undefined })}
                label={d.label}
                blurb={d.blurb}
                Icon={ICONS[d.icon] ?? Package}
                count={counts[d.type] ?? 0}
                active={typeDef?.slug === d.slug}
              />
            ))}
          </div>
        </section>

        {/* ---- Filters ---- */}
        <section className="container-px pt-6">
          <div className="flex flex-wrap items-center gap-2">
            {SORTS.map((s) => (
              <Chip key={s.id} href={href({ sort: s.id, page: undefined })} active={sort === s.id}>
                {s.label}
              </Chip>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Driver choice only means something for vehicles. */}
            {vehicleView && (
              <>
                <Chip href={href({ driver: "without", page: undefined })} active={driver === "without"}>
                  Self-drive
                </Chip>
                <Chip href={href({ driver: "with", page: undefined })} active={driver === "with"}>
                  With driver
                </Chip>
              </>
            )}
            <Chip href={href({ verified: verifiedOnly ? "" : "1", page: undefined })} active={verifiedOnly}>
              <Star className="h-3.5 w-3.5" /> Verified provider
            </Chip>
            {/* Rating filter only once something has been rated. */}
            {rentals.some((x) => Number((x as { reviews?: number }).reviews) > 0) && (
              <Chip href={href({ rating: minRating === 4 ? "" : 4, page: undefined })} active={minRating === 4}>
                4★ and up
              </Chip>
            )}

            {isFiltered && (
              <Link
                href={typeDef ? `/rentals?type=${typeDef.slug}` : "/rentals"}
                className="ml-auto text-sm font-semibold text-forest-600 hover:text-gold"
              >
                Clear filters
              </Link>
            )}
          </div>
        </section>

        {/* ---- Results ---- */}
        <section className="container-px py-8">
          {degraded && (
            <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Showing vehicles and workspaces only. Equipment and house rentals
              appear once the <code className="font-mono text-xs">phase136</code>{" "}
              migration has been run on this database.
            </p>
          )}

          <p className="mb-4 text-sm text-muted-foreground">
            {total === 0
              ? "No rentals match."
              : `${total} rental${total === 1 ? "" : "s"}`}
            {typeDef && ` in ${typeDef.label}`}
            {q && <> for &ldquo;{q}&rdquo;</>}
          </p>

          {rentals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/40 py-16 text-center">
              <Package className="mx-auto h-10 w-10 text-forest-600/50" />
              <p className="mt-3 font-semibold text-forest">
                {isFiltered || typeDef ? "Nothing here yet" : "No rentals listed yet"}
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {isFiltered
                  ? "Try clearing a filter, or browse another rental category above."
                  : "Providers list rentals from their own dashboard — as soon as one is approved it appears here."}
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rentals.map((r, i) => (
                <ServiceCard
                  key={`${r.source_table}:${r.source_id}`}
                  listing={rentalToListing(r)}
                  index={i}
                  variant="spec"
                />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-2">
              <PageLink href={href({ page: page - 1 })} disabled={page <= 1}>
                Previous
              </PageLink>
              <span className="px-3 text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <PageLink href={href({ page: page + 1 })} disabled={page >= totalPages}>
                Next
              </PageLink>
            </nav>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

/* ---------- Pieces ---------- */

function CategoryTile({
  href,
  label,
  blurb,
  Icon,
  count,
  active,
}: {
  href: string;
  label: string;
  blurb: string;
  Icon: LucideIcon;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col items-start rounded-2xl border bg-card p-4 text-left shadow-premium transition-all hover:-translate-y-0.5 hover:shadow-premium-lg",
        active ? "border-forest-600 ring-1 ring-forest-600" : "border-border/70 hover:border-forest-200"
      )}
    >
      <span
        className={cn(
          "grid h-11 w-11 place-items-center rounded-2xl transition-colors",
          count > 0 ? "bg-gradient-forest text-gold" : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 font-display text-sm font-bold leading-snug text-forest">{label}</p>
      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{blurb}</p>
      {/* A real count or nothing — never a placeholder figure. */}
      {count > 0 && (
        <span className="mt-3 rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-bold text-forest-700">
          {count} listing{count === 1 ? "" : "s"}
        </span>
      )}
    </Link>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all",
        active
          ? "bg-gradient-forest text-white shadow-soft"
          : "border border-border bg-card text-forest hover:bg-muted"
      )}
    >
      {children}
    </Link>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="cursor-not-allowed rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground opacity-50">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-forest hover:bg-muted"
    >
      {children}
    </Link>
  );
}
