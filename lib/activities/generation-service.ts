import "@/lib/server-only";

/**
 * Activity spec generation service.
 *
 * Generates ActivitySpec objects from lesson draft context via AI.
 * Falls back to a deterministic spec when AI is unavailable or fails.
 *
 * Hierarchy: curriculum → lesson draft → one lesson activity → evidence/progress
 *
 * Entry point: generateActivitySpecForLessonDraft()
 *   — lesson draft is the sole generation parent
 *   — plan items provide optional traceability only
 *   — produces one activity for the whole lesson draft
 */

import { getAdapterForTask } from "@/lib/ai/registry";
import { getModelForTask } from "@/lib/ai/provider-adapter";
import { getAiRoutingConfig } from "@/lib/ai/routing";
import {
  ACTIVITY_SPEC_SYSTEM_PROMPT,
  ACTIVITY_SPEC_PROMPT_VERSION,
  buildActivitySpecUserPrompt,
} from "@/lib/prompts/activity-spec";
import { ActivitySpecSchema, parseActivitySpec, type ActivitySpec } from "./spec";
import { validateActivitySpec } from "./validation";
import {
  buildActivityContextFromLessonDraft,
  buildPromptInput,
  type ActivityGenerationContext,
} from "./generation-context";
import type { PlanItem } from "@/lib/planning/types";
import type { StructuredLessonDraft } from "@/lib/lesson-draft/types";

// ---------------------------------------------------------------------------
// Generation result
// ---------------------------------------------------------------------------

export interface ActivityGenResult {
  spec: ActivitySpec;
  aiGenerated: boolean;
  promptVersion: string;
  correctionApplied: boolean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate an ActivitySpec from a structured lesson draft.
 *
 * The lesson draft is the sole content source. Plan items (if given) are
 * included only as traceability links in the generated spec.
 */
export async function generateActivitySpecForLessonDraft(params: {
  lessonDraft: StructuredLessonDraft;
  learnerName: string;
  workflowMode?: string;
  planItems?: PlanItem[];
}): Promise<ActivityGenResult> {
  const ctx = buildActivityContextFromLessonDraft(params);
  return generateActivitySpec(ctx);
}

// ---------------------------------------------------------------------------
// Core generation — AI + fallback
// ---------------------------------------------------------------------------

/**
 * Generate an ActivitySpec from a rich generation context.
 * Tries AI up to 2 times; falls back to a deterministic spec.
 */
export async function generateActivitySpec(
  ctx: ActivityGenerationContext,
): Promise<ActivityGenResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const correctionNotes =
      attempt > 0
        ? "Previous attempt produced an invalid spec. See errors above. Fix all issues."
        : undefined;
    const result = await tryAiGenerate(ctx, correctionNotes);
    if (result) {
      return {
        spec: result,
        aiGenerated: true,
        promptVersion: ACTIVITY_SPEC_PROMPT_VERSION,
        correctionApplied: attempt > 0,
      };
    }
  }

  const spec = buildFallbackSpec(ctx);
  return {
    spec,
    aiGenerated: false,
    promptVersion: ACTIVITY_SPEC_PROMPT_VERSION,
    correctionApplied: false,
  };
}

// ---------------------------------------------------------------------------
// Internal: AI generation attempt
// ---------------------------------------------------------------------------

async function tryAiGenerate(
  ctx: ActivityGenerationContext,
  correctionNotes?: string,
): Promise<ActivitySpec | null> {
  try {
    const adapter = getAdapterForTask("interactive.generate");
    const routing = getAiRoutingConfig();
    const model = getModelForTask("interactive.generate", routing);
    const promptInput = buildPromptInput(ctx, correctionNotes);

    const raw = await adapter.completeJson<unknown>({
      model,
      messages: [
        { role: "user", content: buildActivitySpecUserPrompt(promptInput) },
      ],
      systemPrompt: ACTIVITY_SPEC_SYSTEM_PROMPT,
      temperature: 0.4,
      maxTokens: 4096,
      outputSchema: ActivitySpecSchema,
    });

    if (!raw) {
      return null;
    }

    const validation = validateActivitySpec(raw);
    if (!validation.valid) {
      console.warn("[activity-gen] Invalid spec from AI:", validation.errors);
      return null;
    }

    const spec = parseActivitySpec(raw);
    return spec;
  } catch (err) {
    console.error("[activity-gen] AI generation error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fallback: deterministic spec builder
// ---------------------------------------------------------------------------

/**
 * Builds a minimal but valid ActivitySpec without AI.
 * Uses lesson draft structure when available.
 */
function buildFallbackSpec(ctx: ActivityGenerationContext): ActivitySpec {
  const { lesson, lessonDraft, curriculum, teacher, scope } = ctx;
  const subject = curriculum.subject ?? lesson.subject ?? "this subject";
  const minutes = lesson.estimatedMinutes ?? 20;
  const workflowMode = teacher?.workflowMode ?? "family_guided";

  const activityKind =
    workflowMode === "manager_led"
      ? "observation"
      : workflowMode === "cohort_based"
        ? "demonstration"
        : "guided_practice";

  const objectives = lessonDraft?.primaryObjectives ?? lesson.objectives;
  const successCriteria = lessonDraft?.successCriteria ?? [];
  const scopeLabel = scope?.label ?? lesson.title;

  const components: ActivitySpec["components"] = [
    {
      type: "paragraph",
      id: "intro",
      text: lessonDraft?.lessonFocus ?? lesson.purpose ?? `Work through ${lesson.title} and capture what you understand.`,
    },
    {
      type: "text_response",
      id: "focus",
      prompt: `In your own words, explain the focus for this ${subject.toLowerCase()} session.`,
      hint: objectives[0],
      required: true,
    },
    {
      type: "text_response",
      id: "work",
      prompt: `Complete the core work for "${scopeLabel}" and record the key step or answer you reached.`,
      hint: (teacher?.materialsAvailable ?? []).join(" · ") || undefined,
      required: true,
    },
    {
      type: "confidence_check",
      id: "confidence",
      prompt: `How confident do you feel about ${subject.toLowerCase()} after this session?`,
      labels: ["Not yet", "A little", "Getting there", "Pretty good", "Got it!"],
      required: true,
    },
    {
      type: "reflection_prompt",
      id: "reflect",
      prompt: "Session reflection",
      subPrompts: [
        {
          id: "reflect-clear",
          text: "What felt clear, and what needs another pass before you move on?",
          responseKind: "text",
        },
      ],
      required: true,
    },
  ];

  if (workflowMode === "manager_led" || activityKind === "observation") {
    components.push({
      type: "teacher_checkoff",
      id: "checkoff",
      prompt: "Supervisor confirmation",
      items: [
        { id: "checkoff-ready", label: "Work sample is ready for review" },
        { id: "checkoff-notes", label: "Context and blockers are recorded" },
      ],
      acknowledgmentLabel: "I confirm this session is ready for review.",
      notePrompt: "Notes for the reviewer",
    });
  }

  const masteryIndicators =
    successCriteria.length > 0
      ? successCriteria
      : objectives.map((o) => `Learner can: ${o}`);

  return {
    schemaVersion: "2",
    title: `${scopeLabel} — activity`,
    purpose:
      lessonDraft?.lessonFocus ??
      lesson.purpose ??
      lesson.objectives[0] ??
      `Work through ${lesson.title}.`,
    activityKind,
    linkedObjectiveIds: ctx.linkedObjectiveIds ?? [],
    linkedSkillTitles: ctx.linkedSkillTitles ?? [],
    estimatedMinutes: Math.min(minutes, 30),
    interactionMode: "digital",
    components,
    completionRules: {
      strategy: "all_interactive_components",
    },
    evidenceSchema: {
      captureKinds:
        activityKind === "observation"
          ? ["teacher_checkoff", "reflection_response", "confidence_signal"]
          : ["reflection_response", "confidence_signal", "completion_marker"],
      requiresReview: activityKind === "observation",
      autoScorable: false,
    },
    scoringModel: {
      mode: activityKind === "observation" ? "teacher_observed" : "completion_based",
      masteryThreshold: 0.8,
      reviewThreshold: 0.6,
    },
    adaptationRules: {
      hintStrategy: "on_request",
      allowSkip: false,
      allowRetry: true,
    },
    teacherSupport: {
      setupNotes: lessonDraft
        ? `${lessonDraft.teacherNotes.join(" ")} Review "${scopeLabel}" before the session starts.`
        : `Review "${lesson.title}" objectives before the session starts.`,
      masteryIndicators,
    },
  };
}
