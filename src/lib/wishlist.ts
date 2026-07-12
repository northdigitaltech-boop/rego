import * as React from "react";

import { type Listing } from "@/lib/data";

const KEY = "safarigb_wishlist";
const EVENT = "safarigb:wishlist";

function read(): Listing[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function write(items: Listing[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore */
  }
}

export function getWishlist(): Listing[] {
  return read();
}

export function isWished(id: string): boolean {
  return read().some((x) => x.id === id);
}

/** Add or remove an item. Returns the new wished state. */
export function toggleWish(item: Listing): boolean {
  const items = read();
  if (items.some((x) => x.id === item.id)) {
    write(items.filter((x) => x.id !== item.id));
    return false;
  }
  write([{ ...item }, ...items]);
  return true;
}

export function removeWish(id: string) {
  write(read().filter((x) => x.id !== id));
}

/** Reactive wishlist hook — re-renders when the wishlist changes anywhere. */
export function useWishlist() {
  const [items, setItems] = React.useState<Listing[]>([]);

  React.useEffect(() => {
    const sync = () => setItems(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return {
    items,
    count: items.length,
    isWished: (id: string) => items.some((x) => x.id === id),
    toggle: (item: Listing) => toggleWish(item),
    remove: (id: string) => removeWish(id),
  };
}
