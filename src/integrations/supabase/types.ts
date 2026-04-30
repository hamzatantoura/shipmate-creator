export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          changed_by_role: string | null
          changed_by_user_id: string | null
          created_at: string
          id: string
          new_status: string
          note: string | null
          old_status: string | null
          shipment_id: string
        }
        Insert: {
          changed_by_role?: string | null
          changed_by_user_id?: string | null
          created_at?: string
          id?: string
          new_status: string
          note?: string | null
          old_status?: string | null
          shipment_id: string
        }
        Update: {
          changed_by_role?: string | null
          changed_by_user_id?: string | null
          created_at?: string
          id?: string
          new_status?: string
          note?: string | null
          old_status?: string | null
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_branches: {
        Row: {
          address_details: string | null
          courier_id: string
          created_at: string
          district_id: string | null
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          name: string
          phone: string | null
          province_id: string | null
          updated_at: string
        }
        Insert: {
          address_details?: string | null
          courier_id: string
          created_at?: string
          district_id?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          phone?: string | null
          province_id?: string | null
          updated_at?: string
        }
        Update: {
          address_details?: string | null
          courier_id?: string
          created_at?: string
          district_id?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          phone?: string | null
          province_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_branches_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_branches_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_branches_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_branches_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_district_rates: {
        Row: {
          courier_id: string
          created_at: string
          custom_delivery_fee: number
          district_id: string
          estimated_days: string | null
          id: string
          max_weight_kg: number
          min_weight_kg: number
          updated_at: string
        }
        Insert: {
          courier_id: string
          created_at?: string
          custom_delivery_fee?: number
          district_id: string
          estimated_days?: string | null
          id?: string
          max_weight_kg?: number
          min_weight_kg?: number
          updated_at?: string
        }
        Update: {
          courier_id?: string
          created_at?: string
          custom_delivery_fee?: number
          district_id?: string
          estimated_days?: string | null
          id?: string
          max_weight_kg?: number
          min_weight_kg?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_district_rates_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_district_rates_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_district_rates_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_pricing_tiers: {
        Row: {
          base_price: number
          courier_id: string
          created_at: string
          extra_kg_price: number
          id: string
          max_weight: number
          min_weight: number
          updated_at: string
        }
        Insert: {
          base_price?: number
          courier_id: string
          created_at?: string
          extra_kg_price?: number
          id?: string
          max_weight: number
          min_weight?: number
          updated_at?: string
        }
        Update: {
          base_price?: number
          courier_id?: string
          created_at?: string
          extra_kg_price?: number
          id?: string
          max_weight?: number
          min_weight?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_pricing_tiers_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_pricing_tiers_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_settlements: {
        Row: {
          admin_note: string | null
          amount: number
          courier_id: string
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          receipt_url: string | null
          reference: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          courier_id: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          receipt_url?: string | null
          reference?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          courier_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          receipt_url?: string | null
          reference?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      couriers: {
        Row: {
          city: string | null
          cod_fee_type: string
          cod_fee_value: number
          contact_email: string | null
          contact_person: string | null
          created_at: string
          id: string
          integration_type: string
          is_active: boolean
          logo_url: string | null
          name: string
          phone: string | null
          return_fee_percentage: number
          services: string[]
          tax_id: string | null
          user_id: string | null
          vendor_id: string | null
          wallet_balance: number
        }
        Insert: {
          city?: string | null
          cod_fee_type?: string
          cod_fee_value?: number
          contact_email?: string | null
          contact_person?: string | null
          created_at?: string
          id?: string
          integration_type?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          phone?: string | null
          return_fee_percentage?: number
          services?: string[]
          tax_id?: string | null
          user_id?: string | null
          vendor_id?: string | null
          wallet_balance?: number
        }
        Update: {
          city?: string | null
          cod_fee_type?: string
          cod_fee_value?: number
          contact_email?: string | null
          contact_person?: string | null
          created_at?: string
          id?: string
          integration_type?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          phone?: string | null
          return_fee_percentage?: number
          services?: string[]
          tax_id?: string | null
          user_id?: string | null
          vendor_id?: string | null
          wallet_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "couriers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "couriers_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      districts: {
        Row: {
          area: string | null
          area_ar: string | null
          created_at: string
          delivery_fee: number
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          name: string
          parent_id: string | null
          province: string
          province_ar: string
        }
        Insert: {
          area?: string | null
          area_ar?: string | null
          created_at?: string
          delivery_fee?: number
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          parent_id?: string | null
          province: string
          province_ar: string
        }
        Update: {
          area?: string | null
          area_ar?: string | null
          created_at?: string
          delivery_fee?: number
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          parent_id?: string | null
          province?: string
          province_ar?: string
        }
        Relationships: [
          {
            foreignKeyName: "districts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_verification_tokens: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          token: string
          used: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          token?: string
          used?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          token?: string
          used?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      field_audit_logs: {
        Row: {
          changed_by: string | null
          created_at: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          record_id: string
          table_name: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          record_id: string
          table_name: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      merchants: {
        Row: {
          city: string | null
          contact_person: string | null
          created_at: string
          email_confirmed: boolean
          free_shipping_threshold: number
          id: string
          id_back_url: string | null
          id_front_url: string | null
          id_image_url: string | null
          is_active: boolean
          logo_url: string | null
          phone: string | null
          phone_verified: boolean
          platform_fee_rate: number
          province_id: string | null
          shipping_policy: string
          store_name: string
          updated_at: string
          user_id: string
          verification_status: string
          verification_video_url: string | null
          wallet_balance: number
          warehouse_address: string | null
          warehouse_lat: number | null
          warehouse_lng: number | null
          whatsapp_number: string | null
        }
        Insert: {
          city?: string | null
          contact_person?: string | null
          created_at?: string
          email_confirmed?: boolean
          free_shipping_threshold?: number
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          id_image_url?: string | null
          is_active?: boolean
          logo_url?: string | null
          phone?: string | null
          phone_verified?: boolean
          platform_fee_rate?: number
          province_id?: string | null
          shipping_policy?: string
          store_name?: string
          updated_at?: string
          user_id: string
          verification_status?: string
          verification_video_url?: string | null
          wallet_balance?: number
          warehouse_address?: string | null
          warehouse_lat?: number | null
          warehouse_lng?: number | null
          whatsapp_number?: string | null
        }
        Update: {
          city?: string | null
          contact_person?: string | null
          created_at?: string
          email_confirmed?: boolean
          free_shipping_threshold?: number
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          id_image_url?: string | null
          is_active?: boolean
          logo_url?: string | null
          phone?: string | null
          phone_verified?: boolean
          platform_fee_rate?: number
          province_id?: string | null
          shipping_policy?: string
          store_name?: string
          updated_at?: string
          user_id?: string
          verification_status?: string
          verification_video_url?: string | null
          wallet_balance?: number
          warehouse_address?: string | null
          warehouse_lat?: number | null
          warehouse_lng?: number | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchants_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          assigned_branch_id: string | null
          city: string
          courier_id: string | null
          created_at: string
          customer_lat: number | null
          customer_lng: number | null
          deleted_at: string | null
          delivery_fee: number
          detailed_address: string
          district_id: string | null
          final_sale_price: number | null
          id: string
          label_printed_at: string | null
          merchant_id: string
          net_amount: number
          notes: string | null
          phone_number: string
          platform_fee: number
          product_id: string | null
          quantity: number
          receiver_name: string
          return_reason: string | null
          shipment_id: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          assigned_branch_id?: string | null
          city: string
          courier_id?: string | null
          created_at?: string
          customer_lat?: number | null
          customer_lng?: number | null
          deleted_at?: string | null
          delivery_fee?: number
          detailed_address: string
          district_id?: string | null
          final_sale_price?: number | null
          id?: string
          label_printed_at?: string | null
          merchant_id: string
          net_amount?: number
          notes?: string | null
          phone_number: string
          platform_fee?: number
          product_id?: string | null
          quantity?: number
          receiver_name: string
          return_reason?: string | null
          shipment_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          assigned_branch_id?: string | null
          city?: string
          courier_id?: string | null
          created_at?: string
          customer_lat?: number | null
          customer_lng?: number | null
          deleted_at?: string | null
          delivery_fee?: number
          detailed_address?: string
          district_id?: string | null
          final_sale_price?: number | null
          id?: string
          label_printed_at?: string | null
          merchant_id?: string
          net_amount?: number
          notes?: string | null
          phone_number?: string
          platform_fee?: number
          product_id?: string | null
          quantity?: number
          receiver_name?: string
          return_reason?: string | null
          shipment_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          account_details: string
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          merchant_id: string
          method: string
          receipt_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_details?: string
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          merchant_id: string
          method: string
          receipt_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_details?: string
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          merchant_id?: string
          method?: string
          receipt_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          created_at: string
          default_collection_fee_pct: number
          default_platform_margin_flat: number
          default_platform_margin_pct: number
          default_return_fee: number
          id: string
          return_cost_responsibility: Database["public"]["Enums"]["return_responsibility"]
          singleton: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_collection_fee_pct?: number
          default_platform_margin_flat?: number
          default_platform_margin_pct?: number
          default_return_fee?: number
          id?: string
          return_cost_responsibility?: Database["public"]["Enums"]["return_responsibility"]
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_collection_fee_pct?: number
          default_platform_margin_flat?: number
          default_platform_margin_pct?: number
          default_return_fee?: number
          id?: string
          return_cost_responsibility?: Database["public"]["Enums"]["return_responsibility"]
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          product_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          product_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          price_adjustment: number
          product_id: string
          stock: number
          variant_type: string
          variant_value: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          price_adjustment?: number
          product_id: string
          stock?: number
          variant_type: string
          variant_value: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          price_adjustment?: number
          product_id?: string
          stock?: number
          variant_type?: string
          variant_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          height_cm: number | null
          id: string
          image_url: string | null
          is_active: boolean
          length_cm: number | null
          merchant_id: string
          name: string
          price: number
          slug: string | null
          stock: number
          updated_at: string
          weight_kg: number
          width_cm: number | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          length_cm?: number | null
          merchant_id: string
          name: string
          price?: number
          slug?: string | null
          stock?: number
          updated_at?: string
          weight_kg?: number
          width_cm?: number | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          length_cm?: number | null
          merchant_id?: string
          name?: string
          price?: number
          slug?: string | null
          stock?: number
          updated_at?: string
          weight_kg?: number
          width_cm?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          city: string | null
          contact_person: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          store_name: string | null
          store_slug: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          contact_person?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          store_name?: string | null
          store_slug?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          contact_person?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          store_name?: string | null
          store_slug?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      provinces: {
        Row: {
          created_at: string
          id: string
          name: string
          name_ar: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          name_ar: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          name_ar?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          courier_id: string | null
          created_at: string
          id: string
          merchant_id: string
          order_id: string
          product_id: string | null
          rating: number
          reviewer_role: string
        }
        Insert: {
          comment?: string | null
          courier_id?: string | null
          created_at?: string
          id?: string
          merchant_id: string
          order_id: string
          product_id?: string | null
          rating: number
          reviewer_role?: string
        }
        Update: {
          comment?: string | null
          courier_id?: string | null
          created_at?: string
          id?: string
          merchant_id?: string
          order_id?: string
          product_id?: string | null
          rating?: number
          reviewer_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_status: string
          old_status: string | null
          shipment_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: string
          old_status?: string | null
          shipment_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: string
          old_status?: string | null
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_status_history_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          billable_weight: number | null
          carrier_fee: number | null
          city: Database["public"]["Enums"]["shipment_city"]
          cod_amount: number
          collection_fee: number | null
          courier_id: string | null
          created_at: string
          detailed_address: string
          final_weight: number | null
          id: string
          merchant_id: string
          merchant_shipping_fee: number | null
          notes: string | null
          order_id: string | null
          phone_number: string
          platform_margin: number | null
          receiver_name: string
          shipping_fee: number | null
          status: string
          tracking_number: string | null
          updated_at: string
          volumetric_weight: number | null
        }
        Insert: {
          billable_weight?: number | null
          carrier_fee?: number | null
          city: Database["public"]["Enums"]["shipment_city"]
          cod_amount?: number
          collection_fee?: number | null
          courier_id?: string | null
          created_at?: string
          detailed_address: string
          final_weight?: number | null
          id?: string
          merchant_id: string
          merchant_shipping_fee?: number | null
          notes?: string | null
          order_id?: string | null
          phone_number: string
          platform_margin?: number | null
          receiver_name: string
          shipping_fee?: number | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
          volumetric_weight?: number | null
        }
        Update: {
          billable_weight?: number | null
          carrier_fee?: number | null
          city?: Database["public"]["Enums"]["shipment_city"]
          cod_amount?: number
          collection_fee?: number | null
          courier_id?: string | null
          created_at?: string
          detailed_address?: string
          final_weight?: number | null
          id?: string
          merchant_id?: string
          merchant_shipping_fee?: number | null
          notes?: string | null
          order_id?: string | null
          phone_number?: string
          platform_margin?: number | null
          receiver_name?: string
          shipping_fee?: number | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
          volumetric_weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_regions: {
        Row: {
          created_at: string
          id: string
          name: string
          name_ar: string
          province_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          name_ar: string
          province_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          name_ar?: string
          province_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_regions_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      system_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      top_up_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          merchant_id: string
          method: string
          receipt_url: string | null
          reference_number: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          merchant_id: string
          method: string
          receipt_url?: string | null
          reference_number?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          merchant_id?: string
          method?: string
          receipt_url?: string | null
          reference_number?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          merchant_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          merchant_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          merchant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["user_id"]
          },
        ]
      }
      whatsapp_queue: {
        Row: {
          created_at: string
          error: string | null
          id: string
          message: string
          order_id: string | null
          phone_number: string
          sent_at: string | null
          status: Database["public"]["Enums"]["whatsapp_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          message: string
          order_id?: string | null
          phone_number: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["whatsapp_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          message?: string
          order_id?: string | null
          phone_number?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["whatsapp_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_queue_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      couriers_public: {
        Row: {
          city: string | null
          cod_fee_type: string | null
          cod_fee_value: number | null
          created_at: string | null
          id: string | null
          integration_type: string | null
          is_active: boolean | null
          logo_url: string | null
          name: string | null
          return_fee_percentage: number | null
          services: string[] | null
        }
        Insert: {
          city?: string | null
          cod_fee_type?: string | null
          cod_fee_value?: number | null
          created_at?: string | null
          id?: string | null
          integration_type?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string | null
          return_fee_percentage?: number | null
          services?: string[] | null
        }
        Update: {
          city?: string | null
          cod_fee_type?: string | null
          cod_fee_value?: number | null
          created_at?: string | null
          id?: string | null
          integration_type?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string | null
          return_fee_percentage?: number | null
          services?: string[] | null
        }
        Relationships: []
      }
    }
    Functions: {
      approve_top_up: { Args: { p_topup_id: string }; Returns: Json }
      complete_payout: {
        Args: { p_new_status: string; p_payout_id: string }
        Returns: undefined
      }
      create_storefront_order: {
        Args: {
          p_customer_lat?: number
          p_customer_lng?: number
          p_detailed_address: string
          p_district_id: string
          p_merchant_id: string
          p_notes?: string
          p_phone_number: string
          p_product_id: string
          p_quantity: number
          p_receiver_name: string
        }
        Returns: Json
      }
      find_couriers_for_order: {
        Args: {
          customer_lat?: number
          customer_lng?: number
          customer_province_id: string
          merchant_province_id: string
        }
        Returns: {
          courier_id: string
          courier_name: string
          distance_km: number
          logo_url: string
          nearest_branch_address: string
          nearest_branch_id: string
          nearest_branch_lat: number
          nearest_branch_lng: number
          nearest_branch_name: string
          nearest_branch_phone: string
          total_branches_in_destination: number
        }[]
      }
      get_admin_analytics: { Args: never; Returns: Json }
      get_courier_net_owed: { Args: { _courier_id: string }; Returns: number }
      get_current_vendor_courier_profile: {
        Args: never
        Returns: {
          cod_fee_type: string
          cod_fee_value: number
          id: string
          is_active: boolean
          logo_url: string
          name: string
          wallet_balance: number
        }[]
      }
      get_merchant_ledger_balance: {
        Args: { _merchant_id: string }
        Returns: number
      }
      get_nearest_branches: {
        Args: { max_radius_km?: number; target_lat: number; target_lng: number }
        Returns: {
          address_details: string
          courier_id: string
          courier_name: string
          distance_km: number
          district_id: string
          id: string
          lat: number
          lng: number
          name: string
          phone: string
          province_id: string
        }[]
      }
      get_public_merchant_info: {
        Args: { p_merchant_user_id: string }
        Returns: Json
      }
      get_review_context: { Args: { p_order_id: string }; Returns: Json }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_vendor_courier: { Args: { _courier_id: string }; Returns: boolean }
      list_courier_branches_for_order: {
        Args: {
          p_courier_id: string
          p_customer_lat?: number
          p_customer_lng?: number
          p_customer_province_id: string
        }
        Returns: {
          address_details: string
          branch_id: string
          branch_name: string
          distance_km: number
          lat: number
          lng: number
          phone: string
        }[]
      }
      lock_order_after_label_print: {
        Args: { p_order_id: string; p_shipment_id?: string }
        Returns: {
          assigned_branch_id: string | null
          city: string
          courier_id: string | null
          created_at: string
          customer_lat: number | null
          customer_lng: number | null
          deleted_at: string | null
          delivery_fee: number
          detailed_address: string
          district_id: string | null
          final_sale_price: number | null
          id: string
          label_printed_at: string | null
          merchant_id: string
          net_amount: number
          notes: string | null
          phone_number: string
          platform_fee: number
          product_id: string | null
          quantity: number
          receiver_name: string
          return_reason: string | null
          shipment_id: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      lookup_shipment_by_code: {
        Args: { code: string }
        Returns: {
          branch_name: string
          city: Database["public"]["Enums"]["shipment_city"]
          cod_amount: number
          collection_fee: number
          courier_id: string
          courier_name: string
          created_at: string
          detailed_address: string
          id: string
          merchant_id: string
          notes: string
          order_id: string
          phone_number: string
          receiver_name: string
          shipping_fee: number
          status: string
          tracking_number: string
          updated_at: string
        }[]
      }
      map_order_city_to_shipment: {
        Args: { _city: string }
        Returns: Database["public"]["Enums"]["shipment_city"]
      }
      reverse_payout: {
        Args: { p_payout_id: string; p_reason?: string }
        Returns: Json
      }
      review_courier_settlement: {
        Args: {
          p_action: string
          p_admin_note?: string
          p_settlement_id: string
        }
        Returns: Json
      }
      set_district_coords: {
        Args: { p_district_id: string; p_lat: number; p_lng: number }
        Returns: undefined
      }
      submit_order_review: {
        Args: { p_comment?: string; p_order_id: string; p_rating: number }
        Returns: Json
      }
      track_order_by_sila_code: { Args: { p_code: string }; Returns: Json }
      track_shipment_public: {
        Args: { p_tracking_number: string }
        Returns: Json
      }
      transition_shipment_status: {
        Args: {
          p_new_status: string
          p_return_reason?: string
          p_shipment_id: string
        }
        Returns: {
          billable_weight: number | null
          carrier_fee: number | null
          city: Database["public"]["Enums"]["shipment_city"]
          cod_amount: number
          collection_fee: number | null
          courier_id: string | null
          created_at: string
          detailed_address: string
          final_weight: number | null
          id: string
          merchant_id: string
          merchant_shipping_fee: number | null
          notes: string | null
          order_id: string | null
          phone_number: string
          platform_margin: number | null
          receiver_name: string
          shipping_fee: number | null
          status: string
          tracking_number: string | null
          updated_at: string
          volumetric_weight: number | null
        }
        SetofOptions: {
          from: "*"
          to: "shipments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "merchant" | "vendor"
      return_responsibility: "merchant" | "platform" | "carrier"
      shipment_city:
        | "Damascus"
        | "Aleppo"
        | "Homs"
        | "Lattakia"
        | "Hama"
        | "Tartous"
      size_category: "small" | "medium" | "large"
      whatsapp_status: "pending" | "sent" | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "merchant", "vendor"],
      return_responsibility: ["merchant", "platform", "carrier"],
      shipment_city: [
        "Damascus",
        "Aleppo",
        "Homs",
        "Lattakia",
        "Hama",
        "Tartous",
      ],
      size_category: ["small", "medium", "large"],
      whatsapp_status: ["pending", "sent", "failed"],
    },
  },
} as const
