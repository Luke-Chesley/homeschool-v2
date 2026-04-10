import "@/lib/server-only";

import type { ActivitySpec } from "@/lib/activities/spec";
import { ActivityComponentFeedbackSchema } from "@/lib/activities/feedback";
import type { InteractiveWidgetPayload } from "@/lib/activities/widgets";
import { buildLearningCoreEnvelope } from "./envelope";
import { executeLearningCoreOperation } from "./operations";

export interface RequestLearningCoreActivityFeedbackParams {
  activityId?: string | null;
  activitySpec: ActivitySpec;
  componentId: string;
  componentType: string;
  widget?: InteractiveWidgetPayload | null;
  learnerResponse: unknown;
  learnerId?: string | null;
  lessonSessionId?: string | null;
  attemptId?: string | null;
  timeSpentMs?: number;
}

export async function requestLearningCoreActivityFeedback(
  params: RequestLearningCoreActivityFeedbackParams,
) {
  const result = await executeLearningCoreOperation(
    "activity_feedback",
    buildLearningCoreEnvelope({
      input: {
        activityId: params.activityId ?? null,
        activitySpec: params.activitySpec,
        componentId: params.componentId,
        componentType: params.componentType,
        learnerResponse: params.learnerResponse,
        attemptMetadata: {
          attemptId: params.attemptId ?? null,
          source: "component_action",
          timeSpentMs: params.timeSpentMs,
        },
        ...(params.widget ? { widget: params.widget } : {}),
      },
      surface: "learner_activity",
      learnerId: params.learnerId ?? null,
      lessonSessionId: params.lessonSessionId ?? null,
      requestOrigin: "ui_action",
      presentationContext: {
        audience: "learner",
        displayIntent: "review",
      },
    }),
    ActivityComponentFeedbackSchema,
  );

  return result.artifact;
}
