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
      api_connections: {
        Row: {
          api_name: string
          automation_id: string | null
          calls_this_month: number
          client_id: string
          cost_per_call: number
          created_at: string
          endpoint: string | null
          id: string
          monthly_cost: number | null
          status: string
        }
        Insert: {
          api_name: string
          automation_id?: string | null
          calls_this_month?: number
          client_id: string
          cost_per_call?: number
          created_at?: string
          endpoint?: string | null
          id?: string
          monthly_cost?: number | null
          status?: string
        }
        Update: {
          api_name?: string
          automation_id?: string | null
          calls_this_month?: number
          client_id?: string
          cost_per_call?: number
          created_at?: string
          endpoint?: string | null
          id?: string
          monthly_cost?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_connections_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_connections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          agency_email: string | null
          agency_name: string | null
          agency_website: string | null
          hourly_rate_for_savings: number | null
          id: number
          updated_at: string
          webhook_create_portal_user: string | null
          webhook_lead_normalize: string | null
          webhook_notify_credentials: string | null
          webhook_provision_instance: string | null
        }
        Insert: {
          agency_email?: string | null
          agency_name?: string | null
          agency_website?: string | null
          hourly_rate_for_savings?: number | null
          id?: number
          updated_at?: string
          webhook_create_portal_user?: string | null
          webhook_lead_normalize?: string | null
          webhook_notify_credentials?: string | null
          webhook_provision_instance?: string | null
        }
        Update: {
          agency_email?: string | null
          agency_name?: string | null
          agency_website?: string | null
          hourly_rate_for_savings?: number | null
          id?: number
          updated_at?: string
          webhook_create_portal_user?: string | null
          webhook_lead_normalize?: string | null
          webhook_notify_credentials?: string | null
          webhook_provision_instance?: string | null
        }
        Relationships: []
      }
      automations: {
        Row: {
          apis_connected: Json
          automation_id: string
          average_runs_per_month: number | null
          client_id: string
          cost_per_run: number | null
          created_at: string
          description: string | null
          error_message: string | null
          id: string
          last_run_at: string | null
          monthly_cost: number | null
          monthly_time_saved_hours: number | null
          name: string
          status: string
          time_saved_minutes_per_run: number | null
          updated_at: string
          workflow_url: string | null
        }
        Insert: {
          apis_connected?: Json
          automation_id: string
          average_runs_per_month?: number | null
          client_id: string
          cost_per_run?: number | null
          created_at?: string
          description?: string | null
          error_message?: string | null
          id?: string
          last_run_at?: string | null
          monthly_cost?: number | null
          monthly_time_saved_hours?: number | null
          name: string
          status?: string
          time_saved_minutes_per_run?: number | null
          updated_at?: string
          workflow_url?: string | null
        }
        Update: {
          apis_connected?: Json
          automation_id?: string
          average_runs_per_month?: number | null
          client_id?: string
          cost_per_run?: number | null
          created_at?: string
          description?: string | null
          error_message?: string | null
          id?: string
          last_run_at?: string | null
          monthly_cost?: number | null
          monthly_time_saved_hours?: number | null
          name?: string
          status?: string
          time_saved_minutes_per_run?: number | null
          updated_at?: string
          workflow_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          client_id: string
          company_name: string
          contact_name: string
          created_at: string
          credentials_submitted: boolean
          deal_id: string
          email: string
          id: string
          lead_id: string
          monthly_value: number | null
          n8n_instance_name: string | null
          n8n_instance_url: string | null
          n8n_provisioned: boolean
          n8n_provisioned_at: string | null
          onboarding_step: string
          portal_created: boolean
          portal_created_at: string | null
          portal_user_id: string | null
          pricing_tier: string | null
          report_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          company_name: string
          contact_name: string
          created_at?: string
          credentials_submitted?: boolean
          deal_id: string
          email: string
          id?: string
          lead_id: string
          monthly_value?: number | null
          n8n_instance_name?: string | null
          n8n_instance_url?: string | null
          n8n_provisioned?: boolean
          n8n_provisioned_at?: string | null
          onboarding_step?: string
          portal_created?: boolean
          portal_created_at?: string | null
          portal_user_id?: string | null
          pricing_tier?: string | null
          report_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          company_name?: string
          contact_name?: string
          created_at?: string
          credentials_submitted?: boolean
          deal_id?: string
          email?: string
          id?: string
          lead_id?: string
          monthly_value?: number | null
          n8n_instance_name?: string | null
          n8n_instance_url?: string | null
          n8n_provisioned?: boolean
          n8n_provisioned_at?: string | null
          onboarding_step?: string
          portal_created?: boolean
          portal_created_at?: string | null
          portal_user_id?: string | null
          pricing_tier?: string | null
          report_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          body: string | null
          client_id: string | null
          created_at: string
          id: string
          lead_id: string | null
          meeting_attended: boolean | null
          opened_at: string | null
          sent_at: string | null
          sent_by: string | null
          sentiment: string | null
          subject: string | null
          type: string | null
        }
        Insert: {
          body?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          meeting_attended?: boolean | null
          opened_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          sentiment?: string | null
          subject?: string | null
          type?: string | null
        }
        Update: {
          body?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          meeting_attended?: boolean | null
          opened_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          sentiment?: string | null
          subject?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      credentials_vault: {
        Row: {
          client_id: string
          encrypted_payload: string
          encryption_key_ref: string | null
          id: string
          submitted_at: string
          submitted_by: string | null
        }
        Insert: {
          client_id: string
          encrypted_payload: string
          encryption_key_ref?: string | null
          id?: string
          submitted_at?: string
          submitted_by?: string | null
        }
        Update: {
          client_id?: string
          encrypted_payload?: string
          encryption_key_ref?: string | null
          id?: string
          submitted_at?: string
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credentials_vault_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          assigned_to: string | null
          close_probability: number | null
          contract_signed_at: string | null
          contract_status: string
          contract_url: string | null
          created_at: string
          deal_id: string
          deal_value: number | null
          id: string
          lead_id: string
          notes: string | null
          pricing_tier: string | null
          report_id: string | null
          stage: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          close_probability?: number | null
          contract_signed_at?: string | null
          contract_status?: string
          contract_url?: string | null
          created_at?: string
          deal_id: string
          deal_value?: number | null
          id?: string
          lead_id: string
          notes?: string | null
          pricing_tier?: string | null
          report_id?: string | null
          stage?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          close_probability?: number | null
          contract_signed_at?: string | null
          contract_status?: string
          contract_url?: string | null
          created_at?: string
          deal_id?: string
          deal_value?: number | null
          id?: string
          lead_id?: string
          notes?: string | null
          pricing_tier?: string | null
          report_id?: string | null
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          auth_user_id: string | null
          created_at: string
          department: string | null
          email: string
          id: string
          name: string
          permissions: Json
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          department?: string | null
          email: string
          id?: string
          name: string
          permissions?: Json
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          department?: string | null
          email?: string
          id?: string
          name?: string
          permissions?: Json
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_to: string | null
          company_name: string
          contact_name: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string | null
          lead_id: string
          notes: string | null
          phone: string | null
          priority: string | null
          source: string | null
          status: string
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          vertical: string | null
        }
        Insert: {
          assigned_to?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name?: string | null
          lead_id: string
          notes?: string | null
          phone?: string | null
          priority?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          vertical?: string | null
        }
        Update: {
          assigned_to?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string | null
          lead_id?: string
          notes?: string | null
          phone?: string | null
          priority?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          vertical?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions_config: {
        Row: {
          category: string
          description: string | null
          id: string
          key: string
          label: string
        }
        Insert: {
          category: string
          description?: string | null
          id?: string
          key: string
          label: string
        }
        Update: {
          category?: string
          description?: string | null
          id?: string
          key?: string
          label?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          color: string | null
          id: string
          name: string
          order_index: number
          slug: string
        }
        Insert: {
          color?: string | null
          id?: string
          name: string
          order_index: number
          slug: string
        }
        Update: {
          color?: string | null
          id?: string
          name?: string
          order_index?: number
          slug?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          build_approach: string | null
          created_at: string
          current_state_description: string | null
          diagnosis_summary: string | null
          future_state_description: string | null
          hours_saved_estimate: number | null
          id: string
          lead_id: string
          pdf_generated_at: string | null
          pdf_url: string | null
          pricing_tier: string | null
          pricing_value: number | null
          report_id: string
          report_status: string
          sent_at: string | null
          stack_recommendation: Json | null
          updated_at: string
          vertical: string
          viewed_at: string | null
        }
        Insert: {
          build_approach?: string | null
          created_at?: string
          current_state_description?: string | null
          diagnosis_summary?: string | null
          future_state_description?: string | null
          hours_saved_estimate?: number | null
          id?: string
          lead_id: string
          pdf_generated_at?: string | null
          pdf_url?: string | null
          pricing_tier?: string | null
          pricing_value?: number | null
          report_id: string
          report_status?: string
          sent_at?: string | null
          stack_recommendation?: Json | null
          updated_at?: string
          vertical: string
          viewed_at?: string | null
        }
        Update: {
          build_approach?: string | null
          created_at?: string
          current_state_description?: string | null
          diagnosis_summary?: string | null
          future_state_description?: string | null
          hours_saved_estimate?: number | null
          id?: string
          lead_id?: string
          pdf_generated_at?: string | null
          pdf_url?: string | null
          pricing_tier?: string | null
          pricing_value?: number | null
          report_id?: string
          report_status?: string
          sent_at?: string | null
          stack_recommendation?: Json | null
          updated_at?: string
          vertical?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          client_id: string
          created_at: string
          description: string | null
          id: string
          priority: string
          resolved_at: string | null
          status: string
          subject: string
          ticket_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject: string
          ticket_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_employee_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_client_owner: { Args: { _client_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "manager"
        | "employee"
        | "client_owner"
        | "client_viewer"
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
      app_role: [
        "admin",
        "manager",
        "employee",
        "client_owner",
        "client_viewer",
      ],
    },
  },
} as const
