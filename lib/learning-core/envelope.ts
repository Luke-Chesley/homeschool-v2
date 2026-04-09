import "@/lib/server-only";

type RequestOrigin = "ui_action" | "server_action" | "background_job" | "api" | "copilot";
type Audience = "parent" | "teacher" | "learner" | "internal";
type Tone = "practical" | "concise" | "supportive" | "neutral";
type UiDensity = "compact" | "normal" | "detailed";
type DisplayIntent = "preview" | "final" | "review" | "edit";

export interface BuildLearningCoreEnvelopeParams<TInput> {
  input: TInput;
  surface: string;
  organizationId?: string | null;
  learnerId?: string | null;
  lessonSessionId?: string | null;
  planItemIds?: string[];
  workflowMode?: string | null;
  requestOrigin?: RequestOrigin;
  debug?: boolean;
  requestId?: string;
  presentationContext?: Partial<{
    audience: Audience;
    tone: Tone;
    uiDensity: UiDensity;
    displayIntent: DisplayIntent;
    shouldReturnPromptPreview: boolean;
  }>;
  userAuthoredContext?: Partial<{
    note: string | null;
    teacherNote: string | null;
    parentGoal: string | null;
    specialConstraints: string[];
    customInstruction: string | null;
    avoidances: string[];
  }>;
}

export function buildLearningCoreEnvelope<TInput>({
  input,
  surface,
  organizationId,
  learnerId,
  lessonSessionId,
  planItemIds,
  workflowMode,
  requestOrigin = "api",
  debug = false,
  requestId,
  presentationContext,
  userAuthoredContext,
}: BuildLearningCoreEnvelopeParams<TInput>) {
  return {
    input,
    app_context: {
      product: "homeschool-v2",
      surface,
      organization_id: organizationId ?? null,
      learner_id: learnerId ?? null,
      lesson_session_id: lessonSessionId ?? null,
      plan_item_ids: planItemIds ?? [],
      workflow_mode: workflowMode ?? null,
      request_origin: requestOrigin,
      debug,
    },
    presentation_context: {
      audience: presentationContext?.audience ?? "internal",
      tone: presentationContext?.tone ?? "practical",
      ui_density: presentationContext?.uiDensity ?? "normal",
      display_intent: presentationContext?.displayIntent ?? "final",
      should_return_prompt_preview: presentationContext?.shouldReturnPromptPreview ?? false,
    },
    user_authored_context: {
      note: userAuthoredContext?.note ?? null,
      teacher_note: userAuthoredContext?.teacherNote ?? null,
      parent_goal: userAuthoredContext?.parentGoal ?? null,
      special_constraints: userAuthoredContext?.specialConstraints ?? [],
      custom_instruction: userAuthoredContext?.customInstruction ?? null,
      avoidances: userAuthoredContext?.avoidances ?? [],
    },
    request_id: requestId,
  };
}
