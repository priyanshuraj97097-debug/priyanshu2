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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ai_models: {
        Row: {
          capabilities: Json
          context_window: number | null
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_active: boolean
          is_default: boolean
          provider: string
          slug: string
          sort_order: number
          tier: string
        }
        Insert: {
          capabilities?: Json
          context_window?: number | null
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          provider: string
          slug: string
          sort_order?: number
          tier?: string
        }
        Update: {
          capabilities?: Json
          context_window?: number | null
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          provider?: string
          slug?: string
          sort_order?: number
          tier?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          is_pinned: boolean
          last_message_at: string
          metadata: Json
          model_slug: string
          system_prompt: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          last_message_at?: string
          metadata?: Json
          model_slug?: string
          system_prompt?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          last_message_at?: string
          metadata?: Json
          model_slug?: string
          system_prompt?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      file_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          file_id: string
          id: string
          metadata: Json
          token_count: number | null
          user_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          file_id: string
          id?: string
          metadata?: Json
          token_count?: number | null
          user_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          file_id?: string
          id?: string
          metadata?: Json
          token_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_chunks_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "uploaded_files"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json
          completion_tokens: number | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          model_slug: string | null
          prompt_tokens: number | null
          role: string
          user_id: string
        }
        Insert: {
          attachments?: Json
          completion_tokens?: number | null
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json
          model_slug?: string | null
          prompt_tokens?: number | null
          role: string
          user_id: string
        }
        Update: {
          attachments?: Json
          completion_tokens?: number | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          model_slug?: string | null
          prompt_tokens?: number | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_prompts: {
        Row: {
          body: string
          created_at: string
          id: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string
          id: string
          message_quota: number
          plan: string
          provider: string | null
          provider_customer_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          message_quota?: number
          plan?: string
          provider?: string | null
          provider_customer_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          message_quota?: number
          plan?: string
          provider?: string | null
          provider_customer_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tool_calls: {
        Row: {
          arguments: Json
          conversation_id: string | null
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          message_id: string | null
          result: Json | null
          status: string
          tool_name: string
          user_id: string
        }
        Insert: {
          arguments?: Json
          conversation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          message_id?: string | null
          result?: Json | null
          status?: string
          tool_name: string
          user_id: string
        }
        Update: {
          arguments?: Json
          conversation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          message_id?: string | null
          result?: Json | null
          status?: string
          tool_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_calls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_calls_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      uploaded_files: {
        Row: {
          conversation_id: string | null
          created_at: string
          extracted_text: string | null
          file_name: string
          id: string
          metadata: Json
          mime_type: string | null
          size_bytes: number | null
          status: string
          storage_path: string
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          extracted_text?: string | null
          file_name: string
          id?: string
          metadata?: Json
          mime_type?: string | null
          size_bytes?: number | null
          status?: string
          storage_path: string
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          extracted_text?: string | null
          file_name?: string
          id?: string
          metadata?: Json
          mime_type?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_files_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          completion_tokens: number
          conversation_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          model_slug: string | null
          prompt_tokens: number
          total_tokens: number
          user_id: string
        }
        Insert: {
          completion_tokens?: number
          conversation_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          model_slug?: string | null
          prompt_tokens?: number
          total_tokens?: number
          user_id: string
        }
        Update: {
          completion_tokens?: number
          conversation_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          model_slug?: string | null
          prompt_tokens?: number
          total_tokens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_memory: {
        Row: {
          content: string
          created_at: string
          id: string
          is_active: boolean
          kind: string
          source_conversation_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          source_conversation_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          source_conversation_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_memory_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_model_preferences: {
        Row: {
          created_at: string
          custom_instructions: string | null
          default_model_slug: string
          enabled_tools: Json
          id: string
          temperature: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_instructions?: string | null
          default_model_slug?: string
          enabled_tools?: Json
          id?: string
          temperature?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_instructions?: string | null
          default_model_slug?: string
          enabled_tools?: Json
          id?: string
          temperature?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
