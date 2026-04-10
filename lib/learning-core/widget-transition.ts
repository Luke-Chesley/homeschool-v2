import "@/lib/server-only";

import type { InteractiveWidgetPayload } from "@/lib/activities/widgets";
import {
  WidgetLearnerActionSchema,
  WidgetTransitionArtifactSchema,
  type WidgetLearnerAction,
} from "@/lib/activities/widget-transition";

import { buildLearningCoreEnvelope } from "./envelope";
import { executeLearningCoreOperation } from "./operations";

export interface RequestLearningCoreWidgetTransitionParams {
  activityId?: string | null;
  componentId: string;
  componentType: string;
  widget: InteractiveWidgetPayload;
  learnerAction: WidgetLearnerAction;
  currentResponse?: unknown;
  learnerId?: string | null;
  lessonSessionId?: string | null;
  attemptId?: string | null;
  timeSpentMs?: number;
}

export async function requestLearningCoreWidgetTransition(
  params: RequestLearningCoreWidgetTransitionParams,
) {
  const result = await executeLearningCoreOperation(
    "widget_transition",
    buildLearningCoreEnvelope({
      input: {
        activityId: params.activityId ?? null,
        componentId: params.componentId,
        componentType: params.componentType,
        widget: params.widget,
        learnerAction: WidgetLearnerActionSchema.parse(params.learnerAction),
        currentResponse: params.currentResponse,
        attemptMetadata: {
          attemptId: params.attemptId ?? null,
          source: "component_action",
          timeSpentMs: params.timeSpentMs,
        },
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
    WidgetTransitionArtifactSchema,
  );

  return result.artifact;
}
