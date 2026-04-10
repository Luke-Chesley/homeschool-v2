/**
 * Shared types for v2 activity component renderers.
 */

import type { ComponentSpec } from "@/lib/activities/components";
import type { ActivityComponentFeedback } from "@/lib/activities/feedback";
import type { InteractiveWidgetPayload } from "@/lib/activities/widgets";
import type { WidgetLearnerAction, WidgetTransitionArtifact } from "@/lib/activities/widget-transition";

export interface ComponentRendererProps<T extends ComponentSpec = ComponentSpec> {
  spec: T;
  /** Current captured value for this component */
  value: unknown;
  /** Called when the learner changes/provides a value */
  onChange: (componentId: string, value: unknown) => void;
  /** Optional runtime feedback for this component */
  feedback?: ActivityComponentFeedback | null;
  /** Optional hook for requesting runtime feedback after a learner response */
  onRequestFeedback?: (
    componentId: string,
    componentType: ComponentSpec["type"],
    value: unknown,
  ) => Promise<ActivityComponentFeedback | null>;
  /** Optional hook for canonical widget transitions */
  onRequestTransition?: (
    componentId: string,
    componentType: ComponentSpec["type"],
    widget: InteractiveWidgetPayload,
    learnerAction: WidgetLearnerAction,
    currentValue: unknown,
  ) => Promise<WidgetTransitionArtifact | null>;
  /** True when the activity has been submitted */
  disabled?: boolean;
  /** Hint strategy from adaptationRules */
  hintStrategy?: "on_request" | "always" | "after_wrong_attempt";
}
