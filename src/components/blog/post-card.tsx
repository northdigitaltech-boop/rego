import Link from "next/link";
import { CalendarDays, Clock, UserRound } from "lucide-react";

import {
  CATEGORY_LABEL,
  formatPostDate,
  readingTime,
  type BlogPost,
} from "@/lib/blog";
import { photo, cn } from "@/lib/utils";

/* ============================================================
 * Blog post card.
 *
 * Server component — the list page is the article index and its
 * content belongs in the initial HTML.
 *
 * Every optional field degrades rather than leaving a gap: no
 * image means no image block, no author means no author line.
 * A card with an empty slot looks like something failed to
 * load, which is worse than a shorter card.
 * ============================================================ */

export function PostCard({
  post,
  className,
}: {
  post: BlogPost;
  className?: string;
}) {
  const mins = readingTime(post.content);
  const date = formatPostDate(post.published_at ?? post.created_at);

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-premium transition-shadow hover:shadow-lg",
        className
      )}
    >
      <Link prefetch={false} href={`/blog-news/${post.slug}`} className="block overflow-hidden">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
          {post.featured_image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={photo(post.featured_image_url)}
              alt={post.image_alt || post.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-forest-50 text-forest-600/40">
              <span className="font-display text-3xl font-bold">Rego</span>
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-full bg-forest-800/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur">
            {CATEGORY_LABEL[post.category] ?? post.category}
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="font-display text-lg font-bold leading-snug text-forest">
          <Link prefetch={false} href={`/blog-news/${post.slug}`} className="hover:text-gold">
            {post.title}
          </Link>
        </h3>

        {post.excerpt?.trim() && (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {post.excerpt}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
          {post.author_name && (
            <span className="flex items-center gap-1">
              <UserRound className="h-3.5 w-3.5" />
              {post.author_name}
            </span>
          )}
          {date && (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {date}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {mins} min read
          </span>
        </div>

        <Link
          prefetch={false}
          href={`/blog-news/${post.slug}`}
          className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-lg bg-forest-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-forest-700"
        >
          Read more
          <span aria-hidden>→</span>
        </Link>
      </div>
    </article>
  );
}

/** Wide card for the featured post at the top of the index. */
export function FeaturedPostCard({ post }: { post: BlogPost }) {
  const mins = readingTime(post.content);
  const date = formatPostDate(post.published_at ?? post.created_at);

  return (
    <article className="group grid overflow-hidden rounded-2xl border border-border bg-card shadow-premium lg:grid-cols-2">
      <Link
        prefetch={false}
        href={`/blog-news/${post.slug}`}
        className="relative block aspect-[16/10] overflow-hidden bg-muted lg:aspect-auto lg:h-full"
      >
        {post.featured_image_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={photo(post.featured_image_url)}
            alt={post.image_alt || post.title}
            /* The hero image of the index page — above the fold on every
               screen size, so it must not be lazy-loaded. */
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full min-h-[220px] w-full items-center justify-center bg-forest-50 text-forest-600/40">
            <span className="font-display text-4xl font-bold">Rego</span>
          </div>
        )}
      </Link>

      <div className="flex flex-col justify-center p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-gold/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gold-700">
            Featured
          </span>
          <span className="rounded-full bg-forest-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-forest-600">
            {CATEGORY_LABEL[post.category] ?? post.category}
          </span>
        </div>

        <h2 className="mt-3 font-display text-2xl font-extrabold leading-tight text-forest sm:text-3xl">
          <Link prefetch={false} href={`/blog-news/${post.slug}`} className="hover:text-gold">
            {post.title}
          </Link>
        </h2>

        {post.excerpt?.trim() && (
          <p className="mt-3 max-w-prose leading-relaxed text-muted-foreground">
            {post.excerpt}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {post.author_name && (
            <span className="flex items-center gap-1">
              <UserRound className="h-3.5 w-3.5" /> {post.author_name}
            </span>
          )}
          {date && (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> {date}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {mins} min read
          </span>
        </div>

        <Link
          prefetch={false}
          href={`/blog-news/${post.slug}`}
          className="mt-5 inline-flex w-fit items-center gap-1.5 rounded-lg bg-forest-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-forest-700"
        >
          Read the article
          <span aria-hidden>→</span>
        </Link>
      </div>
    </article>
  );
}
