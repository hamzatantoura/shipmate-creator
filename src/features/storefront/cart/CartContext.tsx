import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  slug: string | null;
  quantity: number;
}

interface CartCtx {
  items: CartItem[];
  count: number;
  total: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
}

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ merchantId, children }: { merchantId: string; children: ReactNode }) {
  const storageKey = `sila_cart_${merchantId}`;
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch { return []; }
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(items)); } catch { /* ignore */ }
  }, [items, storageKey]);

  const api = useMemo<CartCtx>(() => ({
    items,
    count: items.reduce((s, i) => s + i.quantity, 0),
    total: items.reduce((s, i) => s + i.quantity * Number(i.price), 0),
    isOpen,
    openCart: () => setIsOpen(true),
    closeCart: () => setIsOpen(false),
    add: (item, qty = 1) => {
      setItems(prev => {
        const existing = prev.find(p => p.id === item.id);
        if (existing) return prev.map(p => p.id === item.id ? { ...p, quantity: p.quantity + qty } : p);
        return [...prev, { ...item, quantity: qty }];
      });
    },
    remove: (id) => setItems(prev => prev.filter(p => p.id !== id)),
    setQty: (id, qty) => setItems(prev => qty <= 0 ? prev.filter(p => p.id !== id) : prev.map(p => p.id === id ? { ...p, quantity: qty } : p)),
    clear: () => setItems([]),
  }), [items, isOpen]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used within CartProvider");
  return c;
}