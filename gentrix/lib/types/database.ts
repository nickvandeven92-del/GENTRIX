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
          /** Token voor concept op `/site/{slug}?token=` (status ≠ active). */
          preview_secret: string | null;
          /** Publiek UUID voor flyer/QR (`/p/{uuid}`). */
          flyer_public_token: string | null;
          /** Flyerstudio: teksten + presets (JSON). */
          flyer_studio_json: Json | null;
          /** Portaal thema-cache (origineel/donker/warm) — lazy gevuld bij eerste restyle. */
          theme_variants: Json | null;
          /** Gezet wanneer commercieel dossier is losgekoppeld; site-tenant blijft bestaan. */
          commercial_unlinked_at: string | null;
          /** Uitgebreide billing-status voor incasso-opvolging. */
          billing_status: string;
          /** Mollie klant-ID: cst_xxx */
          mollie_customer_id: string | null;
          /** Actief Mollie abonnement-ID: sub_xxx */
          mollie_subscription_id: string | null;
          subscription_start_date: string | null;
          /** monthly | quarterly | yearly | one_time */
          billing_interval: string | null;
          prenotification_agreement: string | null;
          failed_collection_count: number;
          last_reminder_sent_at: string | null;
          next_retry_at: string | null;
          manual_payment_link_sent: boolean;
          debt_collection_transferred: boolean;
          billing_exception_granted: boolean;
          service_suspended: boolean;
          service_suspension_reason: string | null;
          domain_paused: boolean;
          email_addon_paused: boolean;
          booking_paused: boolean;
          shop_paused: boolean;
          checkout_consent_text_version: string | null;
          checkout_consent_ip: string | null;
          checkout_confirmation_email_sent: boolean;
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
          flyer_public_token?: string | null;
          flyer_studio_json?: Json | null;
          theme_variants?: Json | null;
          commercial_unlinked_at?: string | null;
          billing_status?: string;
          mollie_customer_id?: string | null;
          mollie_subscription_id?: string | null;
          subscription_start_date?: string | null;
          billing_interval?: string | null;
          prenotification_agreement?: string | null;
          failed_collection_count?: number;
          last_reminder_sent_at?: string | null;
          next_retry_at?: string | null;
          manual_payment_link_sent?: boolean;
          debt_collection_transferred?: boolean;
          billing_exception_granted?: boolean;
          service_suspended?: boolean;
          service_suspension_reason?: string | null;
          domain_paused?: boolean;
          email_addon_paused?: boolean;
          booking_paused?: boolean;
          shop_paused?: boolean;
          checkout_consent_text_version?: string | null;
          checkout_consent_ip?: string | null;
          checkout_confirmation_email_sent?: boolean;
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
          flyer_public_token?: string | null;
          flyer_studio_json?: Json | null;
          theme_variants?: Json | null;
          commercial_unlinked_at?: string | null;
          billing_status?: string;
          mollie_customer_id?: string | null;
          mollie_subscription_id?: string | null;
          subscription_start_date?: string | null;
          billing_interval?: string | null;
          prenotification_agreement?: string | null;
          failed_collection_count?: number;
          last_reminder_sent_at?: string | null;
          next_retry_at?: string | null;
          manual_payment_link_sent?: boolean;
          debt_collection_transferred?: boolean;
          billing_exception_granted?: boolean;
          service_suspended?: boolean;
          service_suspension_reason?: string | null;
          domain_paused?: boolean;
          email_addon_paused?: boolean;
          booking_paused?: boolean;
          shop_paused?: boolean;
          checkout_consent_text_version?: string | null;
          checkout_consent_ip?: string | null;
          checkout_confirmation_email_sent?: boolean;
        };
        Relationships: [];
      };
      flyer_scans: {
        Row: {
          id: string;
          client_id: string;
          scanned_at: string;
          user_agent: string | null;
          referer: string | null;
        };
        Insert: {
          id?: string;
          client_id: string;
          scanned_at?: string;
          user_agent?: string | null;
          referer?: string | null;
        };
        Update: {
          id?: string;
          client_id?: string;
          scanned_at?: string;
          user_agent?: string | null;
          referer?: string | null;
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
      site_generation_jobs: {
        Row: {
          id: string;
          client_id: string | null;
          created_at: string;
          updated_at: string;
          status: string;
          request_json: Json;
          progress_message: string | null;
          result_json: Json | null;
          error_message: string | null;
          started_at: string | null;
          completed_at: string | null;
          pipeline_feedback_json: Json | null;
          denklijn_text: string | null;
          denklijn_skip_reason: string | null;
          design_contract_json: Json | null;
          design_contract_warning: string | null;
        };
        Insert: {
          id?: string;
          client_id?: string | null;
          created_at?: string;
          updated_at?: string;
          status?: string;
          request_json?: Json;
          progress_message?: string | null;
          result_json?: Json | null;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          pipeline_feedback_json?: Json | null;
          denklijn_text?: string | null;
          denklijn_skip_reason?: string | null;
          design_contract_json?: Json | null;
          design_contract_warning?: string | null;
        };
        Update: {
          id?: string;
          client_id?: string | null;
          created_at?: string;
          updated_at?: string;
          status?: string;
          request_json?: Json;
          progress_message?: string | null;
          result_json?: Json | null;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          pipeline_feedback_json?: Json | null;
          denklijn_text?: string | null;
          denklijn_skip_reason?: string | null;
          design_contract_json?: Json | null;
          design_contract_warning?: string | null;
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
      sepa_mandates: {
        Row: {
          id: string;
          client_id: string;
          mollie_mandate_id: string | null;
          mandate_reference: string;
          mandate_date: string;
          iban_last4: string;
          account_holder: string | null;
          bank_name: string | null;
          /** valid | pending | invalid | revoked */
          status: string;
          prenotification_agreement: string | null;
          consent_text_version: string | null;
          consent_at: string | null;
          consent_ip: string | null;
          confirmation_email_sent: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          mollie_mandate_id?: string | null;
          mandate_reference: string;
          mandate_date: string;
          iban_last4: string;
          account_holder?: string | null;
          bank_name?: string | null;
          status?: string;
          prenotification_agreement?: string | null;
          consent_text_version?: string | null;
          consent_at?: string | null;
          consent_ip?: string | null;
          confirmation_email_sent?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          mollie_mandate_id?: string | null;
          mandate_reference?: string;
          mandate_date?: string;
          iban_last4?: string;
          account_holder?: string | null;
          bank_name?: string | null;
          status?: string;
          prenotification_agreement?: string | null;
          consent_text_version?: string | null;
          consent_at?: string | null;
          consent_ip?: string | null;
          confirmation_email_sent?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_attempts: {
        Row: {
          id: string;
          client_id: string;
          attempted_at: string;
          amount: string;
          currency: string;
          period_label: string | null;
          mollie_payment_id: string | null;
          mollie_subscription_id: string | null;
          /** paid | failed | pending | open | chargeback | refunded */
          status: string;
          failure_reason: string | null;
          webhook_received_at: string | null;
          manual_note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          attempted_at?: string;
          amount: number | string;
          currency?: string;
          period_label?: string | null;
          mollie_payment_id?: string | null;
          mollie_subscription_id?: string | null;
          status: string;
          failure_reason?: string | null;
          webhook_received_at?: string | null;
          manual_note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          attempted_at?: string;
          amount?: number | string;
          currency?: string;
          period_label?: string | null;
          mollie_payment_id?: string | null;
          mollie_subscription_id?: string | null;
          status?: string;
          failure_reason?: string | null;
          webhook_received_at?: string | null;
          manual_note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      billing_events: {
        Row: {
          id: string;
          client_id: string;
          /** payment_paid | payment_failed | retry_scheduled | chargeback_received | service_suspended | service_reactivated | manual_payment_received | mandate_created | mandate_revoked | subscription_cancelled | billing_exception_granted */
          event_type: string;
          occurred_at: string;
          /** "system" | "mollie_webhook" | "admin" of admin-UUID */
          actor: string;
          payment_attempt_id: string | null;
          amount: string | null;
          metadata: Json;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          event_type: string;
          occurred_at?: string;
          actor?: string;
          payment_attempt_id?: string | null;
          amount?: number | string | null;
          metadata?: Json;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          event_type?: string;
          occurred_at?: string;
          actor?: string;
          payment_attempt_id?: string | null;
          amount?: number | string | null;
          metadata?: Json;
          note?: string | null;
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
