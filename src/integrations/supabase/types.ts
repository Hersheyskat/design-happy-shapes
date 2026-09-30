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
          handle: string
          id: string
          style_preferences: string[]
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          bio?: string
          created_at?: string
          display_name: string
          handle: string
          id: string
          style_preferences?: string[]
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          bio?: string
          created_at?: string
          display_name?: string
          handle?: string
          id?: string
          style_preferences?: string[]
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
      [_ in never]: never
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
