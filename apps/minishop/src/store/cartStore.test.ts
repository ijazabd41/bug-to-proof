import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore } from './cartStore';

describe('cartStore', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
  });

  it('includes repeated item quantities and removal', () => {
    const cart = useCartStore.getState();
    const keyboard = { id: 1, name: 'Keyboard', price: 10 };
    cart.addItem(keyboard); cart.addItem(keyboard);
    cart.addItem({ id: 2, name: 'Mouse Pad', price: 20 });
    expect(cart.total()).toBe(40);
    cart.removeItem(1); expect(cart.total()).toBe(20);
    cart.clearCart(); expect(cart.total()).toBe(0);
  });

  it('should add items to the cart', () => {
    useCartStore.getState().addItem({ id: 1, name: 'Keyboard', price: 10 });
    expect(useCartStore.getState().items.length).toBe(1);
    expect(useCartStore.getState().items[0].name).toBe('Keyboard');
  });

  it('should sum all item prices', () => {
    useCartStore.getState().addItem({ id: 1, name: 'Keyboard', price: 10 });
    useCartStore.getState().addItem({ id: 2, name: 'Mouse Pad', price: 20 });
    
    // The bug states: "total shows only the first item's price instead of the sum of both."
    // So the total should be 30, but it will probably evaluate to 10 in the UI.
    // Let's see what total() actually returns.
    const total = useCartStore.getState().total();
    expect(total).toBe(30);
  });
});

