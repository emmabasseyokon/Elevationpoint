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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          id: string
          user_id: string | null
          user_name: string
          action: string
          entity_type: string
          entity_id: string | null
          entity_label: string | null
          details: Json
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          user_name: string
          action: string
          entity_type: string
          entity_id?: string | null
          entity_label?: string | null
          details?: Json
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          user_name?: string
          action?: string
          entity_type?: string
          entity_id?: string | null
          entity_label?: string | null
          details?: Json
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          id: string
          first_name: string
          last_name: string
          email: string | null
          phone: string
          bank_name: string | null
          bank_account_number: string | null
          bank_account_name: string | null
          commission_type: string
          commission_rate: number
          status: string
          notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          first_name: string
          last_name: string
          email?: string | null
          phone: string
          bank_name?: string | null
          bank_account_number?: string | null
          bank_account_name?: string | null
          commission_type?: string
          commission_rate?: number
          status?: string
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          first_name?: string
          last_name?: string
          email?: string | null
          phone?: string
          bank_name?: string | null
          bank_account_number?: string | null
          bank_account_name?: string | null
          commission_type?: string
          commission_rate?: number
          status?: string
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      buyers: {
        Row: {
          agent_id: string | null
          allocation_status: string
          amount_paid: number
          created_at: string | null
          documents: Json | null
          city: string | null
          email: string | null
          estate_id: string | null
          first_name: string
          gender: string | null
          has_installment_plan: boolean | null
          home_address: string | null
          id: string
          initial_deposit: number | null
          last_name: string
          next_of_kin_address: string | null
          next_of_kin_name: string | null
          next_of_kin_phone: string | null
          next_of_kin_relationship: string | null
          next_payment_date: string | null
          notes: string | null
          number_of_plots: number | null
          payment_proof_url: string | null
          payment_status: string
          phone: string | null
          referral_phone: string | null
          referral_source: string | null
          state: string | null
          plan_duration_months: number | null
          plan_start_date: string | null
          plot_location: string | null
          plot_number: string | null
          plot_size: string | null
          purchase_date: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          allocation_status?: string
          amount_paid?: number
          created_at?: string | null
          documents?: Json | null
          city?: string | null
          email?: string | null
          estate_id?: string | null
          first_name: string
          gender?: string | null
          has_installment_plan?: boolean | null
          home_address?: string | null
          id?: string
          initial_deposit?: number | null
          last_name: string
          next_of_kin_address?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relationship?: string | null
          next_payment_date?: string | null
          notes?: string | null
          number_of_plots?: number | null
          payment_proof_url?: string | null
          payment_status?: string
          phone?: string | null
          referral_phone?: string | null
          referral_source?: string | null
          state?: string | null
          plan_duration_months?: number | null
          plan_start_date?: string | null
          plot_location?: string | null
          plot_number?: string | null
          plot_size?: string | null
          purchase_date?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          allocation_status?: string
          amount_paid?: number
          created_at?: string | null
          documents?: Json | null
          city?: string | null
          email?: string | null
          estate_id?: string | null
          first_name?: string
          gender?: string | null
          has_installment_plan?: boolean | null
          home_address?: string | null
          id?: string
          initial_deposit?: number | null
          last_name?: string
          next_of_kin_address?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relationship?: string | null
          next_payment_date?: string | null
          notes?: string | null
          number_of_plots?: number | null
          payment_proof_url?: string | null
          payment_status?: string
          phone?: string | null
          referral_phone?: string | null
          referral_source?: string | null
          state?: string | null
          plan_duration_months?: number | null
          plan_start_date?: string | null
          plot_location?: string | null
          plot_number?: string | null
          plot_size?: string | null
          purchase_date?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buyers_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyers_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          id: string
          agent_id: string
          buyer_id: string
          commission_amount: number
          amount_paid: number
          status: string
          notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          agent_id: string
          buyer_id: string
          commission_amount?: number
          amount_paid?: number
          status?: string
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          agent_id?: string
          buyer_id?: string
          commission_amount?: number
          amount_paid?: number
          status?: string
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commissions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_payments: {
        Row: {
          id: string
          commission_id: string
          amount: number
          payment_date: string
          payment_method: string
          reference: string | null
          notes: string | null
          recorded_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          commission_id: string
          amount: number
          payment_date: string
          payment_method?: string
          reference?: string | null
          notes?: string | null
          recorded_by?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          commission_id?: string
          amount?: number
          payment_date?: string
          payment_method?: string
          reference?: string | null
          notes?: string | null
          recorded_by?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_payments_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          auto_reminders_enabled: boolean
          created_at: string | null
          created_by: string | null
          email: string | null
          form_enabled: boolean
          id: string
          name: string
          phone: string | null
          reminder_days_before: number
          slug: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          auto_reminders_enabled?: boolean
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          form_enabled?: boolean
          id?: string
          name: string
          phone?: string | null
          reminder_days_before?: number
          slug: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          auto_reminders_enabled?: boolean
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          form_enabled?: boolean
          id?: string
          name?: string
          phone?: string | null
          reminder_days_before?: number
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      estates: {
        Row: {
          available_plots: number
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          location: string | null
          name: string
          plot_sizes: Json | null
          price_per_plot: number | null
          status: string
          total_plots: number
          updated_at: string | null
        }
        Insert: {
          available_plots?: number
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          name: string
          plot_sizes?: Json | null
          price_per_plot?: number | null
          status?: string
          total_plots?: number
          updated_at?: string | null
        }
        Update: {
          available_plots?: number
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          name?: string
          plot_sizes?: Json | null
          price_per_plot?: number | null
          status?: string
          total_plots?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      payment_schedules: {
        Row: {
          id: string
          buyer_id: string
          installment_number: number
          due_date: string
          expected_amount: number
          paid_amount: number
          status: string
          payment_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          buyer_id: string
          installment_number: number
          due_date: string
          expected_amount: number
          paid_amount?: number
          status?: string
          payment_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          buyer_id?: string
          installment_number?: number
          due_date?: string
          expected_amount?: number
          paid_amount?: number
          status?: string
          payment_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_schedules_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_schedules_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          buyer_id: string
          created_at: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          recorded_by: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          buyer_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_date: string
          payment_method?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          buyer_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          role: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id: string
          role: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      reminders: {
        Row: {
          buyer_id: string
          created_at: string | null
          id: string
          message: string
          reminder_type: string
          sent_at: string | null
          sent_by: string | null
          sent_via: string
        }
        Insert: {
          buyer_id: string
          created_at?: string | null
          id?: string
          message: string
          reminder_type?: string
          sent_at?: string | null
          sent_by?: string | null
          sent_via?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string | null
          id?: string
          message?: string
          reminder_type?: string
          sent_at?: string | null
          sent_by?: string | null
          sent_via?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          key: string
          count: number
          reset_at: string
        }
        Insert: {
          key: string
          count: number
          reset_at: string
        }
        Update: {
          key?: string
          count?: number
          reset_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: {
          p_key: string
          p_max: number
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          retry_after_seconds: number
        }[]
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
    Enums: {},
  },
} as const
