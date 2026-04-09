import { supabase } from '@/lib/supabase';
import type { Product, ProductVariant } from '@/webshop/types';

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function variantRow(productId: string, v: ProductVariant) {
  return {
    product_id: productId,
    options: v.options as Record<string, string>,
    price: v.price,
    compare_at_price: v.compareAtPrice ?? null,
    stock: v.stock,
    reserved_stock: v.reservedStock,
    sku: v.sku || null,
    image: v.image ?? null,
    track_inventory: v.trackInventory,
    allow_backorder: v.allowBackorder,
  };
}

export async function persistProduct(clientId: string, product: Product, mode: 'create' | 'update'): Promise<void> {
  const base = {
    client_id: clientId,
    slug: product.slug,
    name: product.name,
    description: product.description || null,
    short_description: product.shortDescription ?? null,
    images: product.images.length ? product.images : [],
    category_id: product.categoryId || null,
    tags: product.tags ?? [],
    base_price: product.basePrice,
    compare_at_price: product.compareAtPrice ?? null,
    status: product.status,
    track_inventory: product.trackInventory,
    allow_backorder: product.allowBackorder,
    low_stock_threshold: product.lowStockThreshold,
    active: product.active,
    meta_title: product.metaTitle ?? null,
    meta_description: product.metaDescription ?? null,
    og_image: product.ogImage ?? null,
  };

  let productId = product.id;

  if (mode === 'create' || !isUuid(product.id)) {
    const { data, error } = await supabase.from('products').insert(base).select('id').single();
    if (error) throw error;
    productId = data.id;
  } else {
    const { error } = await supabase.from('products').update(base).eq('id', product.id);
    if (error) throw error;
    productId = product.id;
  }

  await supabase.from('product_variant_options').delete().eq('product_id', productId);
  if (product.variantOptions.length) {
    const { error: optErr } = await supabase.from('product_variant_options').insert(
      product.variantOptions.map((o, i) => ({
        product_id: productId,
        name: o.name,
        values: o.values,
        sort_order: i,
      }))
    );
    if (optErr) throw optErr;
  }

  const { data: existingVars, error: exErr } = await supabase
    .from('product_variants')
    .select('id')
    .eq('product_id', productId);
  if (exErr) throw exErr;

  const incomingUuids = new Set(product.variants.filter(v => isUuid(v.id)).map(v => v.id));
  const toDelete = (existingVars ?? []).map(r => r.id).filter(id => !incomingUuids.has(id));
  if (toDelete.length) {
    const { error: delErr } = await supabase.from('product_variants').delete().in('id', toDelete);
    if (delErr) throw delErr;
  }

  for (const v of product.variants) {
    const row = variantRow(productId, v);
    if (isUuid(v.id)) {
      const { error } = await supabase.from('product_variants').update(row).eq('id', v.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('product_variants').insert({ ...row, id: crypto.randomUUID() });
      if (error) throw error;
    }
  }
}
