// Gerado por: npm run db:types
// Para atualizar: npm run db:types (requer SUPABASE_PROJECT_ID no .env)
// NÃO editar manualmente — este arquivo é sobrescrito pelo CLI

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          password_hash: string
          name: string
          city: string | null
          timezone: string
          google_refresh_token: string | null
          anthropic_api_key: string | null
          theme: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          password_hash: string
          name: string
          city?: string | null
          timezone?: string
          google_refresh_token?: string | null
          anthropic_api_key?: string | null
          theme?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          password_hash?: string
          name?: string
          city?: string | null
          timezone?: string
          google_refresh_token?: string | null
          anthropic_api_key?: string | null
          theme?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string
          google_task_list_id: string | null
          archived: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color?: string
          google_task_list_id?: string | null
          archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          color?: string
          google_task_list_id?: string | null
          archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      contacts: {
        Row: {
          id: string
          user_id: string
          first_name: string
          last_name: string | null
          company: string | null
          role: string | null
          email: string | null
          phone: string | null
          address: string | null
          birthday: string | null
          tags: string[]
          phase: string | null
          next_contact: string | null
          notes: string
          google_contact_id: string | null
          synced: boolean
          archived: boolean
          archived_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          first_name: string
          last_name?: string | null
          company?: string | null
          role?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          birthday?: string | null
          tags?: string[]
          phase?: string | null
          next_contact?: string | null
          notes?: string
          google_contact_id?: string | null
          synced?: boolean
          archived?: boolean
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          first_name?: string
          last_name?: string | null
          company?: string | null
          role?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          birthday?: string | null
          tags?: string[]
          phase?: string | null
          next_contact?: string | null
          notes?: string
          google_contact_id?: string | null
          synced?: boolean
          archived?: boolean
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      tasks: {
        Row: {
          id: string
          user_id: string
          project_id: string
          contact_id: string | null
          title: string
          notes: string
          status: string
          priority: string
          tags: string[]
          due_date: string | null
          start_offset: number | null
          duration: number | null
          depends_on: string[]
          archived: boolean
          archived_at: string | null
          google_tasks_id: string | null
          synced: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id: string
          contact_id?: string | null
          title: string
          notes?: string
          status?: string
          priority?: string
          tags?: string[]
          due_date?: string | null
          start_offset?: number | null
          duration?: number | null
          depends_on?: string[]
          archived?: boolean
          archived_at?: string | null
          google_tasks_id?: string | null
          synced?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string
          contact_id?: string | null
          title?: string
          notes?: string
          status?: string
          priority?: string
          tags?: string[]
          due_date?: string | null
          start_offset?: number | null
          duration?: number | null
          depends_on?: string[]
          archived?: boolean
          archived_at?: string | null
          google_tasks_id?: string | null
          synced?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          }
        ]
      }
      task_logs: {
        Row: {
          id: string
          task_id: string
          changes: Json
          timestamp: string
        }
        Insert: {
          id?: string
          task_id: string
          changes: Json
          timestamp?: string
        }
        Update: {
          id?: string
          task_id?: string
          changes?: Json
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          }
        ]
      }
      interactions: {
        Row: {
          id: string
          contact_id: string
          date: string
          type: string
          note: string
          created_at: string
        }
        Insert: {
          id?: string
          contact_id: string
          date: string
          type: string
          note?: string
          created_at?: string
        }
        Update: {
          id?: string
          contact_id?: string
          date?: string
          type?: string
          note?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          }
        ]
      }
      relationships: {
        Row: {
          id: string
          contact_id: string
          related_id: string
          label: string
          created_at: string
        }
        Insert: {
          id?: string
          contact_id: string
          related_id: string
          label: string
          created_at?: string
        }
        Update: {
          id?: string
          contact_id?: string
          related_id?: string
          label?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationships_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationships_related_id_fkey"
            columns: ["related_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          }
        ]
      }
      contact_logs: {
        Row: {
          id: string
          contact_id: string
          changes: Json
          timestamp: string
        }
        Insert: {
          id?: string
          contact_id: string
          changes: Json
          timestamp?: string
        }
        Update: {
          id?: string
          contact_id?: string
          changes?: Json
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          }
        ]
      }
      sources: {
        Row: {
          id: string
          user_id: string
          name: string
          url: string
          active: boolean
          last_fetch: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          url: string
          active?: boolean
          last_fetch?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          url?: string
          active?: boolean
          last_fetch?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sources_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      newsletters: {
        Row: {
          id: string
          user_id: string
          name: string
          sender_email: string
          active: boolean
          last_fetch: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          sender_email: string
          active?: boolean
          last_fetch?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          sender_email?: string
          active?: boolean
          last_fetch?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      briefings: {
        Row: {
          id: string
          user_id: string
          date: string
          highlight: string
          content: Json
          email_sent: boolean
          email_sent_at: string | null
          model: string
          token_count: number | null
          cost: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          highlight: string
          content: Json
          email_sent?: boolean
          email_sent_at?: string | null
          model?: string
          token_count?: number | null
          cost?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          highlight?: string
          content?: Json
          email_sent?: boolean
          email_sent_at?: string | null
          model?: string
          token_count?: number | null
          cost?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      calendars: {
        Row: {
          id: string
          user_id: string
          google_calendar_id: string
          summary: string
          description: string | null
          google_color_id: string | null
          custom_color: string | null
          is_primary: boolean
          is_visible: boolean
          is_default_for_create: boolean
          access_role: string | null
          sync_token: string | null
          last_sync_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          google_calendar_id: string
          summary: string
          description?: string | null
          google_color_id?: string | null
          custom_color?: string | null
          is_primary?: boolean
          is_visible?: boolean
          is_default_for_create?: boolean
          access_role?: string | null
          sync_token?: string | null
          last_sync_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          google_calendar_id?: string
          summary?: string
          description?: string | null
          google_color_id?: string | null
          custom_color?: string | null
          is_primary?: boolean
          is_visible?: boolean
          is_default_for_create?: boolean
          access_role?: string | null
          sync_token?: string | null
          last_sync_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendars_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      calendar_events: {
        Row: {
          id: string
          user_id: string
          calendar_id: string
          google_event_id: string | null
          ical_uid: string | null
          summary: string
          description: string | null
          location: string | null
          start_at: string
          end_at: string
          all_day: boolean
          timezone: string | null
          status: string
          recurrence: string[] | null
          recurring_event_id: string | null
          attendees: Json | null
          organizer_email: string | null
          is_organizer: boolean
          source: string
          task_id: string | null
          synced: boolean
          etag: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          calendar_id: string
          google_event_id?: string | null
          ical_uid?: string | null
          summary: string
          description?: string | null
          location?: string | null
          start_at: string
          end_at: string
          all_day?: boolean
          timezone?: string | null
          status?: string
          recurrence?: string[] | null
          recurring_event_id?: string | null
          attendees?: Json | null
          organizer_email?: string | null
          is_organizer?: boolean
          source?: string
          task_id?: string | null
          synced?: boolean
          etag?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          calendar_id?: string
          google_event_id?: string | null
          ical_uid?: string | null
          summary?: string
          description?: string | null
          location?: string | null
          start_at?: string
          end_at?: string
          all_day?: boolean
          timezone?: string | null
          status?: string
          recurrence?: string[] | null
          recurring_event_id?: string | null
          attendees?: Json | null
          organizer_email?: string | null
          is_organizer?: boolean
          source?: string
          task_id?: string | null
          synced?: boolean
          etag?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          }
        ]
      }
      event_logs: {
        Row: {
          id: string
          event_id: string | null
          user_id: string
          action: string
          changes: Json | null
          source: string
          timestamp: string
        }
        Insert: {
          id?: string
          event_id?: string | null
          user_id: string
          action: string
          changes?: Json | null
          source: string
          timestamp?: string
        }
        Update: {
          id?: string
          event_id?: string | null
          user_id?: string
          action?: string
          changes?: Json | null
          source?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
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
