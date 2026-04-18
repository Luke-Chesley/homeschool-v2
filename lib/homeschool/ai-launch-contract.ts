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
  "bounded_material",
  "timeboxed_plan",
  "structured_sequence",
  "comprehensive_source",
  "topic_seed",
  "shell_request",
  "ambiguous",
] as const;

export type AiLaunchRouteFamily = (typeof AI_LAUNCH_ROUTE_FAMILIES)[number];

export const AI_LAUNCH_HORIZON_CEILINGS = [
  "single_day",
  "few_days",
  "one_week",
  "two_weeks",
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
    routeFamily: "bounded_material",
    label: "Single assignment or photographed day material",
    supportedModalities: ["text", "photo", "image", "pdf", "file"],
    defaultHorizon: "single_day",
    maxHorizon: "single_day",
    requiresConfirmation: false,
    notes: "Weak or day-scoped input must stay bounded to a single-day start on first pass.",
  },
  {
    routeFamily: "timeboxed_plan",
    label: "Weekly or time-boxed assignment plan",
    supportedModalities: ["text", "outline", "photo", "image", "pdf", "file"],
    defaultHorizon: "one_week",
    maxHorizon: "two_weeks",
    requiresConfirmation: false,
    notes: "Time-boxed sources may extend to two weeks when the source already provides that structure.",
  },
  {
    routeFamily: "structured_sequence",
    label: "Outline or ordered sequence",
    supportedModalities: ["text", "outline", "photo", "image", "pdf", "file"],
    defaultHorizon: "few_days",
    maxHorizon: "one_week",
    requiresConfirmation: false,
    notes: "Structured sequences should start from the first bounded arc instead of widening to the full source.",
  },
  {
    routeFamily: "comprehensive_source",
    label: "Outline, table of contents, workbook, or whole-book source",
    supportedModalities: ["text", "outline", "photo", "image", "pdf", "file"],
    defaultHorizon: "one_week",
    maxHorizon: "two_weeks",
    requiresConfirmation: false,
    notes:
      "Large or comprehensive sources still launch from a bounded initial slice; whole-book uploads stay continuation-friendly instead of widening automatically.",
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
    routeFamily: "shell_request",
    label: "Manual shell only",
    supportedModalities: ["text", "outline"],
    defaultHorizon: "starter_module",
    maxHorizon: "starter_module",
    requiresConfirmation: false,
    notes: "This path preserves a low-AI fallback and avoids premature expansion.",
  },
  {
    routeFamily: "ambiguous",
    label: "Ambiguous source requiring parent confirmation",
    supportedModalities: ["text", "outline", "photo", "image", "pdf", "file"],
    defaultHorizon: "single_day",
    maxHorizon: "single_day",
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
  noUserHorizonChoice: true,
  deferPolishedActivationMetrics: true,
} as const;
