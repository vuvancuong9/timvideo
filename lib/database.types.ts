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
      affiliate_accounts: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          note: string | null
          platform: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          note?: string | null
          platform?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          note?: string | null
          platform?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      sales_records: {
        Row: {
          clicks: number
          commission: number
          created_at: string
          date: string
          employee_id: string
          id: string
          orders: number
          revenue: number
          source: string | null
          video_submission_id: string | null
        }
        Insert: {
          clicks?: number
          commission?: number
          created_at?: string
          date: string
          employee_id: string
          id?: string
          orders?: number
          revenue?: number
          source?: string | null
          video_submission_id?: string | null
        }
        Update: {
          clicks?: number
          commission?: number
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          orders?: number
          revenue?: number
          source?: string | null
          video_submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_records_video_submission_id_fkey"
            columns: ["video_submission_id"]
            isOneToOne: false
            referencedRelation: "video_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_submissions: {
        Row: {
          admin_note: string | null
          aggregate_note: string | null
          assigned_affiliate_account_id: string | null
          assigned_at: string | null
          assigned_by: string | null
          canonical_video_hash: string
          canonical_video_url: string
          category_id: string | null
          commission_percent: number
          created_at: string
          created_by: string
          drive_file_id: string | null
          drive_file_name: string | null
          drive_folder_id: string | null
          drive_web_url: string | null
          estimated_commission: number | null
          id: string
          product_price: number
          shopee_product_url: string
          short_link: string | null
          short_link_at: string | null
          short_link_by: string | null
          staff_note: string | null
          status: Database["public"]["Enums"]["video_status"]
          updated_at: string
          video_source: Database["public"]["Enums"]["video_source"]
          video_url: string
        }
        Insert: {
          admin_note?: string | null
          aggregate_note?: string | null
          assigned_affiliate_account_id?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          canonical_video_hash: string
          canonical_video_url: string
          category_id?: string | null
          commission_percent: number
          created_at?: string
          created_by: string
          drive_file_id?: string | null
          drive_file_name?: string | null
          drive_folder_id?: string | null
          drive_web_url?: string | null
          estimated_commission?: number | null
          id?: string
          product_price: number
          shopee_product_url: string
          short_link?: string | null
          short_link_at?: string | null
          short_link_by?: string | null
          staff_note?: string | null
          status?: Database["public"]["Enums"]["video_status"]
          updated_at?: string
          video_source: Database["public"]["Enums"]["video_source"]
          video_url: string
        }
        Update: {
          admin_note?: string | null
          aggregate_note?: string | null
          assigned_affiliate_account_id?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          canonical_video_hash?: string
          canonical_video_url?: string
          category_id?: string | null
          commission_percent?: number
          created_at?: string
          created_by?: string
          drive_file_id?: string | null
          drive_file_name?: string | null
          drive_folder_id?: string | null
          drive_web_url?: string | null
          estimated_commission?: number | null
          id?: string
          product_price?: number
          shopee_product_url?: string
          short_link?: string | null
          short_link_at?: string | null
          short_link_by?: string | null
          staff_note?: string | null
          status?: Database["public"]["Enums"]["video_status"]
          updated_at?: string
          video_source?: Database["public"]["Enums"]["video_source"]
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_submissions_assigned_affiliate_account_id_fkey"
            columns: ["assigned_affiliate_account_id"]
            isOneToOne: false
            referencedRelation: "affiliate_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_submissions_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_submissions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_submissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_submissions_short_link_by_fkey"
            columns: ["short_link_by"]
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
      current_app_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      user_role: "staff" | "accountant" | "aggregator" | "admin"
      video_source: "facebook" | "tiktok" | "youtube" | "other"
      video_status:
        | "draft"
        | "submitted"
        | "assigned"
        | "short_linked"
        | "rejected"
        | "archived"
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

export const Constants = {
  public: {
    Enums: {
      user_role: ["staff", "accountant", "aggregator", "admin"],
      video_source: ["facebook", "tiktok", "youtube", "other"],
      video_status: [
        "draft",
        "submitted",
        "assigned",
        "short_linked",
        "rejected",
        "archived",
      ],
    },
  },
} as const
