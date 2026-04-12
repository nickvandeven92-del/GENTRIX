import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Cart,
  CartItem,
  Category,
  CheckoutData,
  DiscountCode,
  Order,
  OrderStatus,
  Product,
  ProductVariant,
  Review,
  StockMutation,
  StockMutationType,
  WebshopConfig,
  WishlistItem,
} from '../types';
import {
  getVariantLabel,
  validateDiscountCode,
  calculateDiscount,
} from '../types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { clientRowToConfig } from '@/lib/webshop-mappers';
import { persistProduct } from '@/lib/persist-product';
import { getOrCreateGuestSessionId } from '@/lib/guest-session';
import { useAuth } from '@/context/AuthContext';
import { useClientBySlug } from '@/hooks/use-client-by-slug';
import { useProducts } from '@/hooks/use-products';
import { useCategories } from '@/hooks/use-categories';
import { useOrders } from '@/hooks/use-orders';
import { useDiscountCodes } from '@/hooks/use-discounts';
import { useReviews } from '@/hooks/use-reviews';
import { useStockMutations } from '@/hooks/use-stock-mutations';
import { useOwnerClientsList } from '@/hooks/use-owner-clients';
import type { Database } from '@/types/database';

type ClientRow = Database['public']['Tables']['clients']['Row'];

const OWNER_CLIENT_KEY = 'kameleon_owner_client_id';
const CART_PREFIX = 'kameleon-cart:';

function resolveStorefrontSlug(pathname: string): string {
  const m = pathname.match(/^\/shop\/c\/([^/]+)/);
  return m?.[1] ?? import.meta.env.VITE_DEFAULT_CLIENT_SLUG ?? 'demo-kapper';
}

function isDashboardPath(pathname: string) {
  return pathname.startsWith('/dashboard');
}

function isOwnerPath(pathname: string) {
  return pathname.startsWith('/owner');
}

interface CartLine {
  productId: string;
  variantId: string;
  quantity: number;
}

interface CartState {
  lines: CartLine[];
  isCartOpen: boolean;
  appliedCode?: string;
}

type CartAction =
  | { type: 'ADD'; productId: string; variantId: string; quantity: number }
  | { type: 'REMOVE'; variantId: string }
  | { type: 'QTY'; variantId: string; quantity: number }
  | { type: 'CLEAR' }
  | { type: 'TOGGLE'; open?: boolean }
  | { type: 'SET_CODE'; code?: string }
  | { type: 'HYDRATE'; lines: CartLine[] };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD': {
      const i = state.lines.findIndex(l => l.variantId === action.variantId);
      if (i >= 0) {
        const lines = [...state.lines];
        lines[i] = { ...lines[i], quantity: lines[i].quantity + action.quantity };
        return { ...state, lines };
      }
      return {
        ...state,
        lines: [...state.lines, { productId: action.productId, variantId: action.variantId, quantity: action.quantity }],
        isCartOpen: true,
      };
    }
    case 'REMOVE':
      return { ...state, lines: state.lines.filter(l => l.variantId !== action.variantId) };
    case 'QTY': {
      if (action.quantity <= 0) {
        return { ...state, lines: state.lines.filter(l => l.variantId !== action.variantId) };
      }
      return {
        ...state,
        lines: state.lines.map(l => (l.variantId === action.variantId ? { ...l, quantity: action.quantity } : l)),
      };
    }
    case 'CLEAR':
      return { ...state, lines: [], appliedCode: undefined };
    case 'TOGGLE':
      return { ...state, isCartOpen: action.open ?? !state.isCartOpen };
    case 'SET_CODE':
      return { ...state, appliedCode: action.code };
    case 'HYDRATE':
      return { ...state, lines: action.lines };
    default:
      return state;
  }
}

function calculateCart(
  items: CartItem[],
  taxRate: number,
  discountCode?: DiscountCode
): Cart {
  const subtotal = items.reduce((sum, item) => sum + item.variant.price * item.quantity, 0);
  let discount = 0;
  let appliedCode: string | undefined;
  if (discountCode?.active) {
    const validation = validateDiscountCode(discountCode, subtotal);
    if (validation.valid) {
      discount = calculateDiscount(discountCode, subtotal);
      appliedCode = discountCode.code;
    }
  }
  const taxableAmount = subtotal - discount;
  const tax = taxableAmount * taxRate;
  return {
    items,
    subtotal,
    tax,
    taxRate,
    discount,
    discountCode: appliedCode,
    total: taxableAmount + tax,
  };
}

function resolveLines(lines: CartLine[], products: Product[]): CartItem[] {
  const out: CartItem[] = [];
  for (const line of lines) {
    const product = products.find(p => p.id === line.productId);
    const variant = product?.variants.find(v => v.id === line.variantId);
    if (product && variant) {
      out.push({
        productId: line.productId,
        variantId: line.variantId,
        quantity: line.quantity,
        product,
        variant,
      });
    }
  }
  return out;
}

interface WebshopState {
  config: WebshopConfig;
  products: Product[];
  categories: Category[];
  cart: Cart;
  orders: Order[];
  stockMutations: StockMutation[];
  isCartOpen: boolean;
  discountCodes: DiscountCode[];
  reviews: Review[];
  wishlist: WishlistItem[];
}

interface WebshopContextValue {
  state: WebshopState;
  clientId: string | null;
  clientSlug: string;
  shopBasePath: string;
  dataLoading: boolean;
  shopUnavailable: boolean;
  guestSessionId: string;
  setOwnerDashboardClientId: (id: string) => void;
  addToCart: (product: Product, variant: ProductVariant, quantity?: number) => void;
  removeFromCart: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: (open?: boolean) => void;
  getProduct: (slug: string) => Product | undefined;
  getProductById: (id: string) => Product | undefined;
  getProductsByCategory: (categoryId: string) => Product[];
  updateProduct: (product: Product) => Promise<void>;
  addProduct: (product: Product) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  toggleProductActive: (productId: string) => Promise<void>;
  updateCategory: (category: Category) => Promise<void>;
  addCategory: (category: Category) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  adjustStock: (
    productId: string,
    variantId: string,
    quantity: number,
    reason: string,
    type?: StockMutationType,
    reference?: string
  ) => Promise<void>;
  bulkAdjustStock: (
    adjustments: { productId: string; variantId: string; quantity: number }[],
    reason: string
  ) => Promise<void>;
  bulkSetStatus: (productIds: string[], active: boolean) => Promise<void>;
  bulkSetCategory: (productIds: string[], categoryId: string) => Promise<void>;
  placeOrder: (checkout: CheckoutData) => Promise<{ ok: boolean; error?: string; orderNumber?: string }>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  updateConfig: (config: Partial<WebshopConfig>) => Promise<void>;
  applyDiscount: (code: string) => { valid: boolean; reason?: string };
  removeDiscount: () => void;
  addDiscountCode: (dc: DiscountCode) => Promise<void>;
  deleteDiscountCode: (id: string) => Promise<void>;
  toggleDiscountActive: (id: string) => Promise<void>;
  addReview: (review: Review) => Promise<void>;
  approveReview: (reviewId: string) => Promise<void>;
  deleteReview: (reviewId: string) => Promise<void>;
  getProductReviews: (productId: string) => Review[];
  toggleWishlist: (productId: string) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
  formatPrice: (price: number) => string;
  cartItemCount: number;
  refreshWishlist: () => Promise<void>;
}

const WebshopContext = createContext<WebshopContextValue | null>(null);

const defaultConfig: WebshopConfig = {
  enabled: false,
  simpleMode: true,
  currency: 'EUR',
  currencySymbol: '€',
  taxRate: 0.21,
  freeShippingThreshold: 50,
  shippingCost: 4.95,
  shopName: 'Webshop',
};

export function WebshopProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const pathname = location.pathname;
  const qc = useQueryClient();
  const { user, isOwner, clientAdminClientId } = useAuth();

  const storefrontSlug = resolveStorefrontSlug(pathname);
  const slugForPublicShop = !isDashboardPath(pathname) && !isOwnerPath(pathname) ? storefrontSlug : undefined;

  const { data: publicClient, isLoading: clientLoading } = useClientBySlug(slugForPublicShop, Boolean(slugForPublicShop));

  const [ownerClientId, setOwnerClientIdState] = useState<string | null>(() =>
    typeof localStorage !== 'undefined' ? localStorage.getItem(OWNER_CLIENT_KEY) : null
  );

  const { data: ownerClients } = useOwnerClientsList(isOwner && isDashboardPath(pathname));

  useEffect(() => {
    if (!isOwner || !ownerClients?.length) return;
    const valid = ownerClientId && ownerClients.some(c => c.id === ownerClientId);
    if (!valid) {
      const first = ownerClients[0].id;
      localStorage.setItem(OWNER_CLIENT_KEY, first);
      queueMicrotask(() => setOwnerClientIdState(first));
    }
  }, [isOwner, ownerClients, ownerClientId]);

  const setOwnerDashboardClientId = useCallback((id: string) => {
    localStorage.setItem(OWNER_CLIENT_KEY, id);
    setOwnerClientIdState(id);
  }, []);

  const dashboardClientId =
    isDashboardPath(pathname) && isOwner ? ownerClientId : isDashboardPath(pathname) ? clientAdminClientId ?? null : null;

  const { data: adminDashboardClient } = useQuery({
    queryKey: ['client', 'by-id', dashboardClientId],
    enabled:
      isSupabaseConfigured &&
      isDashboardPath(pathname) &&
      Boolean(dashboardClientId) &&
      !isOwner,
    queryFn: async (): Promise<ClientRow> => {
      const { data, error } = await supabase.from('clients').select('*').eq('id', dashboardClientId!).single();
      if (error) throw error;
      return data as ClientRow;
    },
  });

  const storefrontClientId = publicClient?.id ?? null;
  const activeClientId = isDashboardPath(pathname) ? dashboardClientId : storefrontClientId;

  const { data: products = [], isLoading: productsLoading } = useProducts(activeClientId ?? undefined, Boolean(activeClientId));
  const { data: categories = [], isLoading: catLoading } = useCategories(activeClientId ?? undefined, Boolean(activeClientId));
  const { data: orders = [] } = useOrders(activeClientId ?? undefined, Boolean(activeClientId) && isDashboardPath(pathname));
  const { data: discountCodes = [] } = useDiscountCodes(
    activeClientId ?? undefined,
    Boolean(activeClientId) && (isDashboardPath(pathname) || Boolean(storefrontClientId))
  );
  const { data: reviews = [] } = useReviews(activeClientId ?? undefined, Boolean(activeClientId));
  const { data: stockMutations = [] } = useStockMutations(
    activeClientId ?? undefined,
    Boolean(activeClientId) && isDashboardPath(pathname)
  );

  const [guestSessionId] = useState(() => getOrCreateGuestSessionId());
  const [wishlistLocal, setWishlistLocal] = useState<WishlistItem[]>([]);

  const config: WebshopConfig = useMemo(() => {
    if (!isSupabaseConfigured) return { ...defaultConfig, enabled: false };
    if (isDashboardPath(pathname) && dashboardClientId) {
      if (isOwner && ownerClients) {
        const row = ownerClients.find(c => c.id === dashboardClientId);
        if (row) return clientRowToConfig(row);
      }
      if (!isOwner && adminDashboardClient) return clientRowToConfig(adminDashboardClient);
    }
    if (publicClient) return clientRowToConfig(publicClient);
    return { ...defaultConfig, enabled: false };
  }, [pathname, dashboardClientId, ownerClients, publicClient, isOwner, adminDashboardClient]);

  const clientSlug =
    (isDashboardPath(pathname) && isOwner && ownerClients?.find(c => c.id === dashboardClientId)?.slug) ||
    (isDashboardPath(pathname) && !isOwner && adminDashboardClient?.slug) ||
    publicClient?.slug ||
    storefrontSlug;

  const shopBasePath = `/shop/c/${clientSlug}`;

  const [cartState, cartDispatch] = useReducer(cartReducer, { lines: [], isCartOpen: false });

  useEffect(() => {
    if (!activeClientId || !isSupabaseConfigured) return;
    try {
      const raw = localStorage.getItem(`${CART_PREFIX}${activeClientId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CartLine[];
      if (Array.isArray(parsed)) cartDispatch({ type: 'HYDRATE', lines: parsed });
    } catch {
      /* ignore */
    }
  }, [activeClientId]);

  useEffect(() => {
    if (!activeClientId || !isSupabaseConfigured) return;
    localStorage.setItem(`${CART_PREFIX}${activeClientId}`, JSON.stringify(cartState.lines));
  }, [activeClientId, cartState.lines]);

  const activeDiscount = useMemo(() => {
    if (!cartState.appliedCode) return undefined;
    return discountCodes.find(d => d.code === cartState.appliedCode && d.active);
  }, [cartState.appliedCode, discountCodes]);

  const cartItems = useMemo(
    () => resolveLines(cartState.lines, products),
    [cartState.lines, products]
  );

  const cart = useMemo(
    () => calculateCart(cartItems, config.taxRate, activeDiscount),
    [cartItems, config.taxRate, activeDiscount]
  );

  const loadWishlist = useCallback(async () => {
    if (!isSupabaseConfigured || !activeClientId || config.simpleMode) {
      queueMicrotask(() => setWishlistLocal([]));
      return;
    }
    let q = supabase.from('wishlist_items').select('product_id, added_at').eq('client_id', activeClientId);
    if (user?.id) q = q.eq('user_id', user.id);
    else q = q.eq('session_id', guestSessionId);
    const { data, error } = await q;
    if (error) {
      setWishlistLocal([]);
      return;
    }
    setWishlistLocal(
      (data ?? []).map(r => ({ productId: r.product_id, addedAt: r.added_at }))
    );
  }, [activeClientId, config.simpleMode, guestSessionId, user]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadWishlist();
    });
  }, [loadWishlist]);

  const dataLoading =
    isSupabaseConfigured &&
    Boolean(activeClientId) &&
    (productsLoading || catLoading || (slugForPublicShop && clientLoading));

  const shopUnavailable =
    isSupabaseConfigured &&
    Boolean(slugForPublicShop) &&
    !isDashboardPath(pathname) &&
    !isOwnerPath(pathname) &&
    !clientLoading &&
    !publicClient;

  const state: WebshopState = useMemo(
    () => ({
      config,
      products,
      categories,
      cart,
      orders,
      stockMutations,
      isCartOpen: cartState.isCartOpen,
      discountCodes,
      reviews,
      wishlist: wishlistLocal,
    }),
    [config, products, categories, cart, orders, stockMutations, cartState.isCartOpen, discountCodes, reviews, wishlistLocal]
  );

  const invalidateAll = useCallback(
    (cid: string) => {
      void qc.invalidateQueries({ queryKey: ['products', cid] });
      void qc.invalidateQueries({ queryKey: ['categories', cid] });
      void qc.invalidateQueries({ queryKey: ['orders', cid] });
      void qc.invalidateQueries({ queryKey: ['discount_codes', cid] });
      void qc.invalidateQueries({ queryKey: ['reviews', cid] });
      void qc.invalidateQueries({ queryKey: ['stock_mutations', cid] });
    },
    [qc]
  );

  const addToCart = useCallback((product: Product, variant: ProductVariant, quantity = 1) => {
    cartDispatch({ type: 'ADD', productId: product.id, variantId: variant.id, quantity });
  }, []);

  const removeFromCart = useCallback((variantId: string) => {
    cartDispatch({ type: 'REMOVE', variantId });
  }, []);

  const updateQuantity = useCallback((variantId: string, quantity: number) => {
    cartDispatch({ type: 'QTY', variantId, quantity });
  }, []);

  const clearCart = useCallback(() => cartDispatch({ type: 'CLEAR' }), []);
  const toggleCart = useCallback((open?: boolean) => cartDispatch({ type: 'TOGGLE', open }), []);

  const getProduct = useCallback((slug: string) => products.find(p => p.slug === slug), [products]);
  const getProductById = useCallback((id: string) => products.find(p => p.id === id), [products]);
  const getProductsByCategory = useCallback(
    (categoryId: string) => products.filter(p => p.categoryId === categoryId),
    [products]
  );

  const updateProduct = useCallback(
    async (product: Product) => {
      if (!activeClientId) return;
      await persistProduct(activeClientId, product, 'update');
      invalidateAll(activeClientId);
    },
    [activeClientId, invalidateAll]
  );

  const addProduct = useCallback(
    async (product: Product) => {
      if (!activeClientId) return;
      await persistProduct(activeClientId, product, 'create');
      invalidateAll(activeClientId);
    },
    [activeClientId, invalidateAll]
  );

  const deleteProduct = useCallback(
    async (productId: string) => {
      const { error } = await supabase.from('products').delete().eq('id', productId);
      if (error) throw error;
      if (activeClientId) invalidateAll(activeClientId);
    },
    [activeClientId, invalidateAll]
  );

  const toggleProductActive = useCallback(
    async (productId: string) => {
      const p = products.find(x => x.id === productId);
      if (!p) return;
      const { error } = await supabase.from('products').update({ active: !p.active }).eq('id', productId);
      if (error) throw error;
      if (activeClientId) invalidateAll(activeClientId);
    },
    [products, activeClientId, invalidateAll]
  );

  const updateCategory = useCallback(
    async (category: Category) => {
      const { error } = await supabase
        .from('categories')
        .update({
          slug: category.slug,
          name: category.name,
          description: category.description ?? null,
          image: category.image ?? null,
          parent_id: category.parentId ?? null,
          active: category.active,
          sort_order: category.sortOrder,
        })
        .eq('id', category.id);
      if (error) throw error;
      if (activeClientId) void qc.invalidateQueries({ queryKey: ['categories', activeClientId] });
    },
    [activeClientId, qc]
  );

  const addCategory = useCallback(
    async (category: Category) => {
      if (!activeClientId) return;
      const { error } = await supabase.from('categories').insert({
        client_id: activeClientId,
        slug: category.slug,
        name: category.name,
        description: category.description ?? null,
        image: category.image ?? null,
        parent_id: category.parentId ?? null,
        active: category.active,
        sort_order: category.sortOrder,
      });
      if (error) throw error;
      void qc.invalidateQueries({ queryKey: ['categories', activeClientId] });
    },
    [activeClientId, qc]
  );

  const deleteCategory = useCallback(
    async (categoryId: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', categoryId);
      if (error) throw error;
      if (activeClientId) void qc.invalidateQueries({ queryKey: ['categories', activeClientId] });
    },
    [activeClientId, qc]
  );

  const adjustStock = useCallback(
    async (
      productId: string,
      variantId: string,
      quantity: number,
      reason: string,
      mutationType: StockMutationType = 'adjustment',
      reference?: string
    ) => {
      if (!activeClientId) return;
      const p = products.find(x => x.id === productId);
      const v = p?.variants.find(x => x.id === variantId);
      if (!p || !v) return;
      const prev = v.stock;
      const newStock = prev + quantity;
      const { error: uerr } = await supabase.from('product_variants').update({ stock: newStock }).eq('id', variantId);
      if (uerr) throw uerr;
      const { error: ierr } = await supabase.from('stock_mutations').insert({
        client_id: activeClientId,
        product_id: productId,
        variant_id: variantId,
        product_name: p.name,
        variant_label: getVariantLabel(v),
        type: mutationType,
        quantity,
        previous_stock: prev,
        new_stock: newStock,
        reason,
        reference: reference ?? null,
        created_by: user?.email ?? 'admin',
      });
      if (ierr) throw ierr;
      invalidateAll(activeClientId);
    },
    [activeClientId, products, user?.email, invalidateAll]
  );

  const bulkAdjustStock = useCallback(
    async (adjustments: { productId: string; variantId: string; quantity: number }[], reason: string) => {
      for (const a of adjustments) {
        await adjustStock(a.productId, a.variantId, a.quantity, reason, 'adjustment');
      }
    },
    [adjustStock]
  );

  const bulkSetStatus = useCallback(
    async (productIds: string[], active: boolean) => {
      if (!productIds.length) return;
      const { error } = await supabase.from('products').update({ active }).in('id', productIds);
      if (error) throw error;
      if (activeClientId) invalidateAll(activeClientId);
    },
    [activeClientId, invalidateAll]
  );

  const bulkSetCategory = useCallback(
    async (productIds: string[], categoryId: string) => {
      if (!productIds.length) return;
      const { error } = await supabase.from('products').update({ category_id: categoryId }).in('id', productIds);
      if (error) throw error;
      if (activeClientId) invalidateAll(activeClientId);
    },
    [activeClientId, invalidateAll]
  );

  const placeOrder = useCallback(
    async (checkout: CheckoutData) => {
      if (!storefrontClientId || !isSupabaseConfigured) {
        return { ok: false, error: 'Shop niet beschikbaar' };
      }
      const items = cartItems.map(i => ({ variant_id: i.variantId, quantity: i.quantity }));
      const { data, error } = await supabase.rpc('submit_guest_order', {
        p_client_id: storefrontClientId,
        p_email: checkout.email,
        p_first_name: checkout.firstName,
        p_last_name: checkout.lastName,
        p_address: checkout.address,
        p_city: checkout.city,
        p_postal_code: checkout.postalCode,
        p_country: checkout.country,
        p_phone: checkout.phone ?? '',
        p_notes: checkout.notes ?? '',
        p_items: items,
        p_discount_code: cart.discountCode ?? null,
      });
      if (error) {
        const msg =
          error.message?.includes('insufficient_stock') ? 'Niet genoeg voorraad' : error.message ?? 'Bestellen mislukt';
        return { ok: false, error: msg };
      }
      const row = data as { order_number?: string } | null;
      cartDispatch({ type: 'CLEAR' });
      if (storefrontClientId) invalidateAll(storefrontClientId);
      return { ok: true, orderNumber: row?.order_number };
    },
    [storefrontClientId, cartItems, cart.discountCode, invalidateAll]
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      const order = orders.find(o => o.id === orderId);
      if (!order || !activeClientId) return;
      if (status === 'cancelled' && order.status !== 'cancelled') {
        for (const item of order.items) {
          if (!item.variantId) continue;
          const { data: vrow } = await supabase.from('product_variants').select('stock').eq('id', item.variantId).single();
          const prev = vrow?.stock ?? 0;
          const newStock = prev + item.quantity;
          await supabase.from('product_variants').update({ stock: newStock }).eq('id', item.variantId);
          await supabase.from('stock_mutations').insert({
            client_id: activeClientId,
            product_id: item.productId,
            variant_id: item.variantId,
            product_name: item.productName,
            variant_label: item.variantLabel,
            type: 'return',
            quantity: item.quantity,
            previous_stock: prev,
            new_stock: newStock,
            reason: 'Bestelling geannuleerd',
            reference: order.orderNumber,
            created_by: user?.email ?? 'admin',
          });
        }
      }
      const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
      if (error) throw error;
      invalidateAll(activeClientId);
    },
    [orders, activeClientId, user?.email, invalidateAll]
  );

  const updateConfig = useCallback(
    async (cfg: Partial<WebshopConfig>) => {
      if (!activeClientId) return;
      const patch: Record<string, unknown> = {};
      if (cfg.shopName != null) patch.shop_name = cfg.shopName;
      if (cfg.shopDescription !== undefined) patch.shop_description = cfg.shopDescription;
      if (cfg.currency != null) patch.currency = cfg.currency;
      if (cfg.currencySymbol != null) patch.currency_symbol = cfg.currencySymbol;
      if (cfg.taxRate != null) patch.tax_rate = cfg.taxRate;
      if (cfg.freeShippingThreshold != null) patch.free_shipping_threshold = cfg.freeShippingThreshold;
      if (cfg.shippingCost != null) patch.shipping_cost = cfg.shippingCost;
      const { error } = await supabase.from('clients').update(patch).eq('id', activeClientId);
      if (error) throw error;
      void qc.invalidateQueries({ queryKey: ['owner-clients'] });
      void qc.invalidateQueries({ queryKey: ['client', 'slug'] });
    },
    [activeClientId, qc]
  );

  const applyDiscount = useCallback(
    (code: string): { valid: boolean; reason?: string } => {
      const dc = discountCodes.find(d => d.code === code && d.active);
      if (!dc) return { valid: false, reason: 'Ongeldige kortingscode' };
      const validation = validateDiscountCode(dc, cart.subtotal);
      if (!validation.valid) return validation;
      cartDispatch({ type: 'SET_CODE', code });
      return { valid: true };
    },
    [discountCodes, cart.subtotal]
  );

  const removeDiscount = useCallback(() => cartDispatch({ type: 'SET_CODE', code: undefined }), []);

  const addDiscountCode = useCallback(
    async (dc: DiscountCode) => {
      if (!activeClientId) return;
      const { error } = await supabase.from('discount_codes').insert({
        client_id: activeClientId,
        code: dc.code,
        type: dc.type,
        value: dc.value,
        min_order_amount: dc.minOrderAmount ?? null,
        max_uses: dc.maxUses ?? null,
        active: dc.active,
        valid_from: dc.validFrom ?? null,
        valid_until: dc.validUntil ?? null,
      });
      if (error) throw error;
      void qc.invalidateQueries({ queryKey: ['discount_codes', activeClientId] });
    },
    [activeClientId, qc]
  );

  const deleteDiscountCode = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('discount_codes').delete().eq('id', id);
      if (error) throw error;
      if (activeClientId) void qc.invalidateQueries({ queryKey: ['discount_codes', activeClientId] });
    },
    [activeClientId, qc]
  );

  const toggleDiscountActive = useCallback(
    async (id: string) => {
      const dc = discountCodes.find(d => d.id === id);
      if (!dc) return;
      const { error } = await supabase.from('discount_codes').update({ active: !dc.active }).eq('id', id);
      if (error) throw error;
      if (activeClientId) void qc.invalidateQueries({ queryKey: ['discount_codes', activeClientId] });
    },
    [discountCodes, activeClientId, qc]
  );

  const addReview = useCallback(
    async (review: Review) => {
      if (!activeClientId) return;
      const { error } = await supabase.from('reviews').insert({
        client_id: activeClientId,
        product_id: review.productId,
        author: review.author,
        email: review.email,
        rating: review.rating,
        title: review.title,
        body: review.body,
        verified: review.verified,
        approved: false,
      });
      if (error) throw error;
      void qc.invalidateQueries({ queryKey: ['reviews', activeClientId] });
    },
    [activeClientId, qc]
  );

  const approveReview = useCallback(
    async (reviewId: string) => {
      const { error } = await supabase.from('reviews').update({ approved: true }).eq('id', reviewId);
      if (error) throw error;
      if (activeClientId) void qc.invalidateQueries({ queryKey: ['reviews', activeClientId] });
    },
    [activeClientId, qc]
  );

  const deleteReview = useCallback(
    async (reviewId: string) => {
      const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
      if (error) throw error;
      if (activeClientId) void qc.invalidateQueries({ queryKey: ['reviews', activeClientId] });
    },
    [activeClientId, qc]
  );

  const getProductReviews = useCallback(
    (productId: string) => reviews.filter(r => r.productId === productId),
    [reviews]
  );

  const toggleWishlist = useCallback(
    async (productId: string) => {
      if (!activeClientId || config.simpleMode || !isSupabaseConfigured) return;
      const exists = wishlistLocal.some(w => w.productId === productId);
      if (exists) {
        let q = supabase.from('wishlist_items').delete().eq('client_id', activeClientId).eq('product_id', productId);
        if (user?.id) q = q.eq('user_id', user.id);
        else q = q.eq('session_id', guestSessionId);
        const { error } = await q;
        if (error) throw error;
      } else {
        const { error } = await supabase.from('wishlist_items').insert({
          client_id: activeClientId,
          product_id: productId,
          user_id: user?.id ?? null,
          session_id: user?.id ? null : guestSessionId,
        });
        if (error) throw error;
      }
      await loadWishlist();
    },
    [activeClientId, config.simpleMode, wishlistLocal, user, guestSessionId, loadWishlist]
  );

  const isInWishlist = useCallback(
    (productId: string) => wishlistLocal.some(w => w.productId === productId),
    [wishlistLocal]
  );

  const formatPrice = useCallback(
    (price: number) => `${config.currencySymbol}${price.toFixed(2).replace('.', ',')}`,
    [config.currencySymbol]
  );

  const cartItemCount = useMemo(() => cart.items.reduce((s, i) => s + i.quantity, 0), [cart.items]);

  const value = useMemo(
    (): WebshopContextValue => ({
      state,
      clientId: activeClientId,
      clientSlug,
      shopBasePath,
      dataLoading,
      shopUnavailable,
      guestSessionId,
      setOwnerDashboardClientId,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      toggleCart,
      getProduct,
      getProductById,
      getProductsByCategory,
      updateProduct,
      addProduct,
      deleteProduct,
      toggleProductActive,
      updateCategory,
      addCategory,
      deleteCategory,
      adjustStock,
      bulkAdjustStock,
      bulkSetStatus,
      bulkSetCategory,
      placeOrder,
      updateOrderStatus,
      updateConfig,
      applyDiscount,
      removeDiscount,
      addDiscountCode,
      deleteDiscountCode,
      toggleDiscountActive,
      addReview,
      approveReview,
      deleteReview,
      getProductReviews,
      toggleWishlist,
      isInWishlist,
      formatPrice,
      cartItemCount,
      refreshWishlist: loadWishlist,
    }),
    [
      state,
      activeClientId,
      clientSlug,
      shopBasePath,
      dataLoading,
      shopUnavailable,
      guestSessionId,
      setOwnerDashboardClientId,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      toggleCart,
      getProduct,
      getProductById,
      getProductsByCategory,
      updateProduct,
      addProduct,
      deleteProduct,
      toggleProductActive,
      updateCategory,
      addCategory,
      deleteCategory,
      adjustStock,
      bulkAdjustStock,
      bulkSetStatus,
      bulkSetCategory,
      placeOrder,
      updateOrderStatus,
      updateConfig,
      applyDiscount,
      removeDiscount,
      addDiscountCode,
      deleteDiscountCode,
      toggleDiscountActive,
      addReview,
      approveReview,
      deleteReview,
      getProductReviews,
      toggleWishlist,
      isInWishlist,
      formatPrice,
      cartItemCount,
      loadWishlist,
    ]
  );

  return <WebshopContext.Provider value={value}>{children}</WebshopContext.Provider>;
}

export function useWebshop() {
  const ctx = useContext(WebshopContext);
  if (!ctx) throw new Error('useWebshop must be used within WebshopProvider');
  return ctx;
}
