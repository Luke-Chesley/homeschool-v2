/**
 * Shared types for v2 activity component renderers.
 */

import type { ComponentSpec } from "@/lib/activities/components";

export interface ComponentRendererProps<T extends ComponentSpec = ComponentSpec> {
  spec: T;
  /** Current captured value for this component */
  value: unknown;
  /** Called when the learner changes/provides a value */
  onChange: (componentId: string, value: unknown) => void;
  /** True when the activity has been submitted */
  disabled?: boolean;
  /** Hint strategy from adaptationRules */
  hintStrategy?: "on_request" | "always" | "after_wrong_attempt";
}
