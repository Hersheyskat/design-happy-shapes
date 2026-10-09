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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_sessions: {
        Row: {
          admin_id: string
          created_at: string
          expires_at: string
          token: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          expires_at: string
          token?: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          expires_at?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_sessions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string
          email: string
          id: string
          password_hash: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          password_hash: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          password_hash?: string
        }
        Relationships: []
      }
      ai_generation_cooldowns: {
        Row: {
          client_hash: string
          last_generated_at: string
          updated_at: string
        }
        Insert: {
          client_hash: string
          last_generated_at?: string
          updated_at?: string
        }
        Update: {
          client_hash?: string
          last_generated_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalog_products: {
        Row: {
          audience: string
          availability: string
          batch_id: string
          category: string
          created_at: string
          currency: string
          display_order: number
          id: string
          image_path: string
          is_active: boolean
          price: number
          product_name: string
          product_url: string
          refreshed_at: string
          retailer: string
          source_image_url: string
          updated_at: string
        }
        Insert: {
          audience: string
          availability?: string
          batch_id: string
          category: string
          created_at?: string
          currency?: string
          display_order: number
          id?: string
          image_path: string
          is_active?: boolean
          price: number
          product_name: string
          product_url: string
          refreshed_at?: string
          retailer: string
          source_image_url: string
          updated_at?: string
        }
        Update: {
          audience?: string
          availability?: string
          batch_id?: string
          category?: string
          created_at?: string
          currency?: string
          display_order?: number
          id?: string
          image_path?: string
          is_active?: boolean
          price?: number
          product_name?: string
          product_url?: string
          refreshed_at?: string
          retailer?: string
          source_image_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_reports: {
        Row: {
          comment_id: string | null
          created_at: string
          details: string
          id: string
          look_id: string | null
          profile_id: string | null
          reason: string
          reporter_id: string
          status: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          details?: string
          id?: string
          look_id?: string | null
          profile_id?: string | null
          reason: string
          reporter_id: string
          status?: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          details?: string
          id?: string
          look_id?: string | null
          profile_id?: string | null
          reason?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "look_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reports_look_id_fkey"
            columns: ["look_id"]
            isOneToOne: false
            referencedRelation: "saved_looks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reports_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_look_quotas: {
        Row: {
          created_at: string
          generation_count: number
          ip_hash: string
          last_generated_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          generation_count?: number
          ip_hash: string
          last_generated_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          generation_count?: number
          ip_hash?: string
          last_generated_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      look_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          is_removed: boolean
          look_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_removed?: boolean
          look_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_removed?: boolean
          look_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "look_comments_look_id_fkey"
            columns: ["look_id"]
            isOneToOne: false
            referencedRelation: "saved_looks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "look_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      look_likes: {
        Row: {
          created_at: string
          look_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          look_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          look_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "look_likes_look_id_fkey"
            columns: ["look_id"]
            isOneToOne: false
            referencedRelation: "saved_looks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "look_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          bio: string
          created_at: string
          display_name: string
          first_name: string
          handle: string
          id: string
          style_preferences: string[]
          surname: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          bio?: string
          created_at?: string
          display_name: string
          first_name?: string
          handle: string
          id: string
          style_preferences?: string[]
          surname?: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          bio?: string
          created_at?: string
          display_name?: string
          first_name?: string
          handle?: string
          id?: string
          style_preferences?: string[]
          surname?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_items: {
        Row: {
          created_at: string
          destination_url: string
          display_order: number
          id: string
          label: string
          look_id: string
          search_term: string
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          destination_url: string
          display_order?: number
          id?: string
          label: string
          look_id: string
          search_term: string
          source: string
          user_id: string
        }
        Update: {
          created_at?: string
          destination_url?: string
          display_order?: number
          id?: string
          label?: string
          look_id?: string
          search_term?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_items_look_id_fkey"
            columns: ["look_id"]
            isOneToOne: false
            referencedRelation: "saved_looks"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_looks: {
        Row: {
          adjustments: Json
          catalog_product_id: string | null
          colors: Json
          created_at: string
          headline: string
          id: string
          is_published: boolean
          is_removed: boolean
          mood: string
          product_currency: string | null
          product_image_path: string | null
          product_name: string | null
          product_price: number | null
          product_retailer: string | null
          product_url: string | null
          published_at: string | null
          shopper_image_path: string
          style_note: string
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          adjustments: Json
          catalog_product_id?: string | null
          colors: Json
          created_at?: string
          headline: string
          id?: string
          is_published?: boolean
          is_removed?: boolean
          mood: string
          product_currency?: string | null
          product_image_path?: string | null
          product_name?: string | null
          product_price?: number | null
          product_retailer?: string | null
          product_url?: string | null
          published_at?: string | null
          shopper_image_path: string
          style_note?: string
          summary: string
          updated_at?: string
          user_id: string
        }
        Update: {
          adjustments?: Json
          catalog_product_id?: string | null
          colors?: Json
          created_at?: string
          headline?: string
          id?: string
          is_published?: boolean
          is_removed?: boolean
          mood?: string
          product_currency?: string | null
          product_image_path?: string | null
          product_name?: string | null
          product_price?: number | null
          product_retailer?: string | null
          product_url?: string | null
          published_at?: string | null
          shopper_image_path?: string
          style_note?: string
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_looks_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_looks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shopper_events: {
        Row: {
          actor_type: string
          catalog_product_id: string | null
          channel: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          saved_look_id: string | null
          user_id: string | null
        }
        Insert: {
          actor_type: string
          catalog_product_id?: string | null
          channel?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          saved_look_id?: string | null
          user_id?: string | null
        }
        Update: {
          actor_type?: string
          catalog_product_id?: string | null
          channel?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          saved_look_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopper_events_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopper_events_saved_look_id_fkey"
            columns: ["saved_look_id"]
            isOneToOne: false
            referencedRelation: "saved_looks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_dashboard: { Args: { _token: string }; Returns: Json }
      admin_delete_catalog_product: { Args: { _id: string; _token: string }; Returns: Json }
      admin_get_catalog_product: { Args: { _id: string; _token: string }; Returns: Json }
      admin_list_catalog: {
        Args: {
          _active?: string
          _audience?: string
          _availability?: string
          _dir?: string
          _limit?: number
          _offset?: number
          _retailer?: string
          _search?: string
          _sort?: string
          _token: string
        }
        Returns: Json
      }
      admin_require_email: { Args: { _token: string }; Returns: string }
      admin_upsert_catalog_product: { Args: { _product: Json; _token: string }; Returns: Json }
      admin_list_activity: {
        Args: {
          _actor?: string
          _channel?: string
          _dir?: string
          _kind: string
          _limit?: number
          _offset?: number
          _published?: boolean
          _range?: string
          _search?: string
          _sort?: string
          _token: string
        }
        Returns: Json
      }
      admin_login: {
        Args: { _email: string; _password: string }
        Returns: Json
      }
      admin_logout: { Args: { _token: string }; Returns: undefined }
      admin_session: { Args: { _token: string }; Returns: Json }
      claim_ai_generation_cooldown: {
        Args: { _client_hash: string }
        Returns: boolean
      }
      claim_guest_look_generation: {
        Args: { _ip_hash: string; _max_count?: number }
        Returns: number
      }
      release_guest_look_generation: {
        Args: { _ip_hash: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
