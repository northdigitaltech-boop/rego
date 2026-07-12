import type { Metadata } from "next";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { AboutRego } from "@/components/about/about-rego";
import { getAboutContent } from "@/lib/about";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 60;

export const metadata: Metadata = buildMetadata({
  title: "About Rego — Digitally Connecting Gilgit-Baltistan",
  description:
    "Rego is a complete digital tourism marketplace for Gilgit-Baltistan, founded and developed by Shabbir Hussain. Discover our mission, vision and the future Rego digital ecosystem.",
  path: "/about",
});

export default async function AboutPage() {
  const about = await getAboutContent();
  return (
    <>
      <Navbar />
      <main>
        <AboutRego content={about} />
      </main>
      <Footer />
    </>
  );
}
