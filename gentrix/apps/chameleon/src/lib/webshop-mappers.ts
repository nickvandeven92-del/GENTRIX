import type { Json } from '@/types/database';
import type {
  Category,
  DiscountCode,
  Order,
  OrderItem,
  Product,
  ProductVariant,
  ProductVariantOption,
  Review,
  StockMutation,
  WebshopConfig,
} from '@/webshop/types';
import type { Database } from '@/types/database';

type ClientRow = Database['public']['Tables']['clients']['Row'];
type ProductRow = Database['public']['Tables']['products']['Row'] & {
  product_variants: Database['public']['Tables']['product_variants']['Row'][];
  product_variant_options: Database['public']['Tables']['product_variant_options']['Row'][];
};
type CategoryRow = Database['public']['Tables']['categories']['Row'];
type DiscountRow = Database['public']['Tables']['discount_codes']['Row'];
type ReviewRow = Database['public']['Tables']['reviews']['Row'];
type MutationRow = Database['public']['Tables']['stock_mutations']['Row'];
type OrderRow = Database['public']['Tables']['orders']['Row'] & {
  order_items: Database['public']['Tables']['order_items']['Row'][];
};

function optionsFromJson(j: Json): Record<string, string> {
  if (!j || typeof j !== 'object' || Array.isArray(j)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

export function mapVariantRow(r: Database['public']['Tables']['product_variants']['Row']): ProductVariant {
  return {
    id: r.id,
    options: optionsFromJson(r.options),
    price: Number(r.price),
    compareAtPrice: r.compare_at_price != null ? Number(r.compare_at_price) : undefined,
    stock: r.stock,
    reservedStock: r.reserved_stock,
    sku: r.sku ?? undefined,
    image: r.image ?? undefined,
    trackInventory: r.track_inventory,
    allowBackorder: r.allow_backorder,
  };
}

export function mapProductRow(row: ProductRow): Product {
  const opts = [...(row.product_variant_options ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const variantOptions: ProductVariantOption[] = opts.map(o => ({
    name: o.name,
    values: o.values ?? [],
  }));
  const variants = [...(row.product_variants ?? [])].map(mapVariantRow);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? '',
    shortDescription: row.short_description ?? undefined,
    images: row.images?.length ? row.images : [],
    categoryId: row.category_id ?? '',
    tags: row.tags ?? undefined,
    variantOptions,
    variants,
    basePrice: Number(row.base_price),
    compareAtPrice: row.compare_at_price != null ? Number(row.compare_at_price) : undefined,
    totalStock: row.total_stock,
    status: row.status,
    trackInventory: row.track_inventory,
    allowBackorder: row.allow_backorder,
    lowStockThreshold: row.low_stock_threshold,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metaTitle: row.meta_title ?? undefined,
    metaDescription: row.meta_description ?? undefined,
    ogImage: row.og_image ?? undefined,
  };
}

export function mapCategoryRow(r: CategoryRow): Category {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description ?? undefined,
    image: r.image ?? undefined,
    parentId: r.parent_id ?? undefined,
    active: r.active,
    sortOrder: r.sort_order,
  };
}

export function clientRowToConfig(r: ClientRow): WebshopConfig {
  return {
    enabled: r.webshop_enabled,
    simpleMode: r.simple_mode,
    currency: r.currency,
    currencySymbol: r.currency_symbol,
    taxRate: Number(r.tax_rate),
    freeShippingThreshold: Number(r.free_shipping_threshold),
    shippingCost: Number(r.shipping_cost),
    shopName: r.shop_name,
    shopDescription: r.shop_description ?? undefined,
  };
}

export function mapDiscountRow(r: DiscountRow): DiscountCode {
  return {
    id: r.id,
    code: r.code,
    type: r.type,
    value: Number(r.value),
    minOrderAmount: r.min_order_amount != null ? Number(r.min_order_amount) : undefined,
    maxUses: r.max_uses ?? undefined,
    usedCount: r.used_count,
    active: r.active,
    validFrom: r.valid_from ?? undefined,
    validUntil: r.valid_until ?? undefined,
    createdAt: r.created_at,
  };
}

export function mapReviewRow(r: ReviewRow): Review {
  return {
    id: r.id,
    productId: r.product_id,
    author: r.author,
    email: r.email,
    rating: r.rating,
    title: r.title,
    body: r.body,
    verified: r.verified,
    approved: r.approved,
    createdAt: r.created_at,
  };
}

export function mapMutationRow(r: MutationRow): StockMutation {
  return {
    id: r.id,
    productId: r.product_id,
    variantId: r.variant_id,
    productName: r.product_name,
    variantLabel: r.variant_label,
    type: r.type,
    quantity: r.quantity,
    previousStock: r.previous_stock,
    newStock: r.new_stock,
    reason: r.reason,
    reference: r.reference ?? undefined,
    createdAt: r.created_at,
    createdBy: r.created_by,
  };
}

export function mapOrderRow(r: OrderRow): Order {
  const items: OrderItem[] = (r.order_items ?? []).map(oi => ({
    productId: oi.product_id ?? '',
    variantId: oi.variant_id ?? '',
    productName: oi.product_name,
    variantLabel: oi.variant_label,
    sku: oi.sku ?? undefined,
    quantity: oi.quantity,
    unitPrice: Number(oi.unit_price),
    totalPrice: Number(oi.total_price),
  }));
  return {
    id: r.id,
    orderNumber: r.order_number,
    items,
    checkout: {
      email: r.email,
      firstName: r.first_name,
      lastName: r.last_name,
      address: r.address,
      city: r.city,
      postalCode: r.postal_code,
      country: r.country,
      phone: r.phone ?? undefined,
      notes: r.notes ?? undefined,
    },
    subtotal: Number(r.subtotal),
    tax: Number(r.tax),
    discount: Number(r.discount),
    discountCode: r.discount_code ?? undefined,
    total: Number(r.total),
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
