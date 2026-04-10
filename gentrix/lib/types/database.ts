/**
 * Handmatig gesynchroniseerd met supabase/migrations.
 * Vervang later door `supabase gen types typescript` output.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ClientStatus = "draft" | "active" | "paused" | "archived";

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          subfolder_slug: string;
          site_data_json: Json;
          status: ClientStatus;
          generation_package: string;
          created_at: string;
          updated_at: string;
          billing_email: string | null;
          phone: string | null;
          contact_name: string | null;
          company_legal_name: string | null;
          vat_number: string | null;
          billing_address: string | null;
          billing_postal_code: string | null;
          billing_city: string | null;
          plan_type: string | null;
          plan_label: string | null;
          payment_status: string;
          payment_provider: string | null;
          payment_reference: string | null;
          subscription_renews_at: string | null;
          delivered_at: string | null;
          contract_accepted_at: string | null;
          internal_notes: string | null;
          pipeline_stage: string;
          custom_domain: string | null;
          domain_verified: boolean;
          domain_dns_target: string | null;
          draft_snapshot_id: string | null;
          published_snapshot_id: string | null;
          client_number: string;
          appointments_enabled: boolean;
          webshop_enabled: boolean;
          booking_settings: Json | null;
          portal_invoices_enabled: boolean;
          portal_account_enabled: boolean;
          subscription_cancel_at_period_end: boolean;
          subscription_cancel_requested_at: string | null;
          portal_user_id: string | null;
          /** Token voor /preview/{slug}?token= (concept zonder status active). */
          preview_secret: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          subfolder_slug: string;
          site_data_json?: Json;
          status?: ClientStatus;
          generation_package?: string;
          created_at?: string;
          updated_at?: string;
          billing_email?: string | null;
          phone?: string | null;
          contact_name?: string | null;
          company_legal_name?: string | null;
          vat_number?: string | null;
          billing_address?: string | null;
          billing_postal_code?: string | null;
          billing_city?: string | null;
          plan_type?: string | null;
          plan_label?: string | null;
          payment_status?: string;
          payment_provider?: string | null;
          payment_reference?: string | null;
          subscription_renews_at?: string | null;
          delivered_at?: string | null;
          contract_accepted_at?: string | null;
          internal_notes?: string | null;
          pipeline_stage?: string;
          custom_domain?: string | null;
          domain_verified?: boolean;
          domain_dns_target?: string | null;
          draft_snapshot_id?: string | null;
          published_snapshot_id?: string | null;
          client_number?: string;
          appointments_enabled?: boolean;
          webshop_enabled?: boolean;
          booking_settings?: Json | null;
          portal_invoices_enabled?: boolean;
          portal_account_enabled?: boolean;
          subscription_cancel_at_period_end?: boolean;
          subscription_cancel_requested_at?: string | null;
          portal_user_id?: string | null;
          preview_secret?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          subfolder_slug?: string;
          site_data_json?: Json;
          status?: ClientStatus;
          generation_package?: string;
          created_at?: string;
          updated_at?: string;
          billing_email?: string | null;
          phone?: string | null;
          contact_name?: string | null;
          company_legal_name?: string | null;
          vat_number?: string | null;
          billing_address?: string | null;
          billing_postal_code?: string | null;
          billing_city?: string | null;
          plan_type?: string | null;
          plan_label?: string | null;
          payment_status?: string;
          payment_provider?: string | null;
          payment_reference?: string | null;
          subscription_renews_at?: string | null;
          delivered_at?: string | null;
          contract_accepted_at?: string | null;
          internal_notes?: string | null;
          pipeline_stage?: string;
          custom_domain?: string | null;
          domain_verified?: boolean;
          domain_dns_target?: string | null;
          draft_snapshot_id?: string | null;
          published_snapshot_id?: string | null;
          appointments_enabled?: boolean;
          webshop_enabled?: boolean;
          booking_settings?: Json | null;
          portal_invoices_enabled?: boolean;
          portal_account_enabled?: boolean;
          subscription_cancel_at_period_end?: boolean;
          subscription_cancel_requested_at?: string | null;
          portal_user_id?: string | null;
          preview_secret?: string | null;
        };
        Relationships: [];
      };
      client_dossier_notes: {
        Row: {
          id: string;
          client_id: string;
          body: string;
          created_by: string;
          created_by_label: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          body: string;
          created_by: string;
          created_by_label: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          body?: string;
          created_by?: string;
          created_by_label?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      client_appointments: {
        Row: {
          id: string;
          client_id: string;
          title: string;
          starts_at: string;
          ends_at: string;
          status: string;
          notes: string | null;
          staff_id: string | null;
          booking_service_id: string | null;
          booker_name: string | null;
          booker_email: string | null;
          booker_wants_confirmation: boolean;
          booker_wants_reminder: boolean;
          reminder_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          title?: string;
          starts_at: string;
          ends_at: string;
          status?: string;
          notes?: string | null;
          staff_id?: string | null;
          booking_service_id?: string | null;
          booker_name?: string | null;
          booker_email?: string | null;
          booker_wants_confirmation?: boolean;
          booker_wants_reminder?: boolean;
          reminder_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          title?: string;
          starts_at?: string;
          ends_at?: string;
          status?: string;
          notes?: string | null;
          staff_id?: string | null;
          booking_service_id?: string | null;
          booker_name?: string | null;
          booker_email?: string | null;
          booker_wants_confirmation?: boolean;
          booker_wants_reminder?: boolean;
          reminder_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      client_booking_services: {
        Row: {
          id: string;
          client_id: string;
          name: string;
          description: string | null;
          duration_minutes: number;
          price_cents: number | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          name: string;
          description?: string | null;
          duration_minutes: number;
          price_cents?: number | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          name?: string;
          description?: string | null;
          duration_minutes?: number;
          price_cents?: number | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      client_staff: {
        Row: {
          id: string;
          client_id: string;
          name: string;
          sort_order: number;
          color_hex: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          name: string;
          sort_order?: number;
          color_hex?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          name?: string;
          sort_order?: number;
          color_hex?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      client_staff_shifts: {
        Row: {
          id: string;
          client_id: string;
          staff_id: string;
          starts_at: string;
          ends_at: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          staff_id: string;
          starts_at: string;
          ends_at: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          staff_id?: string;
          starts_at?: string;
          ends_at?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      site_snapshots: {
        Row: {
          id: string;
          client_id: string;
          created_at: string;
          source: string;
          payload_json: Json;
          parent_snapshot_id: string | null;
          label: string | null;
          notes: string | null;
          created_by: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          created_at?: string;
          source?: string;
          payload_json: Json;
          parent_snapshot_id?: string | null;
          label?: string | null;
          notes?: string | null;
          created_by?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          created_at?: string;
          source?: string;
          payload_json?: Json;
          parent_snapshot_id?: string | null;
          label?: string | null;
          notes?: string | null;
          created_by?: string;
        };
        Relationships: [];
      };
      site_generation_runs: {
        Row: {
          id: string;
          client_id: string;
          created_at: string;
          operation: string;
          prompt_excerpt: string | null;
          interpretation_json: Json | null;
          model: string | null;
          input_snapshot_id: string | null;
          output_snapshot_id: string | null;
          prompt_hash: string | null;
          preset_ids: Json | null;
          layout_archetypes: Json | null;
          command_chain: Json | null;
          status: string | null;
          outcome: string | null;
        };
        Insert: {
          id?: string;
          client_id: string;
          created_at?: string;
          operation: string;
          prompt_excerpt?: string | null;
          interpretation_json?: Json | null;
          model?: string | null;
          input_snapshot_id?: string | null;
          output_snapshot_id?: string | null;
          prompt_hash?: string | null;
          preset_ids?: Json | null;
          layout_archetypes?: Json | null;
          command_chain?: Json | null;
          status?: string | null;
          outcome?: string | null;
        };
        Update: {
          id?: string;
          client_id?: string;
          created_at?: string;
          operation?: string;
          prompt_excerpt?: string | null;
          interpretation_json?: Json | null;
          model?: string | null;
          input_snapshot_id?: string | null;
          output_snapshot_id?: string | null;
          prompt_hash?: string | null;
          preset_ids?: Json | null;
          layout_archetypes?: Json | null;
          command_chain?: Json | null;
          status?: string | null;
          outcome?: string | null;
        };
        Relationships: [];
      };
      ai_knowledge: {
        Row: {
          id: string;
          category: string;
          title: string;
          body: string;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
          journal_source: string | null;
          auto_generated: boolean;
          reference_image_urls: string[];
        };
        Insert: {
          id?: string;
          category: string;
          title: string;
          body: string;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          journal_source?: string | null;
          auto_generated?: boolean;
          reference_image_urls?: string[];
        };
        Update: {
          id?: string;
          category?: string;
          title?: string;
          body?: string;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          journal_source?: string | null;
          auto_generated?: boolean;
          reference_image_urls?: string[];
        };
        Relationships: [];
      };
      ai_usage_events: {
        Row: {
          id: string;
          created_at: string;
          operation: string;
          model: string;
          input_tokens: number;
          output_tokens: number;
          cache_creation_input_tokens: number | null;
          cache_read_input_tokens: number | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          operation: string;
          model: string;
          input_tokens?: number;
          output_tokens?: number;
          cache_creation_input_tokens?: number | null;
          cache_read_input_tokens?: number | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          operation?: string;
          model?: string;
          input_tokens?: number;
          output_tokens?: number;
          cache_creation_input_tokens?: number | null;
          cache_read_input_tokens?: number | null;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          client_id: string;
          deal_id: string | null;
          origin_quote_id: string | null;
          invoice_number: string | null;
          amount: string;
          status: string;
          due_date: string;
          paid_at: string | null;
          issued_at: string | null;
          sent_at: string | null;
          currency: string;
          notes: string | null;
          company_name_snapshot: string | null;
          contact_name_snapshot: string | null;
          billing_email_snapshot: string | null;
          billing_phone_snapshot: string | null;
          billing_address_snapshot: string | null;
          billing_postal_code_snapshot: string | null;
          billing_city_snapshot: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          deal_id?: string | null;
          origin_quote_id?: string | null;
          invoice_number?: string | null;
          amount: number | string;
          status?: string;
          due_date: string;
          paid_at?: string | null;
          issued_at?: string | null;
          sent_at?: string | null;
          currency?: string;
          notes?: string | null;
          company_name_snapshot?: string | null;
          contact_name_snapshot?: string | null;
          billing_email_snapshot?: string | null;
          billing_phone_snapshot?: string | null;
          billing_address_snapshot?: string | null;
          billing_postal_code_snapshot?: string | null;
          billing_city_snapshot?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          deal_id?: string | null;
          origin_quote_id?: string | null;
          invoice_number?: string | null;
          amount?: number | string;
          status?: string;
          due_date?: string;
          paid_at?: string | null;
          issued_at?: string | null;
          sent_at?: string | null;
          currency?: string;
          notes?: string | null;
          company_name_snapshot?: string | null;
          contact_name_snapshot?: string | null;
          billing_email_snapshot?: string | null;
          billing_phone_snapshot?: string | null;
          billing_address_snapshot?: string | null;
          billing_postal_code_snapshot?: string | null;
          billing_city_snapshot?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          description: string;
          quantity: string;
          unit_price: string;
          line_total: string;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          description: string;
          quantity?: number | string;
          unit_price: number | string;
          line_total: number | string;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          description?: string;
          quantity?: number | string;
          unit_price?: number | string;
          line_total?: number | string;
          position?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      quotes: {
        Row: {
          id: string;
          client_id: string;
          deal_id: string | null;
          quote_number: string;
          amount: string;
          status: string;
          valid_until: string;
          issued_at: string | null;
          sent_at: string | null;
          accepted_at: string | null;
          rejected_at: string | null;
          currency: string;
          notes: string | null;
          title: string | null;
          intro_text: string | null;
          scope_text: string | null;
          delivery_text: string | null;
          exclusions_text: string | null;
          terms_text: string | null;
          company_name_snapshot: string | null;
          contact_name_snapshot: string | null;
          billing_email_snapshot: string | null;
          billing_phone_snapshot: string | null;
          billing_address_snapshot: string | null;
          billing_postal_code_snapshot: string | null;
          billing_city_snapshot: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          deal_id?: string | null;
          quote_number: string;
          amount: number | string;
          status?: string;
          valid_until: string;
          issued_at?: string | null;
          sent_at?: string | null;
          accepted_at?: string | null;
          rejected_at?: string | null;
          currency?: string;
          notes?: string | null;
          title?: string | null;
          intro_text?: string | null;
          scope_text?: string | null;
          delivery_text?: string | null;
          exclusions_text?: string | null;
          terms_text?: string | null;
          company_name_snapshot?: string | null;
          contact_name_snapshot?: string | null;
          billing_email_snapshot?: string | null;
          billing_phone_snapshot?: string | null;
          billing_address_snapshot?: string | null;
          billing_postal_code_snapshot?: string | null;
          billing_city_snapshot?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          deal_id?: string | null;
          quote_number?: string;
          amount?: number | string;
          status?: string;
          valid_until?: string;
          issued_at?: string | null;
          sent_at?: string | null;
          accepted_at?: string | null;
          rejected_at?: string | null;
          currency?: string;
          notes?: string | null;
          title?: string | null;
          intro_text?: string | null;
          scope_text?: string | null;
          delivery_text?: string | null;
          exclusions_text?: string | null;
          terms_text?: string | null;
          company_name_snapshot?: string | null;
          contact_name_snapshot?: string | null;
          billing_email_snapshot?: string | null;
          billing_phone_snapshot?: string | null;
          billing_address_snapshot?: string | null;
          billing_postal_code_snapshot?: string | null;
          billing_city_snapshot?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      quote_items: {
        Row: {
          id: string;
          quote_id: string;
          description: string;
          quantity: string;
          unit_price: string;
          line_total: string;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          quote_id: string;
          description: string;
          quantity?: number | string;
          unit_price: number | string;
          line_total: number | string;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          quote_id?: string;
          description?: string;
          quantity?: number | string;
          unit_price?: number | string;
          line_total?: number | string;
          position?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Enums: {
      client_status: ClientStatus;
    };
  };
};
