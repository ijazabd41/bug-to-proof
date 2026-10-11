import { create } from "zustand";
import type { Product, CartItem } from "../types";

interface CartStore {
  items: CartItem[];
  promoCode: string | null;
  discountPercent: number;
  addItem: (product: Product) => void;
  removeItem: (productId: number) => void;
  clearCart: () => void;
  applyPromoCode: (code: string) => Promise<boolean>;
  clearPromoCode: () => void;
  shipping: () => number;
  /** Returns the sum of price × quantity for every cart item */
  total: () => number;
}

export { type Product, type CartItem };

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  promoCode: null,
  discountPercent: 0,

  addItem: (product) =>
    set((state) => {
      const existing = state.items.find((i) => i.id === product.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return { items: [...state.items, { ...product, quantity: 1 }] };
    }),

  removeItem: (productId) =>
    set((state) => ({
      items: state.items.filter((i) => i.id !== productId),
    })),

  clearCart: () => set({ items: [] }),

  applyPromoCode: async (code: string) => {
    // Simulate async promo validation
    await new Promise((resolve) => setTimeout(resolve, 400));
    const normalized = code.trim().toUpperCase();
    if (normalized === "SAVE20") {
      set((state) => ({
        promoCode: "SAVE20",
        discountPercent: 20,
        items: state.items.map((i) => ({ ...i, price: Number((i.price * 0.8).toFixed(2)) })),
      }));
      return true;
    }
    return false;
  },

  clearPromoCode: () => set({ promoCode: null, discountPercent: 0 }),

  shipping: () => (get().total() >= 50 || get().items.length === 0 ? 0 : 5),

  total: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
}));
