/**
 * Activity spec validation.
 *
 * Validates ActivitySpec objects before they are persisted or rendered.
 * Returns structured errors so the generation service can include correction
 * notes in a retry prompt.
 */

import { ActivitySpecSchema, type ActivitySpec } from "./spec.ts";
import { COMPONENT_TYPE_LIST, INTERACTIVE_COMPONENT_TYPES } from "./components.ts";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a raw unknown value as an ActivitySpec.
 * Returns { valid: true } on success, or { valid: false, errors } on failure.
 */
export function validateActivitySpec(value: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Schema validation first
  const result = ActivitySpecSchema.safeParse(value);
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push(`${issue.path.join(".")}: ${issue.message}`);
    }
    return { valid: false, errors, warnings };
  }

  const spec = result.data;
  runSemanticChecks(spec, errors, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function runSemanticChecks(
  spec: ActivitySpec,
  errors: string[],
  warnings: string[],
): void {
  // Every component type must be in the supported list
  for (const component of spec.components) {
    if (!COMPONENT_TYPE_LIST.includes(component.type)) {
      errors.push(`Unsupported component type: "${component.type}"`);
    }
  }

  // Must have at least one interactive component (not just content)
  const hasInteractive = spec.components.some((c) =>
    INTERACTIVE_COMPONENT_TYPES.includes(c.type),
  );
  if (!hasInteractive) {
    errors.push("Activity must have at least one interactive component.");
  }

  // Estimated time realism
  if (spec.estimatedMinutes < 1) {
    errors.push("estimatedMinutes must be at least 1.");
  }
  if (spec.estimatedMinutes > 120) {
    warnings.push("estimatedMinutes > 120 is unusually long for a single activity.");
  }

  // Offline activities should have offlineMode config
  if (spec.interactionMode === "offline" && !spec.offlineMode) {
    warnings.push(
      "interactionMode is 'offline' but offlineMode config is missing. Add offlineMode.offlineTaskDescription.",
    );
  }

  // If completion strategy requires minimum, validate the count
  if (
    spec.completionRules.strategy === "minimum_components" &&
    spec.completionRules.minimumComponents == null
  ) {
    errors.push(
      "completionRules.strategy is 'minimum_components' but minimumComponents is not set.",
    );
  }

  // Evidence spec coherence: auto-scorable only works with correctness-based scoring
  if (
    spec.evidenceSchema.autoScorable &&
    spec.scoringModel.mode !== "correctness_based"
  ) {
    warnings.push(
      "evidenceSchema.autoScorable is true but scoringModel.mode is not 'correctness_based'. Auto-scoring will be skipped.",
    );
  }

  // Unique component IDs
  const ids = spec.components.map((c) => c.id);
  const idSet = new Set(ids);
  if (idSet.size !== ids.length) {
    errors.push("Component IDs must be unique within an activity.");
  }

  // Single/multi select must have at least 2 choices
  for (const c of spec.components) {
    if (c.type === "single_select" && c.choices.length < 2) {
      errors.push(`single_select "${c.id}" must have at least 2 choices.`);
    }
    if (c.type === "multi_select" && c.choices.length < 2) {
      errors.push(`multi_select "${c.id}" must have at least 2 choices.`);
    }
  }

  // Build steps must have at least 1 step
  for (const c of spec.components) {
    if (c.type === "build_steps" && c.steps.length < 1) {
      errors.push(`build_steps "${c.id}" must have at least 1 step.`);
    }
  }
}
