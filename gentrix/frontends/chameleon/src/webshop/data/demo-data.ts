import type { Product, Category } from '../types';

export const DEMO_CATEGORIES: Category[] = [
  { id: 'cat-1', slug: 'clothing', name: 'Kleding', description: 'Shirts, broeken en meer', active: true, sortOrder: 1 },
  { id: 'cat-2', slug: 'accessories', name: 'Accessoires', description: 'Tassen, riemen en meer', active: true, sortOrder: 2 },
  { id: 'cat-3', slug: 'shoes', name: 'Schoenen', description: 'Sneakers, boots en meer', active: true, sortOrder: 3 },
];

export const DEMO_PRODUCTS: Product[] = [
  {
    id: 'prod-1', slug: 'basic-tshirt', name: 'Basic T-Shirt', categoryId: 'cat-1',
    description: 'Een veelzijdig basis T-shirt van hoogwaardig biologisch katoen. Perfect voor elke gelegenheid.',
    shortDescription: 'Biologisch katoenen T-shirt',
    images: ['https://placehold.co/600x600/e2e8f0/334155?text=T-Shirt'],
    variantOptions: [{ name: 'Maat', values: ['S', 'M', 'L', 'XL'] }, { name: 'Kleur', values: ['Zwart', 'Wit', 'Grijs'] }],
    variants: [
      { id: 'v1-1', options: { Maat: 'S', Kleur: 'Zwart' }, price: 29.95, stock: 15, reservedStock: 0, sku: 'TS-BLK-S', trackInventory: true, allowBackorder: false },
      { id: 'v1-2', options: { Maat: 'M', Kleur: 'Zwart' }, price: 29.95, stock: 20, reservedStock: 2, sku: 'TS-BLK-M', trackInventory: true, allowBackorder: false },
      { id: 'v1-3', options: { Maat: 'L', Kleur: 'Zwart' }, price: 29.95, stock: 10, reservedStock: 0, sku: 'TS-BLK-L', trackInventory: true, allowBackorder: false },
      { id: 'v1-4', options: { Maat: 'M', Kleur: 'Wit' }, price: 29.95, stock: 18, reservedStock: 1, sku: 'TS-WHT-M', trackInventory: true, allowBackorder: false },
      { id: 'v1-5', options: { Maat: 'L', Kleur: 'Grijs' }, price: 29.95, stock: 12, reservedStock: 0, sku: 'TS-GRY-L', trackInventory: true, allowBackorder: false },
    ],
    basePrice: 29.95, totalStock: 75, status: 'active', active: true, createdAt: '2024-01-01', updatedAt: '2024-01-01',
    trackInventory: true, allowBackorder: false, lowStockThreshold: 5,
  },
  {
    id: 'prod-2', slug: 'canvas-sneakers', name: 'Canvas Sneakers', categoryId: 'cat-3',
    description: 'Lichtgewicht canvas sneakers met een klassiek ontwerp. Comfortabel voor dagelijks gebruik.',
    shortDescription: 'Klassieke canvas sneakers',
    images: ['https://placehold.co/600x600/e2e8f0/334155?text=Sneakers'],
    variantOptions: [{ name: 'Maat', values: ['38', '40', '42', '44'] }],
    variants: [
      { id: 'v2-1', options: { Maat: '38' }, price: 59.95, stock: 8, reservedStock: 0, sku: 'SN-38', trackInventory: true, allowBackorder: false },
      { id: 'v2-2', options: { Maat: '40' }, price: 59.95, stock: 12, reservedStock: 0, sku: 'SN-40', trackInventory: true, allowBackorder: false },
      { id: 'v2-3', options: { Maat: '42' }, price: 59.95, stock: 3, reservedStock: 1, sku: 'SN-42', trackInventory: true, allowBackorder: false },
      { id: 'v2-4', options: { Maat: '44' }, price: 59.95, stock: 6, reservedStock: 0, sku: 'SN-44', trackInventory: true, allowBackorder: false },
    ],
    basePrice: 59.95, totalStock: 29, status: 'active', active: true, createdAt: '2024-01-15', updatedAt: '2024-01-15',
    trackInventory: true, allowBackorder: false, lowStockThreshold: 5,
  },
  {
    id: 'prod-3', slug: 'leather-belt', name: 'Leren Riem', categoryId: 'cat-2',
    description: 'Handgemaakte leren riem van premium Italiaans leer. Tijdloos design.',
    shortDescription: 'Premium Italiaanse leren riem',
    images: ['https://placehold.co/600x600/e2e8f0/334155?text=Riem'],
    variantOptions: [{ name: 'Maat', values: ['S', 'M', 'L'] }, { name: 'Kleur', values: ['Bruin', 'Zwart'] }],
    variants: [
      { id: 'v3-1', options: { Maat: 'S', Kleur: 'Bruin' }, price: 44.95, stock: 10, reservedStock: 0, sku: 'BLT-BRN-S', trackInventory: true, allowBackorder: false },
      { id: 'v3-2', options: { Maat: 'M', Kleur: 'Bruin' }, price: 44.95, stock: 14, reservedStock: 0, sku: 'BLT-BRN-M', trackInventory: true, allowBackorder: false },
      { id: 'v3-3', options: { Maat: 'L', Kleur: 'Zwart' }, price: 44.95, stock: 2, reservedStock: 0, sku: 'BLT-BLK-L', trackInventory: true, allowBackorder: true },
    ],
    basePrice: 44.95, totalStock: 26, status: 'active', active: true, createdAt: '2024-02-01', updatedAt: '2024-02-01',
    trackInventory: true, allowBackorder: false, lowStockThreshold: 3,
  },
  {
    id: 'prod-4', slug: 'denim-jacket', name: 'Denim Jacket', categoryId: 'cat-1',
    description: 'Klassiek denim jasje met een moderne pasvorm. Ideaal voor de tussenseizoenen.',
    shortDescription: 'Klassiek denim jasje',
    images: ['https://placehold.co/600x600/e2e8f0/334155?text=Denim'],
    variantOptions: [{ name: 'Maat', values: ['S', 'M', 'L', 'XL'] }],
    variants: [
      { id: 'v4-1', options: { Maat: 'S' }, price: 89.95, compareAtPrice: 119.95, stock: 5, reservedStock: 0, sku: 'DJ-S', trackInventory: true, allowBackorder: false },
      { id: 'v4-2', options: { Maat: 'M' }, price: 89.95, compareAtPrice: 119.95, stock: 8, reservedStock: 3, sku: 'DJ-M', trackInventory: true, allowBackorder: false },
      { id: 'v4-3', options: { Maat: 'L' }, price: 89.95, compareAtPrice: 119.95, stock: 6, reservedStock: 0, sku: 'DJ-L', trackInventory: true, allowBackorder: false },
      { id: 'v4-4', options: { Maat: 'XL' }, price: 89.95, compareAtPrice: 119.95, stock: 1, reservedStock: 0, sku: 'DJ-XL', trackInventory: true, allowBackorder: false },
    ],
    basePrice: 89.95, compareAtPrice: 119.95, totalStock: 20, status: 'active', active: true, createdAt: '2024-02-15', updatedAt: '2024-02-15',
    trackInventory: true, allowBackorder: false, lowStockThreshold: 5,
  },
  {
    id: 'prod-5', slug: 'canvas-backpack', name: 'Canvas Rugzak', categoryId: 'cat-2',
    description: 'Duurzame canvas rugzak met leren details. Ruim genoeg voor een laptop van 15 inch.',
    shortDescription: 'Duurzame canvas rugzak',
    images: ['https://placehold.co/600x600/e2e8f0/334155?text=Rugzak'],
    variantOptions: [{ name: 'Kleur', values: ['Groen', 'Grijs', 'Navy'] }],
    variants: [
      { id: 'v5-1', options: { Kleur: 'Groen' }, price: 74.95, stock: 11, reservedStock: 0, sku: 'BP-GRN', trackInventory: true, allowBackorder: false },
      { id: 'v5-2', options: { Kleur: 'Grijs' }, price: 74.95, stock: 9, reservedStock: 0, sku: 'BP-GRY', trackInventory: true, allowBackorder: false },
      { id: 'v5-3', options: { Kleur: 'Navy' }, price: 74.95, stock: 0, reservedStock: 0, sku: 'BP-NVY', trackInventory: true, allowBackorder: false },
    ],
    basePrice: 74.95, totalStock: 20, status: 'active', active: true, createdAt: '2024-03-01', updatedAt: '2024-03-01',
    trackInventory: true, allowBackorder: false, lowStockThreshold: 3,
  },
  {
    id: 'prod-6', slug: 'wool-beanie', name: 'Wollen Muts', categoryId: 'cat-2',
    description: 'Zachte wollen muts, perfect voor koude dagen. Unisex model.',
    shortDescription: 'Zachte wollen unisex muts',
    images: ['https://placehold.co/600x600/e2e8f0/334155?text=Muts'],
    variantOptions: [{ name: 'Kleur', values: ['Zwart', 'Grijs', 'Bordeaux'] }],
    variants: [
      { id: 'v6-1', options: { Kleur: 'Zwart' }, price: 19.95, stock: 25, reservedStock: 0, sku: 'BN-BLK', trackInventory: true, allowBackorder: false },
      { id: 'v6-2', options: { Kleur: 'Grijs' }, price: 19.95, stock: 20, reservedStock: 0, sku: 'BN-GRY', trackInventory: true, allowBackorder: false },
      { id: 'v6-3', options: { Kleur: 'Bordeaux' }, price: 19.95, stock: 0, reservedStock: 0, sku: 'BN-BRD', trackInventory: true, allowBackorder: false },
    ],
    basePrice: 19.95, totalStock: 45, status: 'active', active: true, createdAt: '2024-03-15', updatedAt: '2024-03-15',
    trackInventory: true, allowBackorder: false, lowStockThreshold: 5,
  },
];
