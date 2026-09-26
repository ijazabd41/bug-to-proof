/** Hard-coded product catalog for MiniShop demo */
export const PRODUCTS = [
  { id: 1, name: "Keyboard", price: 10 },
  { id: 2, name: "Mouse Pad", price: 20 },
  { id: 3, name: "USB Hub", price: 15 },
  { id: 4, name: "Webcam", price: 35 },
] as const;

export type Product = (typeof PRODUCTS)[number];
