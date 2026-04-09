// Webshop Engine Types — no styling, pure data

// === PRODUCT ===

export type ProductStatus = 'active' | 'draft' | 'sold_out' | 'archived';

export interface ProductVariantOption {
  name: string;
  values: string[];
}

export interface ProductVariant {
  id: string;
  options: Record<string, string>;
  price: number;
  compareAtPrice?: number;
  stock: number;
  reservedStock: number;
  sku?: string;
  image?: string;
  trackInventory: boolean;
  allowBackorder: boolean;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDescription?: string;
  images: string[];
  categoryId: string;
  tags?: string[];
  variantOptions: ProductVariantOption[];
  variants: ProductVariant[];
  basePrice: number;
  compareAtPrice?: number;
  totalStock: number;
  status: ProductStatus;
  trackInventory: boolean;
  allowBackorder: boolean;
  lowStockThreshold: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  // SEO
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description?: string;
  image?: string;
  parentId?: string;
  active: boolean;
  sortOrder: number;
}

// === CART ===

export interface CartItem {
  productId: string;
  variantId: string;
  quantity: number;
  product: Product;
  variant: ProductVariant;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  tax: number;
  taxRate: number;
  discount: number;
  discountCode?: string;
  total: number;
}

// === DISCOUNT CODES ===

export type DiscountType = 'percentage' | 'fixed';

export interface DiscountCode {
  id: string;
  code: string;
  type: DiscountType;
  value: number; // percentage (0-100) or fixed amount
  minOrderAmount?: number;
  maxUses?: number;
  usedCount: number;
  active: boolean;
  validFrom?: string;
  validUntil?: string;
  createdAt: string;
}

// === REVIEWS ===

export interface Review {
  id: string;
  productId: string;
  author: string;
  email: string;
  rating: number; // 1-5
  title: string;
  body: string;
  verified: boolean;
  approved: boolean;
  createdAt: string;
}

// === WISHLIST ===

export interface WishlistItem {
  productId: string;
  addedAt: string;
}

// === CHECKOUT & ORDER ===

export interface CheckoutData {
  email: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  phone?: string;
  notes?: string;
}

export type OrderStatus = 'new' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  productId: string;
  variantId: string;
  productName: string;
  variantLabel: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  items: OrderItem[];
  checkout: CheckoutData;
  subtotal: number;
  tax: number;
  discount: number;
  discountCode?: string;
  total: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

// === INVENTORY ===

export type StockMutationType = 'sale' | 'return' | 'adjustment' | 'restock' | 'reservation' | 'release';

export interface StockMutation {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  variantLabel: string;
  type: StockMutationType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  reference?: string;
  createdAt: string;
  createdBy: string;
}

// === ANALYTICS ===

export type AnalyticsEventType =
  | 'page_view'
  | 'product_view'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'begin_checkout'
  | 'purchase'
  | 'search'
  | 'wishlist_add'
  | 'wishlist_remove'
  | 'discount_applied';

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  data: Record<string, any>;
  timestamp: string;
  sessionId: string;
}

// === CONFIG ===

export interface WebshopConfig {
  enabled: boolean;
  simpleMode: boolean;
  currency: string;
  currencySymbol: string;
  taxRate: number;
  freeShippingThreshold?: number;
  shippingCost?: number;
  shopName: string;
  shopDescription?: string;
}

// === HELPERS ===

export function getAvailableStock(variant: ProductVariant): number {
  return variant.stock - variant.reservedStock;
}

export function isLowStock(product: Product): boolean {
  return product.totalStock > 0 && product.totalStock <= product.lowStockThreshold;
}

export function isOutOfStock(product: Product): boolean {
  return product.totalStock <= 0 && !product.allowBackorder;
}

export function getProductStatus(product: Product): ProductStatus {
  if (product.status === 'archived' || product.status === 'draft') return product.status;
  if (isOutOfStock(product)) return 'sold_out';
  return 'active';
}

export function getVariantLabel(variant: ProductVariant): string {
  return Object.entries(variant.options).map(([k, v]) => `${k}: ${v}`).join(' · ');
}

export function getAverageRating(reviews: Review[]): number {
  if (reviews.length === 0) return 0;
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
}

export function validateDiscountCode(
  code: DiscountCode,
  subtotal: number
): { valid: boolean; reason?: string } {
  if (!code.active) return { valid: false, reason: 'Deze code is niet meer actief' };
  if (code.maxUses && code.usedCount >= code.maxUses) return { valid: false, reason: 'Deze code is verlopen' };
  if (code.validFrom && new Date(code.validFrom) > new Date()) return { valid: false, reason: 'Deze code is nog niet geldig' };
  if (code.validUntil && new Date(code.validUntil) < new Date()) return { valid: false, reason: 'Deze code is verlopen' };
  if (code.minOrderAmount && subtotal < code.minOrderAmount) return { valid: false, reason: `Minimaal bestelbedrag: €${code.minOrderAmount.toFixed(2)}` };
  return { valid: true };
}

export function calculateDiscount(code: DiscountCode, subtotal: number): number {
  if (code.type === 'percentage') {
    return subtotal * (code.value / 100);
  }
  return Math.min(code.value, subtotal);
}
