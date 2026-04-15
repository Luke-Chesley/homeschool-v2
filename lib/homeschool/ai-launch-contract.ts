export const AI_LAUNCH_SUPPORTED_MODALITIES = [
  "text",
  "outline",
  "photo",
  "image",
  "pdf",
  "file",
] as const;

export type AiLaunchSupportedModality =
  (typeof AI_LAUNCH_SUPPORTED_MODALITIES)[number];

export const AI_LAUNCH_ROUTE_FAMILIES = [
  "single_day_material",
  "weekly_assignments",
  "sequence_outline",
  "topic_seed",
  "manual_shell",
  "needs_confirmation",
] as const;

export type AiLaunchRouteFamily = (typeof AI_LAUNCH_ROUTE_FAMILIES)[number];

export const AI_LAUNCH_HORIZON_CEILINGS = [
  "today",
  "next_few_days",
  "current_week",
  "starter_module",
] as const;

export type AiLaunchHorizonCeiling =
  (typeof AI_LAUNCH_HORIZON_CEILINGS)[number];

export const AI_LAUNCH_TODAY_BOOT_STATES = [
  "idle",
  "intake_received",
  "extracting_source",
  "interpreting_source",
  "building_today",
  "building_activity",
  "ready",
  "failed",
] as const;

export type AiLaunchTodayBootState =
  (typeof AI_LAUNCH_TODAY_BOOT_STATES)[number];

export interface AiLaunchRoutingRule {
  routeFamily: AiLaunchRouteFamily;
  label: string;
  supportedModalities: AiLaunchSupportedModality[];
  defaultHorizon: AiLaunchHorizonCeiling;
  maxHorizon: AiLaunchHorizonCeiling;
  requiresConfirmation: boolean;
  notes: string;
}

export const AI_LAUNCH_ROUTING_RULES: readonly AiLaunchRoutingRule[] = [
  {
    routeFamily: "single_day_material",
    label: "Single assignment or photographed day material",
    supportedModalities: ["text", "photo", "image", "pdf", "file"],
    defaultHorizon: "today",
    maxHorizon: "today",
    requiresConfirmation: false,
    notes: "Weak or day-scoped input must stay bounded to today on first pass.",
  },
  {
    routeFamily: "weekly_assignments",
    label: "Weekly assignment sheet or week notes",
    supportedModalities: ["text", "outline", "photo", "image", "pdf", "file"],
    defaultHorizon: "current_week",
    maxHorizon: "current_week",
    requiresConfirmation: false,
    notes: "This is the widest automatic route allowed at launch.",
  },
  {
    routeFamily: "sequence_outline",
    label: "Outline or table of contents",
    supportedModalities: ["text", "outline", "photo", "image", "pdf", "file"],
    defaultHorizon: "next_few_days",
    maxHorizon: "starter_module",
    requiresConfirmation: false,
    notes: "Outline strength can justify a starter module, but not a full curriculum.",
  },
  {
    routeFamily: "topic_seed",
    label: "Topic seed or parent-authored idea",
    supportedModalities: ["text", "outline"],
    defaultHorizon: "starter_module",
    maxHorizon: "starter_module",
    requiresConfirmation: false,
    notes: "Topic-only inputs should generate bounded starter modules rather than fake scope.",
  },
  {
    routeFamily: "manual_shell",
    label: "Manual shell only",
    supportedModalities: ["text", "outline"],
    defaultHorizon: "today",
    maxHorizon: "today",
    requiresConfirmation: false,
    notes: "This path preserves a low-AI fallback and avoids premature expansion.",
  },
  {
    routeFamily: "needs_confirmation",
    label: "Ambiguous source requiring parent confirmation",
    supportedModalities: ["text", "outline", "photo", "image", "pdf", "file"],
    defaultHorizon: "today",
    maxHorizon: "today",
    requiresConfirmation: true,
    notes: "Ambiguous inputs must pause for confirmation rather than widen automatically.",
  },
] as const;

export const AI_LAUNCH_DEFERRED_ITEMS = [
  "polished_activation_metric_semantics",
  "broad_agentic_background_worker_system",
  "audio_video_multimodal_session_understanding",
  "deep_reporting_automation_changes",
  "major_activity_prompt_rewrites",
  "native_distribution_before_phone_runtime_correctness",
] as const;

export const AI_LAUNCH_RULES = {
  onboardingAutoTriggersLessonGeneration: true,
  activityAutoFollowsLessonGeneration: true,
  noFakeWeek: true,
  deferPolishedActivationMetrics: true,
} as const;
