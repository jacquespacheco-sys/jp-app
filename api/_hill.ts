import type { Database } from '../src/types/database.js'

type ChiefAimRow = Database['public']['Tables']['hill_chief_aims']['Row']
type GoalRow = Database['public']['Tables']['hill_goals']['Row']
type AffirmationRow = Database['public']['Tables']['hill_affirmations']['Row']
type RitualLogRow = Database['public']['Tables']['hill_ritual_logs']['Row']
type ReviewRow = Database['public']['Tables']['hill_quarterly_reviews']['Row']

export function mapChiefAim(r: ChiefAimRow) {
  return {
    id: r.id,
    userId: r.user_id,
    aimText: r.aim_text,
    deadline: r.deadline,
    exchangeText: r.exchange_text,
    planText: r.plan_text ?? undefined,
    isActive: r.is_active,
    archivedAt: r.archived_at ?? undefined,
    nextReview: r.next_review,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function mapGoal(r: GoalRow) {
  return {
    id: r.id,
    userId: r.user_id,
    chiefAimId: r.chief_aim_id ?? undefined,
    parentId: r.parent_id ?? undefined,
    level: r.level,
    title: r.title,
    metricText: r.metric_text ?? undefined,
    metricValue: r.metric_value ?? undefined,
    metricUnit: r.metric_unit ?? undefined,
    progressPct: r.progress_pct,
    deadline: r.deadline ?? undefined,
    status: r.status,
    linkedProjectId: r.linked_project_id ?? undefined,
    completedAt: r.completed_at ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function mapAffirmation(r: AffirmationRow) {
  return {
    id: r.id,
    userId: r.user_id,
    chiefAimId: r.chief_aim_id,
    dimension: r.dimension,
    text: r.text,
    beliefScore: r.belief_score,
    derivedFrom: r.derived_from ?? undefined,
    status: r.status,
    supersededBy: r.superseded_by ?? undefined,
    retiredReason: r.retired_reason ?? undefined,
    activeFrom: r.active_from,
    activeUntil: r.active_until ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function mapReview(r: ReviewRow) {
  return {
    id: r.id,
    userId: r.user_id,
    chiefAimId: r.chief_aim_id,
    triggeredAt: r.triggered_at,
    completedAt: r.completed_at ?? undefined,
    aimDecision: r.aim_decision ?? undefined,
    affirmationDecisions: r.affirmation_decisions ?? undefined,
    ritualStats: r.ritual_stats ?? undefined,
    nextReviewDate: r.next_review_date,
    createdAt: r.created_at,
  }
}

export function mapRitualLog(r: RitualLogRow) {
  return {
    id: r.id,
    userId: r.user_id,
    type: r.type,
    startedAt: r.started_at,
    completedAt: r.completed_at ?? undefined,
    durationSeconds: r.duration_seconds ?? undefined,
    stepsCompleted: r.steps_completed,
    affirmationsRead: r.affirmations_read,
    affirmationsSkipped: r.affirmations_skipped,
    reflectionData: r.reflection_data ?? undefined,
    gratitudeItems: r.gratitude_items ?? undefined,
    dailyActionTaskId: r.daily_action_task_id ?? undefined,
    createdAt: r.created_at,
  }
}
