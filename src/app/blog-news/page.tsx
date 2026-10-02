import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Newspaper, Search } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { PostCard, FeaturedPostCard } from "@/components/blog/post-card";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { buildMetadata } from "@/lib/seo";
import {
  BLOG_CATEGORIES,
  getFeaturedPost,
  getPublishedPosts,
} from "@/lib/blog";
import { cn } from "@/lib/utils";

/* ============================================================
 * Blog & News index.
 *
 * ---------------------------------------------------------------------------
 * SEARCH AND FILTERS LIVE IN THE URL, AND THE PAGE IS A SERVER COMPONENT.
 *
 * The obvious build is a client component holding the posts in state and
 * filtering them in the browser. That would mean the articles arrive as
 * JavaScript, not HTML — invisible to a crawler, and a blank page until the
 * bundle loads.
 *
 * So filtering is done in the query, the state is the URL, and every card is
 * in the initial HTML. The cost is a page load per filter click, which on a
 * server-rendered page is fast and gives every filtered view a shareable URL.
 *
 * Those filtered URLs are noindex — see generateMetadata. The clean page is
 * the one that gets indexed; the filters exist for readers.
 * ---------------------------------------------------------------------------
 */

export const revalidate = 300;

const PER_PAGE = 9;

type SP = Promise<{ [k: string]: string | string[] | undefined }>;

const first = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SP;
}): Promise<Metadata> {
  const sp = await searchParams;
  const filtered = Boolean(first(sp.q) || first(sp.category));
  const page = Math.max(1, Math.floor(Number(first(sp.page)) || 1));

  /* PAGINATION IS NOT A FILTER.
     Page 2 used to be noindex with its canonical pointing at page 1. Google
     treats a canonical from page 2 to page 1 as an error (the pages list
     different articles), and a long-term noindex ends up unfollowed — so
     older articles lost their only crawl path from the blog. Each page now
     canonicalises to itself and is indexable; search and category views,
     which really are re-sorts of the same posts, stay noindex. */
  const pagePath = !filtered && page > 1 ? `/blog-news?page=${page}` : "/blog-news";

  return buildMetadata({
    title:
      page > 1 && !filtered
        ? `Gilgit-Baltistan Travel Blog & News — Page ${page}`
        : "Gilgit-Baltistan Travel Blog & News",
    description:
      "Travel guides, destination features, tourism news and safety updates from across Gilgit-Baltistan — written and checked by the Rego team.",
    path: pagePath,
    noindex: filtered,
  });
}

export default async function BlogNewsPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const sp = await searchParams;
  const q = first(sp.q).trim();
  const category = first(sp.category) || "all";
  const page = Math.max(1, Math.floor(Number(first(sp.page)) || 1));

  const [{ posts, total }, featured] = await Promise.all([
    getPublishedPosts({
      category,
      search: q,
      limit: PER_PAGE,
      offset: (page - 1) * PER_PAGE,
    }),
    // Only on the unfiltered first page — otherwise it repeats a card below.
    !q && category === "all" && page === 1 ? getFeaturedPost() : Promise.resolve(null),
  ]);

  const listPosts = featured ? posts.filter((p) => p.id !== featured.id) : posts;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  /* Now that page 2+ is indexable, a page past the end must not be: it would
     be an empty, 200-status page with its own canonical. A real 404 instead. */
  if (page > totalPages) notFound();
  const isFiltered = Boolean(q || category !== "all");

  /** Preserve the other params when building a link. */
  const href = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q, category: category === "all" ? "" : category, page, ...patch };
    for (const [k, v] of Object.entries(merged)) {
      if (v && String(v) !== "" && !(k === "page" && Number(v) === 1)) {
        params.set(k, String(v));
      }
    }
    const s = params.toString();
    return s ? `/blog-news?${s}` : "/blog-news";
  };

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Blog & News", path: "/blog-news" },
        ]}
      />
      <Navbar />
      <main className="min-h-screen">
        {/* ---- Header ---- */}
        <section className="border-b border-border bg-muted/40">
          <div className="container-px py-12 sm:py-16">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest-600">
                <Newspaper className="h-3.5 w-3.5" />
                Blog &amp; News
              </span>
              <h1 className="mt-3 font-display text-3xl font-extrabold text-forest sm:text-4xl">
                Stories, guides and news from Gilgit-Baltistan
              </h1>
              <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
                Travel guides, destination features, tourism news and safety
                updates — written and checked by the Rego team.
              </p>
            </div>

            {/* Plain GET form: works with JavaScript disabled, and the result
                is a real URL the reader can share or bookmark. */}
            <form action="/blog-news" method="get" className="mt-6 max-w-md">
              {category !== "all" && (
                <input type="hidden" name="category" value={category} />
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  name="q"
                  defaultValue={q}
                  placeholder="Search articles…"
                  aria-label="Search articles"
                  className="w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-3 text-sm"
                />
              </div>
            </form>

            {/* ---- Category filters ---- */}
            <nav aria-label="Categories" className="mt-5 flex flex-wrap gap-2">
              <Link
                href={href({ category: "", page: 1 })}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
                  category === "all"
                    ? "border-forest-600 bg-forest-600 text-white"
                    : "border-border bg-card text-forest hover:border-forest-600"
                )}
              >
                All
              </Link>
              {BLOG_CATEGORIES.map((c) => (
                <Link
                  key={c.slug}
                  href={href({ category: c.slug, page: 1 })}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
                    category === c.slug
                      ? "border-forest-600 bg-forest-600 text-white"
                      : "border-border bg-card text-forest hover:border-forest-600"
                  )}
                >
                  {c.label}
                </Link>
              ))}
            </nav>
          </div>
        </section>

        {/* ---- Featured ---- */}
        {featured && (
          <section className="container-px pt-10">
            <FeaturedPostCard post={featured} />
          </section>
        )}

        {/* ---- List ---- */}
        <section className="container-px py-10">
          {isFiltered && (
            <p className="mb-5 text-sm text-muted-foreground">
              {total === 0
                ? "No articles match."
                : `${total} article${total === 1 ? "" : "s"}`}
              {q && <> for “{q}”</>}
              {" · "}
              <Link href="/blog-news" className="font-semibold text-forest hover:text-gold">
                Clear
              </Link>
            </p>
          )}

          {listPosts.length === 0 ? (
            /* Deliberately not an error state — an empty blog is a normal
               starting condition, not a fault. */
            <div className="rounded-2xl border border-dashed border-border bg-muted/40 py-16 text-center">
              <Newspaper className="mx-auto h-10 w-10 text-forest-600/50" />
              <p className="mt-3 font-semibold text-forest">
                {isFiltered ? "Nothing here yet" : "No articles published yet"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isFiltered
                  ? "Try another category or clear the search."
                  : "Check back soon — we're writing."}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {listPosts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          )}

          {/* ---- Pagination ----
              Real anchors, so the pages are crawlable and each one is a URL
              a reader can return to. */}
          {totalPages > 1 && (
            <nav
              aria-label="Pagination"
              className="mt-10 flex items-center justify-center gap-2"
            >
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
      <span className="cursor-not-allowed rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground/50">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-forest transition-colors hover:border-forest-600 hover:bg-forest-50"
    >
      {children}
    </Link>
  );
}
