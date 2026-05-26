// Gerado/mantido manualmente após migrations 0001-0011.
// Para regenerar via CLI: ajustar `db:types` no package.json com SUPABASE_PROJECT_ID
// e rodar `npm run db:types` — o resultado deve ser equivalente.
//
// Inserts ficam fora do tipo Database para evitar ciclos de inferência
// quando supabase-js resolve overload de `.from(...).insert(...)`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// AQAL/GTD types (do enum SQL)
export type Quadrant = 'I' | 'IT' | 'WE' | 'ITS'
export type HorizonLvl = 'H0' | 'H1' | 'H2' | 'H3' | 'H4' | 'H5'
export type TaskContext = 'deep' | 'shallow' | 'social' | 'criativo' | 'somatico' | 'offline'
export type ProjectKind = 'outcome' | 'evergreen'
export type ProjectStatusAqal = 'active' | 'on_hold' | 'someday' | 'done' | 'archived'
export type HabitDose = 'full' | 'min' | 'skip'
export type CoachKind = 'briefing' | 'check_in' | 'callout' | 'celebration' | 'chat' | 'review'
export type MemoryKind = 'fact' | 'pattern' | 'promise' | 'concern' | 'preference'
export type CaptureSrc = 'manual' | 'voice' | 'email' | 'briefing' | 'coach' | 'google'

// Módulo Hill (0019)
export type HillGoalLevel = 'dream' | 'goal' | 'quarterly'
export type HillGoalStatus = 'active' | 'completed' | 'archived' | 'failed'
export type HillAffirmationDimension = 'identidade' | 'acao' | 'capacidade' | 'relacoes' | 'integracao'
export type HillAffirmationStatus = 'active' | 'retired' | 'superseded'
export type HillRitualType = 'morning' | 'night'
export type HillCoachMode = 'chat' | 'ritual_murmur' | 'wizard_step' | 'daily_nudge'
export type HillMessageRole = 'user' | 'coach'
export type HillCoachVoice = 'strict' | 'mixed' | 'gentle'

// Tasks: status é text com check constraint que aceita valores legados e novos.
export type TaskStatus =
  | 'inbox' | 'next' | 'doing' | 'blocked' | 'done'    // legado
  | 'waiting' | 'scheduled' | 'someday' | 'cancelled'  // novos AQAL/GTD

// -------------------------------------------------------------
// Insert types — fora do tipo Database (quebra recursão)
// -------------------------------------------------------------
type UsersInsert = {
  id?: string; email: string; password_hash: string; name: string
  city?: string | null; timezone?: string; google_refresh_token?: string | null
  anthropic_api_key?: string | null; theme?: string
  coach_last_read_at?: string | null
  created_at?: string; updated_at?: string
}

type ProjectsInsert = {
  id?: string; user_id: string; name: string; color?: string
  google_task_list_id?: string | null; archived?: boolean
  // AQAL
  area_id?: string | null; parent_id?: string | null; title?: string
  outcome?: string | null; kind?: ProjectKind; status_aqal?: ProjectStatusAqal
  quadrant_override?: Quadrant | null; horizon?: HorizonLvl
  target_date?: string | null; metadata?: Json; position?: number
  completed_at?: string | null; archived_at?: string | null
  created_at?: string; updated_at?: string
}

type ContactFamilyJson = { spouse?: string; children?: string[]; pets?: string[] }
type ContactSignalJson = { type?: string; text?: string; url?: string; date?: string }

type ContactsInsert = {
  id?: string; user_id: string; first_name: string
  last_name?: string | null; company?: string | null; role?: string | null
  email?: string | null; phone?: string | null; address?: string | null
  birthday?: string | null; tags?: string[]; phase?: string | null
  next_contact?: string | null; notes?: string
  google_contact_id?: string | null; synced?: boolean
  archived?: boolean; archived_at?: string | null
  created_at?: string; updated_at?: string
  // Carnegie (0014)
  tier?: 'inner' | 'strong' | 'network' | 'weak' | 'dormant' | null
  cadence_days?: number | null; last_interaction_at?: string | null
  preferred_name?: string | null; pronunciation?: string | null
  interests?: string[] | null; conversation_hooks?: string[] | null
  what_they_value?: string | null; their_goals?: string | null
  family?: ContactFamilyJson | null
  first_met_at?: string | null; company_start_date?: string | null
  preferred_channel?: 'whatsapp' | 'email' | 'linkedin' | 'sms' | 'phone' | null
  favor_balance?: number | null
  linkedin_url?: string | null; twitter_handle?: string | null; instagram_handle?: string | null
  last_signal?: ContactSignalJson | null; last_signal_at?: string | null
  source_contact_id?: string | null; source_context?: string | null
}

type TasksInsert = {
  id?: string; user_id: string; project_id: string
  contact_id?: string | null; title: string; notes?: string
  status?: TaskStatus; priority?: string; tags?: string[]
  due_date?: string | null; start_offset?: number | null
  duration?: number | null; depends_on?: string[]
  archived?: boolean; archived_at?: string | null
  google_tasks_id?: string | null; synced?: boolean
  // AQAL
  area_id?: string | null; parent_task_id?: string | null
  quadrant_override?: Quadrant | null; context?: TaskContext | null
  energy?: number | null; time_estimate_min?: number | null
  waiting_for?: string | null; due_at?: string | null
  scheduled_at?: string | null; completed_at?: string | null
  rrule?: string | null; rrule_parent_id?: string | null
  source?: CaptureSrc; external_id?: string | null
  position?: number; ai_classified?: boolean
  created_at?: string; updated_at?: string
}

type TaskLogsInsert = { id?: string; task_id: string; changes: Json; timestamp?: string }
type InteractionsInsert = {
  id?: string; contact_id: string; date: string; type: string; note?: string; created_at?: string
  // Carnegie (0014)
  initiator?: 'me' | 'them' | null
  sentiment?: 'positive' | 'neutral' | 'tense' | null
  topics_discussed?: string[] | null
  carnegie_tags?: string[] | null
  interaction_tags?: string[] | null
  compliment_text?: string | null
  referral_from_id?: string | null
  new_learning?: string | null
  promise_made?: string | null
}

type SpecialDatesInsert = {
  id?: string; user_id: string; contact_id: string
  label: string
  type: 'celebrate' | 'acknowledge' | 'silence' | 'check_in'
  date_anniversary?: string | null; date_full?: string | null
  recurring?: boolean
  lead_days?: number | null; silence_days?: number | null
  private_note?: string | null
  source?: 'manual' | 'derived_first_met' | 'derived_company_start' | 'derived_birthday'
  created_at?: string; updated_at?: string
}

type ReferralsInsert = {
  id?: string; user_id: string
  from_contact_id: string; to_contact_id?: string | null
  context: string; outcome_note?: string | null
  feedback_given?: boolean; feedback_given_at?: string | null
  status?: 'open' | 'closed' | 'dropped'
  created_at?: string; updated_at?: string
}

type ComplimentsReceivedInsert = {
  id?: string; user_id: string; contact_id: string
  text: string; received_at?: string; context?: string | null
  remind_to_reciprocate_at?: string | null
  reciprocated?: boolean; reciprocated_at?: string | null; reciprocation_note?: string | null
  created_at?: string
}

// Carnegie rituals (0015)
type PrincipleOfMonthInsert = {
  id?: string; user_id: string
  principle: string; month: string
  target_applications?: number
  reflection?: string | null
  created_at?: string; updated_at?: string
}

type WeeklyReflectionsInsert = {
  id?: string; user_id: string; week: string
  marked_me_contact_id?: string | null; marked_me_why?: string | null
  let_down_contact_id?: string | null; let_down_why?: string | null
  reconnect_contact_id?: string | null; reconnect_handled?: boolean
  created_at?: string
}

type GratitudeEntriesInsert = {
  id?: string; user_id: string; contact_id?: string | null
  text: string
  shared?: boolean; shared_at?: string | null
  shared_channel?: 'whatsapp' | 'email' | 'linkedin' | 'sms' | 'phone' | null
  created_at?: string
}

// PR8 categories (0016)
type CategoryColorDb = 'gray' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'purple' | 'pink' | 'accent'

type CategoryDimensionsInsert = {
  id?: string; user_id: string
  label: string; slug: string
  description?: string | null
  sort_order?: number
  archived?: boolean
  created_at?: string; updated_at?: string
}

type CategoriesInsert = {
  id?: string; user_id: string; dimension_id: string
  label: string; slug: string
  color?: CategoryColorDb | null
  description?: string | null
  sort_order?: number
  archived?: boolean
  usage_count?: number
  created_at?: string; updated_at?: string
}

type ContactCategoriesInsert = {
  id?: string; user_id: string; contact_id: string; category_id: string
  created_at?: string
}
type RelationshipsInsert = { id?: string; contact_id: string; related_id: string; label: string; created_at?: string }
type ContactLogsInsert = { id?: string; contact_id: string; changes: Json; timestamp?: string }
type SourcesInsert = { id?: string; user_id: string; name: string; url: string; active?: boolean; last_fetch?: string | null; created_at?: string }
type NewslettersInsert = { id?: string; user_id: string; name: string; sender_email: string; active?: boolean; last_fetch?: string | null; created_at?: string }

type BriefingsInsert = {
  id?: string; user_id: string; date: string; highlight: string
  content: Json; email_sent?: boolean; email_sent_at?: string | null
  model?: string; token_count?: number | null; cost?: number | null
  created_at?: string
  // AQAL
  briefed_for?: string | null; content_md?: string | null
  context_snapshot?: Json | null; external_tasks_count?: number
  model_used?: string | null; delivered_at?: string | null; opened_at?: string | null
  // Coach (0013)
  coach_paragraph?: string | null
}

type CalendarsInsert = {
  id?: string; user_id: string; google_calendar_id: string; summary: string
  description?: string | null; google_color_id?: string | null; custom_color?: string | null
  is_primary?: boolean; is_visible?: boolean; is_default_for_create?: boolean
  access_role?: string | null; sync_token?: string | null; last_sync_at?: string | null
  created_at?: string; updated_at?: string
}

type CalendarEventsInsert = {
  id?: string; user_id: string; calendar_id: string
  google_event_id?: string | null; ical_uid?: string | null
  summary: string; description?: string | null; location?: string | null
  start_at: string; end_at: string; all_day?: boolean
  timezone?: string | null; status?: string; recurrence?: string[] | null
  recurring_event_id?: string | null; attendees?: Json | null
  organizer_email?: string | null; is_organizer?: boolean
  source?: string; task_id?: string | null; synced?: boolean
  etag?: string | null; created_at?: string; updated_at?: string
}

type EventLogsInsert = {
  id?: string; event_id?: string | null; user_id: string
  action: string; changes?: Json | null; source: string; timestamp?: string
}

// Notes module (0008)
type NoteFoldersInsert = { id?: string; user_id: string; parent_id?: string | null; name: string; created_at?: string; updated_at?: string }
type NoteTagsInsert = { id?: string; user_id: string; name: string; color?: string; created_at?: string }
type NotesInsert = {
  id?: string; user_id: string; folder_id?: string | null
  type: 'postit' | 'text' | 'audio' | 'link'
  title?: string | null; content?: string; url?: string | null
  thumbnail_url?: string | null; audio_duration?: number | null
  pinned?: boolean; archived?: boolean; created_at?: string; updated_at?: string
}
type NoteTagMapInsert = { note_id: string; tag_id: string }

// News module (0009)
type NewsItemsInsert = {
  id?: string; user_id: string; source_id?: string | null
  title: string; url: string; summary?: string | null
  content?: string | null; author?: string | null; image_url?: string | null
  published_at: string; favorited?: boolean; read?: boolean; created_at?: string
}

// AQAL module (0010)
type AreasInsert = {
  id?: string; user_id: string; parent_id?: string | null
  name: string; slug: string; quadrant: Quadrant
  vision_h4?: string | null; color?: string | null; icon?: string | null
  position?: number; archived_at?: string | null
  created_at?: string; updated_at?: string
}

type TagsInsert = {
  id?: string; user_id: string; parent_id?: string | null
  name: string; slug: string; color?: string | null; icon?: string | null
  metadata?: Json; created_at?: string
}

type HabitsInsert = {
  id?: string; user_id: string; area_id?: string | null
  identity: string; title: string; action: string; min_dose: string
  cue?: string | null; reward?: string | null; quadrant: Quadrant
  cadence: Json; schedule_time?: string | null
  stack_after_habit_id?: string | null; active?: boolean
  archived_at?: string | null; created_at?: string; updated_at?: string
}

type HabitLogsInsert = {
  id?: string; habit_id: string; user_id: string
  done_on: string; done_at?: string; dose: HabitDose; note?: string | null
}

type RitualsInsert = {
  id?: string; user_id: string; name: string
  trigger_time?: string | null; description?: string | null
  active?: boolean; created_at?: string; updated_at?: string
}

type RitualStepsInsert = {
  id?: string; ritual_id: string; position: number
  habit_id?: string | null; custom_step?: string | null; estimated_min?: number | null
}

type InboxItemsInsert = {
  id?: string; user_id: string; raw_text: string; source: CaptureSrc
  external_ref?: string | null; ai_suggestion?: Json | null
  processed?: boolean; processed_to_task?: string | null
  processed_to_project?: string | null
  created_at?: string; processed_at?: string | null
}

type ExternalTasksInsert = {
  id?: string; user_id: string; provider?: string
  external_list_id: string; external_list_name?: string | null
  external_id: string; title: string; notes?: string | null
  status: string; due_at?: string | null; completed_at?: string | null
  last_synced_at?: string
}

type IntegrationsInsert = {
  id?: string; user_id: string; provider: string
  account_email?: string | null; scopes?: string[]
  access_token_secret_id?: string | null; refresh_token_secret_id?: string | null
  expires_at?: string | null; status?: string; last_synced_at?: string | null
  metadata?: Json; created_at?: string; updated_at?: string
}

// Coach module (0010-0013)
type CoachProfileInsert = {
  user_id: string; name?: string; tone?: string
  voice_examples?: string | null; values_md?: Json; boundaries?: string | null
  check_in_schedule?: Json; system_prompt_override?: string | null
  north_star_md?: string | null; h3_goals?: Json; updated_at?: string
}

type CoachMemoryInsert = {
  id?: string; user_id: string; kind: MemoryKind; content: string
  source?: string | null; related_area_id?: string | null
  related_project_id?: string | null; related_task_id?: string | null
  relevance?: number; expires_at?: string | null
  last_referenced_at?: string | null; created_at?: string
}

type CoachLogInsert = {
  id?: string; user_id: string; kind: CoachKind
  direction: 'coach_to_user' | 'user_to_coach'
  content_md: string; context_snapshot?: Json | null; resulted_in?: Json | null
  model_used?: string | null; tokens_in?: number | null
  tokens_out?: number | null; created_at?: string
  conversation_id?: string | null
}

type CoachMemoryCandidateInsert = {
  id?: string; user_id: string; source_log_id?: string | null
  kind: MemoryKind; content: string; relevance?: number
  expires_at?: string | null
  status?: 'pending' | 'accepted' | 'dismissed'
  created_at?: string; decided_at?: string | null
}

type ReviewsInsert = {
  id?: string; user_id: string; week_start: string
  quadrant_distribution: Json; habit_completion: Json; metrics: Json
  alerts?: Json; insights_md?: string | null; model_used?: string | null
  created_at?: string
}

// Módulo Hill (0019)
type HillChiefAimsInsert = {
  id?: string; user_id: string
  aim_text: string; deadline: string; exchange_text: string
  plan_text?: string | null; is_active?: boolean; archived_at?: string | null
  next_review?: string; created_at?: string; updated_at?: string
}

type HillGoalsInsert = {
  id?: string; user_id: string
  chief_aim_id?: string | null; parent_id?: string | null
  level: HillGoalLevel; title: string
  metric_text?: string | null; metric_value?: number | null; metric_unit?: string | null
  progress_pct?: number; deadline?: string | null
  status?: HillGoalStatus; linked_project_id?: string | null
  completed_at?: string | null; created_at?: string; updated_at?: string
}

type HillAffirmationsInsert = {
  id?: string; user_id: string; chief_aim_id: string
  dimension: HillAffirmationDimension; text: string
  belief_score: number; derived_from?: Json | null
  status?: HillAffirmationStatus; superseded_by?: string | null
  retired_reason?: string | null
  active_from?: string; active_until?: string | null
  created_at?: string; updated_at?: string
}

type HillRitualLogsInsert = {
  id?: string; user_id: string; type: HillRitualType
  started_at?: string; completed_at?: string | null; duration_seconds?: number | null
  steps_completed?: Json; affirmations_read?: string[]; affirmations_skipped?: string[]
  reflection_data?: Json | null; gratitude_items?: string[] | null
  daily_action_task_id?: string | null; created_at?: string
}

type HillCoachMessagesInsert = {
  id?: string; user_id: string; conversation_id: string
  mode: HillCoachMode; role: HillMessageRole; content: string
  context_used?: Json | null; tokens_in?: number | null; tokens_out?: number | null
  model?: string | null; cost?: number | null
  action_payload?: Json | null; user_action_taken?: boolean | null
  created_at?: string
}

type HillPreferencesInsert = {
  user_id: string; coach_voice?: HillCoachVoice
  daily_nudge_enabled?: boolean; ritual_murmurs_enabled?: boolean
  created_at?: string; updated_at?: string
}

// -------------------------------------------------------------
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string; email: string; password_hash: string; name: string
          city: string | null; timezone: string
          google_refresh_token: string | null; anthropic_api_key: string | null
          theme: string; coach_last_read_at: string | null
          created_at: string; updated_at: string
        }
        Insert: UsersInsert
        Update: Partial<UsersInsert>
        Relationships: []
      }
      projects: {
        Row: {
          id: string; user_id: string; name: string; color: string
          google_task_list_id: string | null; archived: boolean
          created_at: string; updated_at: string
          // AQAL
          area_id: string | null; parent_id: string | null; title: string | null
          outcome: string | null; kind: ProjectKind; status_aqal: ProjectStatusAqal
          quadrant_override: Quadrant | null; horizon: HorizonLvl
          target_date: string | null; metadata: Json; position: number
          completed_at: string | null; archived_at: string | null
        }
        Insert: ProjectsInsert
        Update: Partial<ProjectsInsert>
        Relationships: []
      }
      contacts: {
        Row: {
          id: string; user_id: string; first_name: string
          last_name: string | null; company: string | null; role: string | null
          email: string | null; phone: string | null; address: string | null
          birthday: string | null; tags: string[]; phase: string | null
          next_contact: string | null; notes: string
          google_contact_id: string | null; synced: boolean
          archived: boolean; archived_at: string | null
          created_at: string; updated_at: string
          // Carnegie (0014)
          tier: string | null; cadence_days: number | null
          last_interaction_at: string | null
          preferred_name: string | null; pronunciation: string | null
          interests: string[] | null; conversation_hooks: string[] | null
          what_they_value: string | null; their_goals: string | null
          family: ContactFamilyJson | null
          first_met_at: string | null; company_start_date: string | null
          preferred_channel: string | null; favor_balance: number | null
          linkedin_url: string | null; twitter_handle: string | null; instagram_handle: string | null
          last_signal: ContactSignalJson | null; last_signal_at: string | null
          source_contact_id: string | null; source_context: string | null
        }
        Insert: ContactsInsert
        Update: Partial<ContactsInsert>
        Relationships: []
      }
      tasks: {
        Row: {
          id: string; user_id: string; project_id: string
          contact_id: string | null; title: string; notes: string
          status: TaskStatus; priority: string; tags: string[]
          due_date: string | null; start_offset: number | null
          duration: number | null; depends_on: string[]
          archived: boolean; archived_at: string | null
          google_tasks_id: string | null; synced: boolean
          created_at: string; updated_at: string
          // AQAL
          area_id: string | null; parent_task_id: string | null
          quadrant_override: Quadrant | null; context: TaskContext | null
          energy: number | null; time_estimate_min: number | null
          waiting_for: string | null; due_at: string | null
          scheduled_at: string | null; completed_at: string | null
          rrule: string | null; rrule_parent_id: string | null
          source: CaptureSrc; external_id: string | null
          position: number; ai_classified: boolean
        }
        Insert: TasksInsert
        Update: Partial<TasksInsert>
        Relationships: []
      }
      task_logs: {
        Row: { id: string; task_id: string; changes: Json; timestamp: string }
        Insert: TaskLogsInsert
        Update: Partial<TaskLogsInsert>
        Relationships: []
      }
      interactions: {
        Row: {
          id: string; contact_id: string; date: string; type: string; note: string; created_at: string
          // Carnegie (0014)
          initiator: string | null; sentiment: string | null
          topics_discussed: string[] | null; carnegie_tags: string[] | null
          interaction_tags: string[] | null; compliment_text: string | null
          referral_from_id: string | null; new_learning: string | null
          promise_made: string | null
        }
        Insert: InteractionsInsert
        Update: Partial<InteractionsInsert>
        Relationships: []
      }
      special_dates: {
        Row: {
          id: string; user_id: string; contact_id: string
          label: string; type: string
          date_anniversary: string | null; date_full: string | null
          recurring: boolean
          lead_days: number | null; silence_days: number | null
          private_note: string | null; source: string
          created_at: string; updated_at: string
        }
        Insert: SpecialDatesInsert
        Update: Partial<SpecialDatesInsert>
        Relationships: []
      }
      referrals: {
        Row: {
          id: string; user_id: string
          from_contact_id: string; to_contact_id: string | null
          context: string; outcome_note: string | null
          feedback_given: boolean; feedback_given_at: string | null
          status: string
          created_at: string; updated_at: string
        }
        Insert: ReferralsInsert
        Update: Partial<ReferralsInsert>
        Relationships: []
      }
      compliments_received: {
        Row: {
          id: string; user_id: string; contact_id: string
          text: string; received_at: string; context: string | null
          remind_to_reciprocate_at: string | null
          reciprocated: boolean; reciprocated_at: string | null; reciprocation_note: string | null
          created_at: string
        }
        Insert: ComplimentsReceivedInsert
        Update: Partial<ComplimentsReceivedInsert>
        Relationships: []
      }
      principle_of_month: {
        Row: {
          id: string; user_id: string
          principle: string; month: string
          target_applications: number
          reflection: string | null
          created_at: string; updated_at: string
        }
        Insert: PrincipleOfMonthInsert
        Update: Partial<PrincipleOfMonthInsert>
        Relationships: []
      }
      weekly_reflections: {
        Row: {
          id: string; user_id: string; week: string
          marked_me_contact_id: string | null; marked_me_why: string | null
          let_down_contact_id: string | null; let_down_why: string | null
          reconnect_contact_id: string | null; reconnect_handled: boolean
          created_at: string
        }
        Insert: WeeklyReflectionsInsert
        Update: Partial<WeeklyReflectionsInsert>
        Relationships: []
      }
      gratitude_entries: {
        Row: {
          id: string; user_id: string; contact_id: string | null
          text: string
          shared: boolean; shared_at: string | null; shared_channel: string | null
          created_at: string
        }
        Insert: GratitudeEntriesInsert
        Update: Partial<GratitudeEntriesInsert>
        Relationships: []
      }
      category_dimensions: {
        Row: {
          id: string; user_id: string
          label: string; slug: string
          description: string | null
          sort_order: number; archived: boolean
          created_at: string; updated_at: string
        }
        Insert: CategoryDimensionsInsert
        Update: Partial<CategoryDimensionsInsert>
        Relationships: []
      }
      categories: {
        Row: {
          id: string; user_id: string; dimension_id: string
          label: string; slug: string
          color: string | null; description: string | null
          sort_order: number; archived: boolean
          usage_count: number
          created_at: string; updated_at: string
        }
        Insert: CategoriesInsert
        Update: Partial<CategoriesInsert>
        Relationships: []
      }
      contact_categories: {
        Row: {
          id: string; user_id: string; contact_id: string; category_id: string
          created_at: string
        }
        Insert: ContactCategoriesInsert
        Update: Partial<ContactCategoriesInsert>
        Relationships: []
      }
      relationships: {
        Row: { id: string; contact_id: string; related_id: string; label: string; created_at: string }
        Insert: RelationshipsInsert
        Update: Partial<RelationshipsInsert>
        Relationships: []
      }
      contact_logs: {
        Row: { id: string; contact_id: string; changes: Json; timestamp: string }
        Insert: ContactLogsInsert
        Update: Partial<ContactLogsInsert>
        Relationships: []
      }
      sources: {
        Row: { id: string; user_id: string; name: string; url: string; active: boolean; last_fetch: string | null; created_at: string }
        Insert: SourcesInsert
        Update: Partial<SourcesInsert>
        Relationships: []
      }
      newsletters: {
        Row: { id: string; user_id: string; name: string; sender_email: string; active: boolean; last_fetch: string | null; created_at: string }
        Insert: NewslettersInsert
        Update: Partial<NewslettersInsert>
        Relationships: []
      }
      briefings: {
        Row: {
          id: string; user_id: string; date: string; highlight: string
          content: Json; email_sent: boolean; email_sent_at: string | null
          model: string; token_count: number | null; cost: number | null
          created_at: string
          // AQAL
          briefed_for: string | null; content_md: string | null
          context_snapshot: Json | null; external_tasks_count: number
          model_used: string | null; delivered_at: string | null; opened_at: string | null
          // Coach (0013)
          coach_paragraph: string | null
        }
        Insert: BriefingsInsert
        Update: Partial<BriefingsInsert>
        Relationships: []
      }
      calendars: {
        Row: {
          id: string; user_id: string; google_calendar_id: string; summary: string
          description: string | null; google_color_id: string | null; custom_color: string | null
          is_primary: boolean; is_visible: boolean; is_default_for_create: boolean
          access_role: string | null; sync_token: string | null; last_sync_at: string | null
          created_at: string; updated_at: string
        }
        Insert: CalendarsInsert
        Update: Partial<CalendarsInsert>
        Relationships: []
      }
      calendar_events: {
        Row: {
          id: string; user_id: string; calendar_id: string
          google_event_id: string | null; ical_uid: string | null
          summary: string; description: string | null; location: string | null
          start_at: string; end_at: string; all_day: boolean
          timezone: string | null; status: string; recurrence: string[] | null
          recurring_event_id: string | null; attendees: Json | null
          organizer_email: string | null; is_organizer: boolean
          source: string; task_id: string | null; synced: boolean
          etag: string | null; created_at: string; updated_at: string
        }
        Insert: CalendarEventsInsert
        Update: Partial<CalendarEventsInsert>
        Relationships: []
      }
      event_logs: {
        Row: {
          id: string; event_id: string | null; user_id: string
          action: string; changes: Json | null; source: string; timestamp: string
        }
        Insert: EventLogsInsert
        Update: Partial<EventLogsInsert>
        Relationships: []
      }
      // Notes (0008)
      note_folders: {
        Row: { id: string; user_id: string; parent_id: string | null; name: string; created_at: string; updated_at: string }
        Insert: NoteFoldersInsert
        Update: Partial<NoteFoldersInsert>
        Relationships: []
      }
      note_tags: {
        Row: { id: string; user_id: string; name: string; color: string; created_at: string }
        Insert: NoteTagsInsert
        Update: Partial<NoteTagsInsert>
        Relationships: []
      }
      notes: {
        Row: {
          id: string; user_id: string; folder_id: string | null
          type: 'postit' | 'text' | 'audio' | 'link'
          title: string | null; content: string; url: string | null
          thumbnail_url: string | null; audio_duration: number | null
          pinned: boolean; archived: boolean
          created_at: string; updated_at: string
        }
        Insert: NotesInsert
        Update: Partial<NotesInsert>
        Relationships: []
      }
      note_tag_map: {
        Row: { note_id: string; tag_id: string }
        Insert: NoteTagMapInsert
        Update: NoteTagMapInsert
        Relationships: []
      }
      // News (0009)
      news_items: {
        Row: {
          id: string; user_id: string; source_id: string | null
          title: string; url: string; summary: string | null
          content: string | null; author: string | null; image_url: string | null
          published_at: string; favorited: boolean; read: boolean; created_at: string
        }
        Insert: NewsItemsInsert
        Update: Partial<NewsItemsInsert>
        Relationships: []
      }
      // AQAL (0010)
      areas: {
        Row: {
          id: string; user_id: string; parent_id: string | null
          name: string; slug: string; quadrant: Quadrant
          vision_h4: string | null; color: string | null; icon: string | null
          position: number; archived_at: string | null
          created_at: string; updated_at: string
        }
        Insert: AreasInsert
        Update: Partial<AreasInsert>
        Relationships: []
      }
      tags: {
        Row: {
          id: string; user_id: string; parent_id: string | null
          name: string; slug: string; color: string | null; icon: string | null
          metadata: Json; created_at: string
        }
        Insert: TagsInsert
        Update: Partial<TagsInsert>
        Relationships: []
      }
      task_tags: {
        Row: { task_id: string; tag_id: string }
        Insert: { task_id: string; tag_id: string }
        Update: { task_id?: string; tag_id?: string }
        Relationships: []
      }
      project_tags: {
        Row: { project_id: string; tag_id: string }
        Insert: { project_id: string; tag_id: string }
        Update: { project_id?: string; tag_id?: string }
        Relationships: []
      }
      habits: {
        Row: {
          id: string; user_id: string; area_id: string | null
          identity: string; title: string; action: string; min_dose: string
          cue: string | null; reward: string | null; quadrant: Quadrant
          cadence: Json; schedule_time: string | null
          stack_after_habit_id: string | null; active: boolean
          archived_at: string | null; created_at: string; updated_at: string
        }
        Insert: HabitsInsert
        Update: Partial<HabitsInsert>
        Relationships: []
      }
      habit_logs: {
        Row: {
          id: string; habit_id: string; user_id: string
          done_on: string; done_at: string; dose: HabitDose; note: string | null
        }
        Insert: HabitLogsInsert
        Update: Partial<HabitLogsInsert>
        Relationships: []
      }
      rituals: {
        Row: {
          id: string; user_id: string; name: string
          trigger_time: string | null; description: string | null
          active: boolean; created_at: string; updated_at: string
        }
        Insert: RitualsInsert
        Update: Partial<RitualsInsert>
        Relationships: []
      }
      ritual_steps: {
        Row: {
          id: string; ritual_id: string; position: number
          habit_id: string | null; custom_step: string | null; estimated_min: number | null
        }
        Insert: RitualStepsInsert
        Update: Partial<RitualStepsInsert>
        Relationships: []
      }
      inbox_items: {
        Row: {
          id: string; user_id: string; raw_text: string; source: CaptureSrc
          external_ref: string | null; ai_suggestion: Json | null
          processed: boolean; processed_to_task: string | null
          processed_to_project: string | null
          created_at: string; processed_at: string | null
        }
        Insert: InboxItemsInsert
        Update: Partial<InboxItemsInsert>
        Relationships: []
      }
      external_tasks: {
        Row: {
          id: string; user_id: string; provider: string
          external_list_id: string; external_list_name: string | null
          external_id: string; title: string; notes: string | null
          status: string; due_at: string | null; completed_at: string | null
          last_synced_at: string
        }
        Insert: ExternalTasksInsert
        Update: Partial<ExternalTasksInsert>
        Relationships: []
      }
      integrations: {
        Row: {
          id: string; user_id: string; provider: string
          account_email: string | null; scopes: string[]
          access_token_secret_id: string | null; refresh_token_secret_id: string | null
          expires_at: string | null; status: string; last_synced_at: string | null
          metadata: Json; created_at: string; updated_at: string
        }
        Insert: IntegrationsInsert
        Update: Partial<IntegrationsInsert>
        Relationships: []
      }
      coach_profile: {
        Row: {
          user_id: string; name: string; tone: string
          voice_examples: string | null; values_md: Json; boundaries: string | null
          check_in_schedule: Json; system_prompt_override: string | null
          north_star_md: string | null; h3_goals: Json; updated_at: string
        }
        Insert: CoachProfileInsert
        Update: Partial<CoachProfileInsert>
        Relationships: []
      }
      coach_memory: {
        Row: {
          id: string; user_id: string; kind: MemoryKind; content: string
          source: string | null; related_area_id: string | null
          related_project_id: string | null; related_task_id: string | null
          relevance: number; expires_at: string | null
          last_referenced_at: string | null; created_at: string
        }
        Insert: CoachMemoryInsert
        Update: Partial<CoachMemoryInsert>
        Relationships: []
      }
      coach_log: {
        Row: {
          id: string; user_id: string; kind: CoachKind
          direction: 'coach_to_user' | 'user_to_coach'
          content_md: string; context_snapshot: Json | null; resulted_in: Json | null
          model_used: string | null; tokens_in: number | null
          tokens_out: number | null; created_at: string
          conversation_id: string | null
        }
        Insert: CoachLogInsert
        Update: Partial<CoachLogInsert>
        Relationships: []
      }
      coach_memory_candidate: {
        Row: {
          id: string; user_id: string; source_log_id: string | null
          kind: MemoryKind; content: string; relevance: number
          expires_at: string | null
          status: 'pending' | 'accepted' | 'dismissed'
          created_at: string; decided_at: string | null
        }
        Insert: CoachMemoryCandidateInsert
        Update: Partial<CoachMemoryCandidateInsert>
        Relationships: []
      }
      reviews: {
        Row: {
          id: string; user_id: string; week_start: string
          quadrant_distribution: Json; habit_completion: Json; metrics: Json
          alerts: Json; insights_md: string | null; model_used: string | null
          created_at: string
        }
        Insert: ReviewsInsert
        Update: Partial<ReviewsInsert>
        Relationships: []
      }
      // Módulo Hill (0019)
      hill_chief_aims: {
        Row: {
          id: string; user_id: string
          aim_text: string; deadline: string; exchange_text: string
          plan_text: string | null; is_active: boolean; archived_at: string | null
          next_review: string; created_at: string; updated_at: string
        }
        Insert: HillChiefAimsInsert
        Update: Partial<HillChiefAimsInsert>
        Relationships: []
      }
      hill_goals: {
        Row: {
          id: string; user_id: string
          chief_aim_id: string | null; parent_id: string | null
          level: HillGoalLevel; title: string
          metric_text: string | null; metric_value: number | null; metric_unit: string | null
          progress_pct: number; deadline: string | null
          status: HillGoalStatus; linked_project_id: string | null
          completed_at: string | null; created_at: string; updated_at: string
        }
        Insert: HillGoalsInsert
        Update: Partial<HillGoalsInsert>
        Relationships: []
      }
      hill_affirmations: {
        Row: {
          id: string; user_id: string; chief_aim_id: string
          dimension: HillAffirmationDimension; text: string
          belief_score: number; derived_from: Json | null
          status: HillAffirmationStatus; superseded_by: string | null
          retired_reason: string | null
          active_from: string; active_until: string | null
          created_at: string; updated_at: string
        }
        Insert: HillAffirmationsInsert
        Update: Partial<HillAffirmationsInsert>
        Relationships: []
      }
      hill_ritual_logs: {
        Row: {
          id: string; user_id: string; type: HillRitualType
          started_at: string; completed_at: string | null; duration_seconds: number | null
          steps_completed: Json; affirmations_read: string[]; affirmations_skipped: string[]
          reflection_data: Json | null; gratitude_items: string[] | null
          daily_action_task_id: string | null; created_at: string
        }
        Insert: HillRitualLogsInsert
        Update: Partial<HillRitualLogsInsert>
        Relationships: []
      }
      hill_coach_messages: {
        Row: {
          id: string; user_id: string; conversation_id: string
          mode: HillCoachMode; role: HillMessageRole; content: string
          context_used: Json | null; tokens_in: number | null; tokens_out: number | null
          model: string | null; cost: number | null
          action_payload: Json | null; user_action_taken: boolean | null
          created_at: string
        }
        Insert: HillCoachMessagesInsert
        Update: Partial<HillCoachMessagesInsert>
        Relationships: []
      }
      hill_preferences: {
        Row: {
          user_id: string; coach_voice: HillCoachVoice
          daily_nudge_enabled: boolean; ritual_murmurs_enabled: boolean
          created_at: string; updated_at: string
        }
        Insert: HillPreferencesInsert
        Update: Partial<HillPreferencesInsert>
        Relationships: []
      }
    }
    Views: {
      v_tasks_resolved: {
        Row: Database['public']['Tables']['tasks']['Row'] & {
          resolved_quadrant: Quadrant | null
        }
        Relationships: []
      }
      v_quadrant_last_7d: {
        Row: {
          user_id: string
          resolved_quadrant: Quadrant | null
          completed: number
          minutes: number
        }
        Relationships: []
      }
      v_projects_with_counts: {
        Row: Database['public']['Tables']['projects']['Row'] & {
          task_open_count: number
          task_count: number
          child_count: number
          resolved_quadrant: Quadrant | null
        }
        Relationships: []
      }
      v_contacts_with_categories: {
        Row: Database['public']['Tables']['contacts']['Row'] & {
          categories: Json
        }
        Relationships: []
      }
      v_contacts_overdue: {
        Row: Database['public']['Tables']['contacts']['Row'] & {
          effective_cadence_days: number | null
          days_since_last: number | null
          is_overdue: boolean | null
        }
        Relationships: []
      }
      v_gratitude_top_contacts: {
        Row: {
          user_id: string
          contact_id: string
          first_name: string
          last_name: string | null
          year: number
          mentions: number
          last_mention_at: string
        }
        Relationships: []
      }
    }
    Functions: {
      seed_default_areas: {
        Args: { p_user_id: string }
        Returns: void
      }
      sync_contacts_from_google: {
        Args: { p_user_id: string; p_contacts: Json }
        Returns: number
      }
      seed_carnegie_categories: {
        Args: { p_user_id: string }
        Returns: void
      }
    }
    Enums: {
      quadrant: Quadrant
      horizon_lvl: HorizonLvl
      task_context: TaskContext
      project_kind: ProjectKind
      project_status_aqal: ProjectStatusAqal
      habit_dose: HabitDose
      coach_kind: CoachKind
      memory_kind: MemoryKind
      capture_src: CaptureSrc
      hill_goal_level: HillGoalLevel
      hill_goal_status: HillGoalStatus
      hill_affirmation_dimension: HillAffirmationDimension
      hill_affirmation_status: HillAffirmationStatus
      hill_ritual_type: HillRitualType
      hill_coach_mode: HillCoachMode
      hill_message_role: HillMessageRole
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
