import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ListingsSkeleton } from "@/components/listings/listings-skeleton";

export default function Loading() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <ListingsSkeleton />
      </main>
      <Footer />
    </>
  );
}
