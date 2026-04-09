export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole = 'owner' | 'client_admin';
export type ProductStatus = 'active' | 'draft' | 'sold_out' | 'archived';
export type OrderStatus = 'new' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type DiscountType = 'percentage' | 'fixed';
export type StockMutationType = 'sale' | 'return' | 'adjustment' | 'restock' | 'reservation' | 'release';

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo: string | null;
          domain: string | null;
          webshop_enabled: boolean;
          simple_mode: boolean;
          currency: string;
          currency_symbol: string;
          tax_rate: number;
          free_shipping_threshold: number;
          shipping_cost: number;
          shop_name: string;
          shop_description: string | null;
          theme_settings: Json;
          owner_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['clients']['Row']> & {
          name: string;
          slug: string;
          shop_name: string;
        };
        Update: Partial<Database['public']['Tables']['clients']['Row']>;
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: AppRole;
          client_id: string | null;
        };
        Insert: {
          user_id: string;
          role: AppRole;
          client_id?: string | null;
        };
        Update: Partial<Database['public']['Tables']['user_roles']['Row']>;
      };
      categories: {
        Row: {
          id: string;
          client_id: string;
          slug: string;
          name: string;
          description: string | null;
          image: string | null;
          parent_id: string | null;
          active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at'> & { id?: string };
        Update: Partial<Database['public']['Tables']['categories']['Row']>;
      };
      products: {
        Row: {
          id: string;
          client_id: string;
          slug: string;
          name: string;
          description: string | null;
          short_description: string | null;
          images: string[];
          category_id: string | null;
          tags: string[];
          base_price: number;
          compare_at_price: number | null;
          total_stock: number;
          status: ProductStatus;
          track_inventory: boolean;
          allow_backorder: boolean;
          low_stock_threshold: number;
          active: boolean;
          meta_title: string | null;
          meta_description: string | null;
          og_image: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at' | 'total_stock'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['products']['Row']>;
      };
      product_variant_options: {
        Row: {
          id: string;
          product_id: string;
          name: string;
          values: string[];
          sort_order: number;
        };
        Insert: Omit<Database['public']['Tables']['product_variant_options']['Row'], 'id'> & { id?: string };
        Update: Partial<Database['public']['Tables']['product_variant_options']['Row']>;
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          options: Json;
          price: number;
          compare_at_price: number | null;
          stock: number;
          reserved_stock: number;
          sku: string | null;
          image: string | null;
          track_inventory: boolean;
          allow_backorder: boolean;
        };
        Insert: Omit<Database['public']['Tables']['product_variants']['Row'], 'id'> & { id?: string };
        Update: Partial<Database['public']['Tables']['product_variants']['Row']>;
      };
      orders: {
        Row: {
          id: string;
          client_id: string;
          order_number: string;
          subtotal: number;
          tax: number;
          discount: number;
          discount_code: string | null;
          total: number;
          status: OrderStatus;
          email: string;
          first_name: string;
          last_name: string;
          address: string;
          city: string;
          postal_code: string;
          country: string;
          phone: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'created_at' | 'updated_at' | 'order_number'> & {
          id?: string;
          order_number?: string;
        };
        Update: Partial<Database['public']['Tables']['orders']['Row']>;
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          variant_id: string | null;
          product_name: string;
          variant_label: string;
          sku: string | null;
          quantity: number;
          unit_price: number;
          total_price: number;
        };
        Insert: Omit<Database['public']['Tables']['order_items']['Row'], 'id'> & { id?: string };
        Update: Partial<Database['public']['Tables']['order_items']['Row']>;
      };
      discount_codes: {
        Row: {
          id: string;
          client_id: string;
          code: string;
          type: DiscountType;
          value: number;
          min_order_amount: number | null;
          max_uses: number | null;
          used_count: number;
          active: boolean;
          valid_from: string | null;
          valid_until: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['discount_codes']['Row'], 'id' | 'created_at' | 'used_count'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['discount_codes']['Row']>;
      };
      reviews: {
        Row: {
          id: string;
          client_id: string;
          product_id: string;
          author: string;
          email: string;
          rating: number;
          title: string;
          body: string;
          verified: boolean;
          approved: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['reviews']['Row'], 'id' | 'created_at'> & { id?: string };
        Update: Partial<Database['public']['Tables']['reviews']['Row']>;
      };
      stock_mutations: {
        Row: {
          id: string;
          client_id: string;
          product_id: string;
          variant_id: string;
          product_name: string;
          variant_label: string;
          type: StockMutationType;
          quantity: number;
          previous_stock: number;
          new_stock: number;
          reason: string;
          reference: string | null;
          created_at: string;
          created_by: string;
        };
        Insert: Omit<Database['public']['Tables']['stock_mutations']['Row'], 'id' | 'created_at'> & { id?: string };
        Update: Partial<Database['public']['Tables']['stock_mutations']['Row']>;
      };
      analytics_events: {
        Row: {
          id: string;
          client_id: string;
          type: string;
          data: Json;
          session_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['analytics_events']['Row'], 'id' | 'created_at'> & { id?: string };
        Update: Partial<Database['public']['Tables']['analytics_events']['Row']>;
      };
      wishlist_items: {
        Row: {
          id: string;
          user_id: string | null;
          session_id: string | null;
          client_id: string;
          product_id: string;
          added_at: string;
        };
        Insert: Omit<Database['public']['Tables']['wishlist_items']['Row'], 'id' | 'added_at'> & { id?: string };
        Update: Partial<Database['public']['Tables']['wishlist_items']['Row']>;
      };
    };
    Functions: {
      submit_guest_order: {
        Args: {
          p_client_id: string;
          p_email: string;
          p_first_name: string;
          p_last_name: string;
          p_address: string;
          p_city: string;
          p_postal_code: string;
          p_country: string;
          p_phone: string | null;
          p_notes: string | null;
          p_items: Json;
          p_discount_code: string | null;
        };
        Returns: Json;
      };
    };
  };
}
