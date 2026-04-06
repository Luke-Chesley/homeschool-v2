import "@/lib/server-only";

/**
 * Activity spec generation service.
 *
 * Generates ActivitySpec objects from lesson and curriculum context via AI.
 * Falls back to a deterministic spec when AI is unavailable or fails.
 *
 * This replaces the old blueprint system in assignment-service.ts.
 * Old per-kind blueprints (guided_practice, reflection, checklist, etc.) are
 * no longer the canonical generation path.
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
  buildContextFromPlanItem,
  buildPromptInput,
  type ActivityGenerationContext,
} from "./generation-context";
import type { PlanItem } from "@/lib/planning/types";

// ---------------------------------------------------------------------------
// Generation result
// ---------------------------------------------------------------------------

export interface ActivityGenResult {
  spec: ActivitySpec;
  /** True when AI generation was used; false when fallback was used */
  aiGenerated: boolean;
  promptVersion: string;
  correctionApplied: boolean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate an ActivitySpec from a plan item.
 * This is the primary entry point used by the assignment service.
 */
export async function generateActivitySpecForPlanItem(
  planItem: PlanItem,
  learnerName: string,
  workflowMode?: string,
): Promise<ActivityGenResult> {
  const ctx = buildContextFromPlanItem(planItem, learnerName, workflowMode);
  return generateActivitySpec(ctx);
}

/**
 * Generate an ActivitySpec from a rich generation context.
 * Used when more context is available (lesson draft, curriculum tree, etc.).
 */
export async function generateActivitySpec(
  ctx: ActivityGenerationContext,
): Promise<ActivityGenResult> {
  // Try AI generation with up to 2 attempts (second with correction notes)
  for (let attempt = 0; attempt < 2; attempt++) {
    const correctionNotes = attempt > 0 ? "Previous attempt produced an invalid spec. See errors above. Fix all issues." : undefined;
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

  // Fallback to deterministic spec
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
 * Used when AI generation fails or is unavailable.
 */
function buildFallbackSpec(ctx: ActivityGenerationContext): ActivitySpec {
  const { lesson, curriculum, teacher } = ctx;
  const subject = curriculum.subject ?? lesson.subject ?? "this subject";
  const minutes = lesson.estimatedMinutes ?? 20;
  const workflowMode = teacher?.workflowMode ?? "family_guided";

  // Determine appropriate activity kind from workflow mode and lesson context
  const activityKind =
    workflowMode === "manager_led"
      ? "observation"
      : workflowMode === "cohort_based"
        ? "demonstration"
        : "guided_practice";

  const components: ActivitySpec["components"] = [
    {
      type: "paragraph",
      id: "intro",
      text: `${lesson.purpose ?? `Work through ${lesson.title} and capture what you understand.`}`,
    },
    {
      type: "text_response",
      id: "focus",
      prompt: `In your own words, explain the focus for this ${subject.toLowerCase()} session.`,
      hint: lesson.objectives[0],
      required: true,
    },
    {
      type: "text_response",
      id: "work",
      prompt: `Complete the core work for "${lesson.title}" and record the key step or answer you reached.`,
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

  // For manager_led or observation-style, add teacher checkoff
  if (workflowMode === "manager_led" || activityKind === "observation") {
    components.push({
      type: "teacher_checkoff",
      id: "checkoff",
      prompt: "Supervisor confirmation",
      items: [
        {
          id: "checkoff-ready",
          label: "Work sample is ready for review",
        },
        {
          id: "checkoff-notes",
          label: "Context and blockers are recorded",
        },
      ],
      acknowledgmentLabel: "I confirm this session is ready for review.",
      notePrompt: "Notes for the reviewer",
    });
  }

  return {
    schemaVersion: "2",
    title: `${lesson.title} — activity`,
    purpose: lesson.purpose ?? lesson.objectives[0] ?? `Work through ${lesson.title}.`,
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
      mode:
        activityKind === "observation"
          ? "teacher_observed"
          : "completion_based",
      masteryThreshold: 0.8,
      reviewThreshold: 0.6,
    },
    adaptationRules: {
      hintStrategy: "on_request",
      allowSkip: false,
      allowRetry: true,
    },
    teacherSupport: {
      setupNotes: `Review "${lesson.title}" objectives before the session starts.`,
      masteryIndicators: lesson.objectives.map((o) => `Learner can: ${o}`),
    },
  };
}
