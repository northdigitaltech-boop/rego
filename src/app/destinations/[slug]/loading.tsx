import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ListingsSkeleton } from "@/components/listings/listings-skeleton";

export default function Loading() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <div className="h-64 animate-pulse bg-muted" />
        <ListingsSkeleton />
      </main>
      <Footer />
    </>
  );
}
