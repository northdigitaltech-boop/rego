import { type CategorySlug } from "@/lib/data";

export interface PartnerListing {
  id: string;
  ownerEmail: string;
  title: string;
  category: CategorySlug;
  location: string;
  price: number;
  unit: string;
  description: string;
  image: string;
  phone?: string;
  createdAt: number;
}

const KEY = "safarigb_partner_listings";

function readAll(): PartnerListing[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function writeAll(items: PartnerListing[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function listFor(email: string): PartnerListing[] {
  return readAll()
    .filter((l) => l.ownerEmail === email)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function listAll(): PartnerListing[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt);
}

export function addListing(item: Omit<PartnerListing, "id" | "createdAt">) {
  const all = readAll();
  const listing: PartnerListing = {
    ...item,
    id: `p_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    createdAt: Date.now(),
  };
  all.push(listing);
  writeAll(all);
  return listing;
}

export function removeListing(email: string, id: string) {
  const all = readAll().filter(
    (l) => !(l.id === id && l.ownerEmail === email)
  );
  writeAll(all);
}
