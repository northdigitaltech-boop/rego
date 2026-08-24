import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Clock,
  UserRound,
} from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { StoryMarkdown } from "@/components/safarnama/story-markdown";
import { PostCard } from "@/components/blog/post-card";
import { ShareButtons } from "@/components/blog/share-buttons";
import { BreadcrumbJsonLd, ArticleJsonLd } from "@/components/seo/json-ld";
import { buildMetadata } from "@/lib/seo";
import {
  CATEGORY_LABEL,
  formatPostDate,
  getPostBySlug,
  getRelatedPosts,
  readingTime,
} from "@/lib/blog";
import { absoluteUrl } from "@/lib/site";
import { photo } from "@/lib/utils";

/* ============================================================
 * Article page.
 *
 * The body is MARKDOWN rendered by StoryMarkdown — the same
 * renderer traveller stories use. It builds React elements and
 * never parses HTML, so an article cannot introduce a script
 * tag, an iframe or an event handler no matter what is stored.
 *
 * Everything a reader or a crawler needs is server-rendered.
 * The only client component on the page is the share buttons,
 * which genuinely need the browser.
 * ============================================================ */

export const revalidate = 300;

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return { title: "Article not found", robots: { index: false, follow: false } };
  }

  const description =
    post.meta_description?.trim() ||
    post.excerpt?.trim() ||
    `${post.title} — from the Rego Blog & News.`;

  return buildMetadata({
    title: post.seo_title?.trim() || post.title,
    description,
    path: post.canonical_url?.trim() || `/blog-news/${post.slug}`,
    image: post.og_image_url || post.featured_image_url,
    imageAlt: post.image_alt || post.title,
    type: "article",
    publishedTime: post.published_at ?? undefined,
    modifiedTime: post.updated_at,
  });
}

export default async function ArticlePage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  /* RLS already hides drafts and future-scheduled posts, so "not visible" and
     "does not exist" arrive here identically — and both should be a real 404
     rather than an empty page returning 200. */
  if (!post) notFound();

  const related = await getRelatedPosts(post, 3);
  const mins = readingTime(post.content);
  const date = formatPostDate(post.published_at ?? post.created_at);
  const url = absoluteUrl(`/blog-news/${post.slug}`);
  const categoryLabel = CATEGORY_LABEL[post.category] ?? post.category;

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Blog & News", path: "/blog-news" },
          { name: post.title, path: `/blog-news/${post.slug}` },
        ]}
      />
      <ArticleJsonLd
        headline={post.title}
        description={post.meta_description || post.excerpt}
        image={post.og_image_url || post.featured_image_url}
        path={`/blog-news/${post.slug}`}
        publishedAt={post.published_at}
        modifiedAt={post.updated_at}
        authorName={post.author_name}
        section={categoryLabel}
        tags={post.tags}
      />

      <Navbar />
      <main className="min-h-screen">
        <article>
          {/* ---- Header ---- */}
          <header className="border-b border-border bg-muted/40">
            <div className="container-px py-8 sm:py-12">
              {/* One content column for the whole article. The header used to
                  be left-aligned while the image and body were centred, which
                  looked fine on mobile (everything is full width) and clearly
                  broken on a desktop screen. */}
              <nav
                aria-label="Breadcrumb"
                className="mx-auto flex max-w-3xl flex-wrap items-center gap-1 text-sm text-muted-foreground"
              >
                <Link href="/" className="hover:text-forest">Home</Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <Link href="/blog-news" className="hover:text-forest">Blog &amp; News</Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="text-forest">{categoryLabel}</span>
              </nav>

              <div className="mx-auto mt-4 max-w-3xl">
                <Link
                  href={`/blog-news?category=${post.category}`}
                  className="inline-block rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest-600 hover:bg-forest-100"
                >
                  {categoryLabel}
                </Link>

                {/* The only h1 on the page. */}
                <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight text-forest sm:text-4xl">
                  {post.title}
                </h1>

                {post.excerpt?.trim() && (
                  <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
                    {post.excerpt}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {post.author_name && (
                    <span className="flex items-center gap-1.5">
                      <UserRound className="h-4 w-4" /> {post.author_name}
                    </span>
                  )}
                  {date && (
                    <time
                      dateTime={post.published_at ?? post.created_at}
                      className="flex items-center gap-1.5"
                    >
                      <CalendarDays className="h-4 w-4" /> {date}
                    </time>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" /> {mins} min read
                  </span>
                </div>
              </div>
            </div>
          </header>

          {/* ---- Featured image ---- */}
          {post.featured_image_url && (
            <div className="container-px pt-8">
              <figure className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo(post.featured_image_url)}
                  /* Falls back to the title rather than an empty alt — this is
                     content, not decoration. */
                  alt={post.image_alt || post.title}
                  className="h-auto w-full object-cover"
                />
                {post.image_alt && (
                  <figcaption className="bg-muted/50 px-4 py-2 text-center text-xs text-muted-foreground">
                    {post.image_alt}
                  </figcaption>
                )}
              </figure>
            </div>
          )}

          {/* ---- Body ---- */}
          <div className="container-px py-10">
            <div className="mx-auto max-w-3xl">
              <StoryMarkdown
                text={post.content}
                paragraphClassName="text-base leading-relaxed text-foreground"
              />

              {post.tags.length > 0 && (
                <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-border pt-5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Tags
                  </span>
                  {post.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
                <ShareButtons url={url} title={post.title} />
                <Link
                  href="/blog-news"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-forest transition-colors hover:border-forest-600 hover:bg-forest-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Blog &amp; News
                </Link>
              </div>
            </div>
          </div>
        </article>

        {/* ---- Related ---- */}
        {related.length > 0 && (
          <section className="border-t border-border bg-muted/30">
            <div className="container-px py-12">
              <h2 className="font-display text-2xl font-bold text-forest">
                More from Rego
              </h2>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
