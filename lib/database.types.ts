export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      app_settings: {
        Row: {
          description: string | null
          is_secret: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          description?: string | null
          is_secret?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          description?: string | null
          is_secret?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      facebook_policy_checks: {
        Row: {
          adult_sensitive_risk: Database["public"]["Enums"]["risk_level"]
          before_after_risk: Database["public"]["Enums"]["risk_level"]
          confidence: Database["public"]["Enums"]["analysis_confidence"]
          copyright_safety_score: number
          created_at: string
          final_policy_level: Database["public"]["Enums"]["risk_level"]
          health_claim_risk: Database["public"]["Enums"]["risk_level"]
          id: string
          ip_trademark_risk: Database["public"]["Enums"]["risk_level"]
          misleading_claim_risk: Database["public"]["Enums"]["risk_level"]
          model: string | null
          personal_attribute_risk: Database["public"]["Enums"]["risk_level"]
          policy_references: Json
          policy_safety_score: number
          provider: string
          raw_response: Json
          restricted_product_risk: Database["public"]["Enums"]["risk_level"]
          risk_reasons: Json
          shocking_content_risk: Database["public"]["Enums"]["risk_level"]
          suggested_fixes: Json
          video_submission_id: string
        }
        Insert: {
          adult_sensitive_risk?: Database["public"]["Enums"]["risk_level"]
          before_after_risk?: Database["public"]["Enums"]["risk_level"]
          confidence?: Database["public"]["Enums"]["analysis_confidence"]
          copyright_safety_score?: number
          created_at?: string
          final_policy_level?: Database["public"]["Enums"]["risk_level"]
          health_claim_risk?: Database["public"]["Enums"]["risk_level"]
          id?: string
          ip_trademark_risk?: Database["public"]["Enums"]["risk_level"]
          misleading_claim_risk?: Database["public"]["Enums"]["risk_level"]
          model?: string | null
          personal_attribute_risk?: Database["public"]["Enums"]["risk_level"]
          policy_references?: Json
          policy_safety_score?: number
          provider?: string
          raw_response?: Json
          restricted_product_risk?: Database["public"]["Enums"]["risk_level"]
          risk_reasons?: Json
          shocking_content_risk?: Database["public"]["Enums"]["risk_level"]
          suggested_fixes?: Json
          video_submission_id: string
        }
        Update: {
          adult_sensitive_risk?: Database["public"]["Enums"]["risk_level"]
          before_after_risk?: Database["public"]["Enums"]["risk_level"]
          confidence?: Database["public"]["Enums"]["analysis_confidence"]
          copyright_safety_score?: number
          created_at?: string
          final_policy_level?: Database["public"]["Enums"]["risk_level"]
          health_claim_risk?: Database["public"]["Enums"]["risk_level"]
          id?: string
          ip_trademark_risk?: Database["public"]["Enums"]["risk_level"]
          misleading_claim_risk?: Database["public"]["Enums"]["risk_level"]
          model?: string | null
          personal_attribute_risk?: Database["public"]["Enums"]["risk_level"]
          policy_references?: Json
          policy_safety_score?: number
          provider?: string
          raw_response?: Json
          restricted_product_risk?: Database["public"]["Enums"]["risk_level"]
          risk_reasons?: Json
          shocking_content_risk?: Database["public"]["Enums"]["risk_level"]
          suggested_fixes?: Json
          video_submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facebook_policy_checks_video_submission_id_fkey"
            columns: ["video_submission_id"]
            isOneToOne: false
            referencedRelation: "video_submissions"
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
      video_content_analysis: {
        Row: {
          audience_profile: Json
          claims_detected: Json
          confidence: Database["public"]["Enums"]["analysis_confidence"]
          created_at: string
          hook_3s: string | null
          id: string
          key_moments: Json
          model: string | null
          pain_points: Json
          product_detected: string | null
          provider: string
          raw_response: Json
          remake_angles: Json
          strong_scenes: Json
          summary: string | null
          video_submission_id: string
          visual_summary: string | null
          weak_scenes: Json
        }
        Insert: {
          audience_profile?: Json
          claims_detected?: Json
          confidence?: Database["public"]["Enums"]["analysis_confidence"]
          created_at?: string
          hook_3s?: string | null
          id?: string
          key_moments?: Json
          model?: string | null
          pain_points?: Json
          product_detected?: string | null
          provider?: string
          raw_response?: Json
          remake_angles?: Json
          strong_scenes?: Json
          summary?: string | null
          video_submission_id: string
          visual_summary?: string | null
          weak_scenes?: Json
        }
        Update: {
          audience_profile?: Json
          claims_detected?: Json
          confidence?: Database["public"]["Enums"]["analysis_confidence"]
          created_at?: string
          hook_3s?: string | null
          id?: string
          key_moments?: Json
          model?: string | null
          pain_points?: Json
          product_detected?: string | null
          provider?: string
          raw_response?: Json
          remake_angles?: Json
          strong_scenes?: Json
          summary?: string | null
          video_submission_id?: string
          visual_summary?: string | null
          weak_scenes?: Json
        }
        Relationships: [
          {
            foreignKeyName: "video_content_analysis_video_submission_id_fkey"
            columns: ["video_submission_id"]
            isOneToOne: false
            referencedRelation: "video_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_creative_scores: {
        Row: {
          affiliate_fit_score: number
          confidence: Database["public"]["Enums"]["analysis_confidence"]
          created_at: string
          creative_score: number
          demo_score: number
          hook_score: number
          id: string
          model: string | null
          product_clarity_score: number
          provider: string
          raw_response: Json
          reasons: Json
          remake_score: number
          suggested_edits: Json
          suggested_scripts: Json
          suggested_titles: Json
          trust_score: number
          video_submission_id: string
        }
        Insert: {
          affiliate_fit_score?: number
          confidence?: Database["public"]["Enums"]["analysis_confidence"]
          created_at?: string
          creative_score?: number
          demo_score?: number
          hook_score?: number
          id?: string
          model?: string | null
          product_clarity_score?: number
          provider?: string
          raw_response?: Json
          reasons?: Json
          remake_score?: number
          suggested_edits?: Json
          suggested_scripts?: Json
          suggested_titles?: Json
          trust_score?: number
          video_submission_id: string
        }
        Update: {
          affiliate_fit_score?: number
          confidence?: Database["public"]["Enums"]["analysis_confidence"]
          created_at?: string
          creative_score?: number
          demo_score?: number
          hook_score?: number
          id?: string
          model?: string | null
          product_clarity_score?: number
          provider?: string
          raw_response?: Json
          reasons?: Json
          remake_score?: number
          suggested_edits?: Json
          suggested_scripts?: Json
          suggested_titles?: Json
          trust_score?: number
          video_submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_creative_scores_video_submission_id_fkey"
            columns: ["video_submission_id"]
            isOneToOne: false
            referencedRelation: "video_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_extracted_assets: {
        Row: {
          audio_file_url: string | null
          created_at: string
          detected_faces: Json
          detected_logos: Json
          detected_text_claims: Json
          duration_seconds: number | null
          fps: number | null
          frame_urls: Json
          height: number | null
          id: string
          ocr_text: string | null
          raw_metadata: Json
          thumbnail_url: string | null
          transcript_text: string | null
          video_submission_id: string
          width: number | null
        }
        Insert: {
          audio_file_url?: string | null
          created_at?: string
          detected_faces?: Json
          detected_logos?: Json
          detected_text_claims?: Json
          duration_seconds?: number | null
          fps?: number | null
          frame_urls?: Json
          height?: number | null
          id?: string
          ocr_text?: string | null
          raw_metadata?: Json
          thumbnail_url?: string | null
          transcript_text?: string | null
          video_submission_id: string
          width?: number | null
        }
        Update: {
          audio_file_url?: string | null
          created_at?: string
          detected_faces?: Json
          detected_logos?: Json
          detected_text_claims?: Json
          duration_seconds?: number | null
          fps?: number | null
          frame_urls?: Json
          height?: number | null
          id?: string
          ocr_text?: string | null
          raw_metadata?: Json
          thumbnail_url?: string | null
          transcript_text?: string | null
          video_submission_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_extracted_assets_video_submission_id_fkey"
            columns: ["video_submission_id"]
            isOneToOne: false
            referencedRelation: "video_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_final_decisions: {
        Row: {
          blocking_reasons: Json
          copyright_safety_score: number
          created_at: string
          creative_score: number
          decision_reason: string | null
          final_action: Database["public"]["Enums"]["video_final_action"]
          final_score: number
          id: string
          policy_safety_score: number
          required_edits: Json
          video_submission_id: string
        }
        Insert: {
          blocking_reasons?: Json
          copyright_safety_score?: number
          created_at?: string
          creative_score?: number
          decision_reason?: string | null
          final_action: Database["public"]["Enums"]["video_final_action"]
          final_score?: number
          id?: string
          policy_safety_score?: number
          required_edits?: Json
          video_submission_id: string
        }
        Update: {
          blocking_reasons?: Json
          copyright_safety_score?: number
          created_at?: string
          creative_score?: number
          decision_reason?: string | null
          final_action?: Database["public"]["Enums"]["video_final_action"]
          final_score?: number
          id?: string
          policy_safety_score?: number
          required_edits?: Json
          video_submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_final_decisions_video_submission_id_fkey"
            columns: ["video_submission_id"]
            isOneToOne: false
            referencedRelation: "video_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_review_jobs: {
        Row: {
          attempt_count: number
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          locked_at: string | null
          locked_by: string | null
          progress_done: number
          progress_total: number
          raw_params: Json
          stage: Database["public"]["Enums"]["video_review_stage"]
          started_at: string | null
          status: Database["public"]["Enums"]["video_review_job_status"]
          video_submission_id: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          progress_done?: number
          progress_total?: number
          raw_params?: Json
          stage?: Database["public"]["Enums"]["video_review_stage"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["video_review_job_status"]
          video_submission_id: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          progress_done?: number
          progress_total?: number
          raw_params?: Json
          stage?: Database["public"]["Enums"]["video_review_stage"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["video_review_job_status"]
          video_submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_review_jobs_video_submission_id_fkey"
            columns: ["video_submission_id"]
            isOneToOne: false
            referencedRelation: "video_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_review_summary: {
        Row: {
          approved_count: number
          avg_creative_score: number
          avg_policy_safety_score: number
          created_at: string | null
          id: string
          low_performance_count: number
          need_edit_count: number
          processing_count: number
          queued_count: number
          rejected_copyright_count: number
          rejected_policy_count: number
          reviewed_count: number
          total_submissions: number
          updated_at: string
        }
        Insert: {
          approved_count?: number
          avg_creative_score?: number
          avg_policy_safety_score?: number
          created_at?: string | null
          id?: string
          low_performance_count?: number
          need_edit_count?: number
          processing_count?: number
          queued_count?: number
          rejected_copyright_count?: number
          rejected_policy_count?: number
          reviewed_count?: number
          total_submissions?: number
          updated_at?: string
        }
        Update: {
          approved_count?: number
          avg_creative_score?: number
          avg_policy_safety_score?: number
          created_at?: string | null
          id?: string
          low_performance_count?: number
          need_edit_count?: number
          processing_count?: number
          queued_count?: number
          rejected_copyright_count?: number
          rejected_policy_count?: number
          reviewed_count?: number
          total_submissions?: number
          updated_at?: string
        }
        Relationships: []
      }
      video_submissions: {
        Row: {
          admin_note: string | null
          aggregate_note: string | null
          assigned_affiliate_account_id: string | null
          assigned_at: string | null
          assigned_by: string | null
          attachments: Json
          canonical_video_hash: string | null
          canonical_video_url: string | null
          category_id: string | null
          commission_percent: number
          created_at: string
          created_by: string
          drive_file_id: string | null
          drive_file_name: string | null
          drive_folder_id: string | null
          drive_web_url: string | null
          estimated_commission: number | null
          file_sha256: string | null
          id: string
          original_video_url: string | null
          perceptual_hash: string | null
          product_price: number
          shopee_product_url: string
          short_link: string | null
          short_link_at: string | null
          short_link_by: string | null
          source_type: Database["public"]["Enums"]["video_source_type"]
          status: Database["public"]["Enums"]["video_submission_status"]
          staff_note: string | null
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          aggregate_note?: string | null
          assigned_affiliate_account_id?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          attachments?: Json
          canonical_video_hash?: string | null
          canonical_video_url?: string | null
          category_id?: string | null
          commission_percent?: number
          created_at?: string
          created_by: string
          drive_file_id?: string | null
          drive_file_name?: string | null
          drive_folder_id?: string | null
          drive_web_url?: string | null
          file_sha256?: string | null
          id?: string
          original_video_url?: string | null
          perceptual_hash?: string | null
          product_price?: number
          shopee_product_url: string
          short_link?: string | null
          short_link_at?: string | null
          short_link_by?: string | null
          source_type: Database["public"]["Enums"]["video_source_type"]
          status?: Database["public"]["Enums"]["video_submission_status"]
          staff_note?: string | null
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          aggregate_note?: string | null
          assigned_affiliate_account_id?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          attachments?: Json
          canonical_video_hash?: string | null
          canonical_video_url?: string | null
          category_id?: string | null
          commission_percent?: number
          created_at?: string
          created_by?: string
          drive_file_id?: string | null
          drive_file_name?: string | null
          drive_folder_id?: string | null
          drive_web_url?: string | null
          file_sha256?: string | null
          id?: string
          original_video_url?: string | null
          perceptual_hash?: string | null
          product_price?: number
          shopee_product_url?: string
          short_link?: string | null
          short_link_at?: string | null
          short_link_by?: string | null
          source_type?: Database["public"]["Enums"]["video_source_type"]
          status?: Database["public"]["Enums"]["video_submission_status"]
          staff_note?: string | null
          updated_at?: string
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
      claim_video_review_job: {
        Args: { worker_name: string }
        Returns: {
          attempt_count: number
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          locked_at: string | null
          locked_by: string | null
          progress_done: number
          progress_total: number
          raw_params: Json
          stage: Database["public"]["Enums"]["video_review_stage"]
          started_at: string | null
          status: Database["public"]["Enums"]["video_review_job_status"]
          video_submission_id: string
        }
      }
      current_app_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
      refresh_video_review_summary: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      analysis_confidence: "low" | "medium" | "high"
      risk_level: "low" | "medium" | "high" | "critical"
      user_role: "staff" | "accountant" | "aggregator" | "admin"
      video_final_action:
        | "APPROVE_RUN_ADS"
        | "NEED_EDIT"
        | "REMAKE_SAFE"
        | "REJECT_POLICY_RISK"
        | "REJECT_COPYRIGHT_RISK"
        | "LOW_PERFORMANCE"
      video_review_job_status: "queued" | "running" | "done" | "failed" | "cancelled"
      video_review_stage:
        | "queued"
        | "claimed"
        | "ingest"
        | "extract"
        | "analyze"
        | "policy_check"
        | "score"
        | "decision"
        | "done"
        | "failed"
      video_source_type:
        | "tiktok_url"
        | "facebook_url"
        | "youtube_url"
        | "drive_upload"
        | "other_url"
      video_submission_status:
        | "submitted"
        | "queued"
        | "processing"
        | "reviewed"
        | "need_edit"
        | "approved"
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
  : never

export const Constants = {
  public: {
    Enums: {
      analysis_confidence: ["low", "medium", "high"],
      risk_level: ["low", "medium", "high", "critical"],
      user_role: ["staff", "accountant", "aggregator", "admin"],
      video_final_action: [
        "APPROVE_RUN_ADS",
        "NEED_EDIT",
        "REMAKE_SAFE",
        "REJECT_POLICY_RISK",
        "REJECT_COPYRIGHT_RISK",
        "LOW_PERFORMANCE",
      ],
      video_review_job_status: ["queued", "running", "done", "failed", "cancelled"],
      video_review_stage: [
        "queued",
        "claimed",
        "ingest",
        "extract",
        "analyze",
        "policy_check",
        "score",
        "decision",
        "done",
        "failed",
      ],
      video_source_type: [
        "tiktok_url",
        "facebook_url",
        "youtube_url",
        "drive_upload",
        "other_url",
      ],
      video_submission_status: [
        "submitted",
        "queued",
        "processing",
        "reviewed",
        "need_edit",
        "approved",
        "rejected",
        "archived",
      ],
    },
  },
} as const
