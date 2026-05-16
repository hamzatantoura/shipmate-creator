import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export interface WishItem {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  slug: string | null;
}

interface WishCtx {
  items: WishItem[];
  count: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  has: (id: string) => boolean;
  toggle: (item: WishItem) => boolean; // returns new state (true = added)
  remove: (id: string) => void;
  clear: () => void;
}

const Ctx = createContext<WishCtx | null>(null);
const STORAGE_KEY = "sila_wishlist_v2";

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WishItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as WishItem[]) : [];
    } catch { return []; }
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* ignore */ }
  }, [items]);

  const api = useMemo<WishCtx>(() => ({
    items,
    count: items.length,
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    has: (id) => items.some(i => i.id === id),
    toggle: (item) => {
      const exists = items.some(i => i.id === item.id);
      setItems(prev => exists ? prev.filter(p => p.id !== item.id) : [...prev, item]);
      return !exists;
    },
    remove: (id) => setItems(prev => prev.filter(p => p.id !== id)),
    clear: () => setItems([]),
  }), [items, isOpen]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useWishlist() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWishlist must be used within WishlistProvider");
  return c;
}