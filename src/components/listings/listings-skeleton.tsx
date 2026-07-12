export function ListingsSkeleton() {
  return (
    <div className="container-px py-10">
      <div className="h-9 w-60 animate-pulse rounded-lg bg-muted" />
      <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        <div className="hidden h-[420px] animate-pulse rounded-2xl bg-muted lg:block" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              <div className="h-44 animate-pulse bg-muted" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                <div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
