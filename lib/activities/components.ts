/**
 * Bounded activity component library.
 *
 * Every component type has:
 *   - a strict Zod config schema
 *   - a shared evidence output shape (ComponentEvidence)
 *   - a label for UI / generation prompts
 *
 * The renderer imports this file to get the full registry.
 * The generation prompt imports COMPONENT_TYPE_LIST to constrain the model.
 *
 * No arbitrary code: components are pure configuration objects rendered by
 * app-owned React components.
 */

import { z } from "zod";
import { InteractiveWidgetComponentSchema, widgetAcceptsInput } from "./widgets";

// ---------------------------------------------------------------------------
// Shared evidence shape (each component produces one of these when completed)
// ---------------------------------------------------------------------------

export const ComponentEvidenceSchema = z.object({
  componentId: z.string(),
  componentType: z.string(),
  /** Raw captured value — type depends on component */
  value: z.unknown(),
  /** ISO timestamp when this component was interacted with */
  capturedAt: z.string().datetime().optional(),
});
export type ComponentEvidence = z.infer<typeof ComponentEvidenceSchema>;

// ---------------------------------------------------------------------------
// Content components (no learner interaction — display only)
// ---------------------------------------------------------------------------

export const HeadingComponentSchema = z.object({
  type: z.literal("heading"),
  id: z.string(),
  level: z.number().int().min(1).max(4).default(2),
  text: z.string(),
});

export const ParagraphComponentSchema = z.object({
  type: z.literal("paragraph"),
  id: z.string(),
  text: z.string(),
  /** Optional markdown for richer display */
  markdown: z.string().optional(),
});

export const CalloutComponentSchema = z.object({
  type: z.literal("callout"),
  id: z.string(),
  variant: z.enum(["info", "tip", "warning", "note"]).default("info"),
  text: z.string(),
});

export const ImageComponentSchema = z.object({
  type: z.literal("image"),
  id: z.string(),
  src: z.string().url(),
  alt: z.string(),
  caption: z.string().optional(),
});

export const DividerComponentSchema = z.object({
  type: z.literal("divider"),
  id: z.string(),
});

// ---------------------------------------------------------------------------
// Simple input components
// ---------------------------------------------------------------------------

export const ShortAnswerComponentSchema = z.object({
  type: z.literal("short_answer"),
  id: z.string(),
  prompt: z.string(),
  placeholder: z.string().optional(),
  hint: z.string().optional(),
  /** If set, used as a rubric guide for graders/parents — not shown to learner */
  expectedAnswer: z.string().optional(),
  required: z.boolean().default(true),
});

export const TextResponseComponentSchema = z.object({
  type: z.literal("text_response"),
  id: z.string(),
  prompt: z.string(),
  placeholder: z.string().optional(),
  hint: z.string().optional(),
  minWords: z.number().int().positive().optional(),
  required: z.boolean().default(true),
});

export const RichTextResponseComponentSchema = z.object({
  type: z.literal("rich_text_response"),
  id: z.string(),
  prompt: z.string(),
  hint: z.string().optional(),
  required: z.boolean().default(true),
});

export const SingleSelectComponentSchema = z.object({
  type: z.literal("single_select"),
  id: z.string(),
  prompt: z.string(),
  choices: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      /** Included in answer key only */
      correct: z.boolean().optional(),
      explanation: z.string().optional(),
    }),
  ).min(2),
  /** Show correctness after each answer */
  immediateCorrectness: z.boolean().default(false),
  hint: z.string().optional(),
  required: z.boolean().default(true),
});

export const MultiSelectComponentSchema = z.object({
  type: z.literal("multi_select"),
  id: z.string(),
  prompt: z.string(),
  choices: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      correct: z.boolean().optional(),
    }),
  ).min(2),
  minSelections: z.number().int().nonnegative().optional(),
  maxSelections: z.number().int().positive().optional(),
  hint: z.string().optional(),
  required: z.boolean().default(true),
});

export const RatingComponentSchema = z.object({
  type: z.literal("rating"),
  id: z.string(),
  prompt: z.string(),
  min: z.number().int().default(1),
  max: z.number().int().default(5),
  lowLabel: z.string().optional(),
  highLabel: z.string().optional(),
  required: z.boolean().default(true),
});

export const ConfidenceCheckComponentSchema = z.object({
  type: z.literal("confidence_check"),
  id: z.string(),
  prompt: z.string().default("How confident are you with this?"),
  labels: z.tuple([z.string(), z.string(), z.string(), z.string(), z.string()])
    .default(["Not yet", "A little", "Getting there", "Pretty good", "Got it!"]),
  required: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// Structured interaction components
// ---------------------------------------------------------------------------

export const ChecklistComponentSchema = z.object({
  type: z.literal("checklist"),
  id: z.string(),
  prompt: z.string().optional(),
  items: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      description: z.string().optional(),
      required: z.boolean().default(true),
    }),
  ).min(1),
  allowPartialSubmit: z.boolean().default(false),
});

export const OrderedSequenceComponentSchema = z.object({
  type: z.literal("ordered_sequence"),
  id: z.string(),
  prompt: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      /** 0-based correct position */
      correctIndex: z.number().int().nonnegative(),
    }),
  ).min(2),
  hint: z.string().optional(),
});

export const MatchingPairsComponentSchema = z.object({
  type: z.literal("matching_pairs"),
  id: z.string(),
  prompt: z.string().optional(),
  pairs: z.array(
    z.object({
      id: z.string(),
      left: z.string(),
      right: z.string(),
      leftImageUrl: z.string().url().optional(),
      rightImageUrl: z.string().url().optional(),
    }),
  ).min(2),
  hint: z.string().optional(),
});

export const CategorizationComponentSchema = z.object({
  type: z.literal("categorization"),
  id: z.string(),
  prompt: z.string(),
  categories: z.array(
    z.object({ id: z.string(), label: z.string() }),
  ).min(2),
  items: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      /** IDs of categories this item belongs to */
      correctCategoryIds: z.array(z.string()).min(1),
    }),
  ).min(2),
  hint: z.string().optional(),
});

export const SortIntoGroupsComponentSchema = z.object({
  type: z.literal("sort_into_groups"),
  id: z.string(),
  prompt: z.string(),
  groups: z.array(
    z.object({ id: z.string(), label: z.string(), description: z.string().optional() }),
  ).min(2),
  items: z.array(
    z.object({ id: z.string(), text: z.string(), correctGroupId: z.string() }),
  ).min(2),
  hint: z.string().optional(),
});

export const LabelMapComponentSchema = z.object({
  type: z.literal("label_map"),
  id: z.string(),
  prompt: z.string(),
  imageUrl: z.string().url(),
  imageAlt: z.string(),
  labels: z.array(
    z.object({
      id: z.string(),
      /** x/y as percentage (0-100) of image size */
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
      correctText: z.string(),
      hint: z.string().optional(),
    }),
  ).min(1),
});

export const HotspotSelectComponentSchema = z.object({
  type: z.literal("hotspot_select"),
  id: z.string(),
  prompt: z.string(),
  imageUrl: z.string().url(),
  imageAlt: z.string(),
  hotspots: z.array(
    z.object({
      id: z.string(),
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
      radius: z.number().positive().default(5),
      label: z.string(),
      correct: z.boolean().optional(),
    }),
  ).min(1),
  /** How many hotspots must be selected */
  requiredSelections: z.number().int().positive().optional(),
  hint: z.string().optional(),
});

export const BuildStepsComponentSchema = z.object({
  type: z.literal("build_steps"),
  id: z.string(),
  prompt: z.string().optional(),
  workedExample: z.string().optional(),
  steps: z.array(
    z.object({
      id: z.string(),
      instruction: z.string(),
      hint: z.string().optional(),
      expectedValue: z.string().optional(),
    }),
  ).min(1),
});

export const DragArrangeComponentSchema = z.object({
  type: z.literal("drag_arrange"),
  id: z.string(),
  prompt: z.string(),
  items: z.array(
    z.object({ id: z.string(), text: z.string() }),
  ).min(2),
  hint: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Reflection / self-assessment components
// ---------------------------------------------------------------------------

export const ReflectionPromptComponentSchema = z.object({
  type: z.literal("reflection_prompt"),
  id: z.string(),
  prompt: z.string(),
  subPrompts: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      responseKind: z.enum(["text", "rating"]).default("text"),
    }),
  ).min(1),
  required: z.boolean().default(true),
});

export const RubricSelfCheckComponentSchema = z.object({
  type: z.literal("rubric_self_check"),
  id: z.string(),
  prompt: z.string().optional(),
  criteria: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      description: z.string().optional(),
    }),
  ).min(1),
  levels: z.array(
    z.object({
      value: z.number().int().positive(),
      label: z.string(),
      description: z.string().optional(),
    }),
  ).min(2),
  notePrompt: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Evidence capture components
// ---------------------------------------------------------------------------

export const FileUploadComponentSchema = z.object({
  type: z.literal("file_upload"),
  id: z.string(),
  prompt: z.string(),
  accept: z.array(z.string()).optional(),
  maxFiles: z.number().int().positive().default(3),
  notePrompt: z.string().optional(),
  required: z.boolean().default(false),
});

export const ImageCaptureComponentSchema = z.object({
  type: z.literal("image_capture"),
  id: z.string(),
  prompt: z.string(),
  instructions: z.string().optional(),
  maxImages: z.number().int().positive().default(3),
  required: z.boolean().default(false),
});

export const AudioCaptureComponentSchema = z.object({
  type: z.literal("audio_capture"),
  id: z.string(),
  prompt: z.string(),
  maxDurationSeconds: z.number().int().positive().optional(),
  required: z.boolean().default(false),
});

export const ObservationRecordComponentSchema = z.object({
  type: z.literal("observation_record"),
  id: z.string(),
  prompt: z.string(),
  fields: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      inputKind: z.enum(["text", "rating", "checkbox"]).default("text"),
    }),
  ).min(1),
  /** Who fills this out */
  filledBy: z.enum(["teacher", "parent", "learner"]).default("teacher"),
});

export const TeacherCheckoffComponentSchema = z.object({
  type: z.literal("teacher_checkoff"),
  id: z.string(),
  prompt: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      description: z.string().optional(),
    }),
  ).min(1),
  acknowledgmentLabel: z.string().optional(),
  notePrompt: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Complex / scaffolded components
// ---------------------------------------------------------------------------

export const CompareAndExplainComponentSchema = z.object({
  type: z.literal("compare_and_explain"),
  id: z.string(),
  prompt: z.string(),
  itemA: z.string(),
  itemB: z.string(),
  responsePrompt: z.string().optional(),
  required: z.boolean().default(true),
});

export const ChooseNextStepComponentSchema = z.object({
  type: z.literal("choose_next_step"),
  id: z.string(),
  prompt: z.string(),
  choices: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      description: z.string().optional(),
    }),
  ).min(2),
});

export const ConstructionSpaceComponentSchema = z.object({
  type: z.literal("construction_space"),
  id: z.string(),
  prompt: z.string(),
  scaffoldText: z.string().optional(),
  hint: z.string().optional(),
  required: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// Union: all component configs
// ---------------------------------------------------------------------------

export const ComponentSpecSchema = z.discriminatedUnion("type", [
  HeadingComponentSchema,
  ParagraphComponentSchema,
  CalloutComponentSchema,
  ImageComponentSchema,
  DividerComponentSchema,
  ShortAnswerComponentSchema,
  TextResponseComponentSchema,
  RichTextResponseComponentSchema,
  SingleSelectComponentSchema,
  MultiSelectComponentSchema,
  RatingComponentSchema,
  ConfidenceCheckComponentSchema,
  ChecklistComponentSchema,
  OrderedSequenceComponentSchema,
  MatchingPairsComponentSchema,
  CategorizationComponentSchema,
  SortIntoGroupsComponentSchema,
  LabelMapComponentSchema,
  HotspotSelectComponentSchema,
  BuildStepsComponentSchema,
  DragArrangeComponentSchema,
  InteractiveWidgetComponentSchema,
  ReflectionPromptComponentSchema,
  RubricSelfCheckComponentSchema,
  FileUploadComponentSchema,
  ImageCaptureComponentSchema,
  AudioCaptureComponentSchema,
  ObservationRecordComponentSchema,
  TeacherCheckoffComponentSchema,
  CompareAndExplainComponentSchema,
  ChooseNextStepComponentSchema,
  ConstructionSpaceComponentSchema,
]);

export type ComponentSpec = z.infer<typeof ComponentSpecSchema>;
export type ComponentType = ComponentSpec["type"];

/** The canonical list of all supported component types, used to constrain generation prompts. */
export const COMPONENT_TYPE_LIST: ComponentType[] = [
  "heading",
  "paragraph",
  "callout",
  "image",
  "divider",
  "short_answer",
  "text_response",
  "rich_text_response",
  "single_select",
  "multi_select",
  "rating",
  "confidence_check",
  "checklist",
  "ordered_sequence",
  "matching_pairs",
  "categorization",
  "sort_into_groups",
  "label_map",
  "hotspot_select",
  "build_steps",
  "drag_arrange",
  "interactive_widget",
  "reflection_prompt",
  "rubric_self_check",
  "file_upload",
  "image_capture",
  "audio_capture",
  "observation_record",
  "teacher_checkoff",
  "compare_and_explain",
  "choose_next_step",
  "construction_space",
];

/** Component types that require interaction (not purely display). */
export const INTERACTIVE_COMPONENT_TYPES: ComponentType[] = [
  "short_answer",
  "text_response",
  "rich_text_response",
  "single_select",
  "multi_select",
  "rating",
  "confidence_check",
  "checklist",
  "ordered_sequence",
  "matching_pairs",
  "categorization",
  "sort_into_groups",
  "label_map",
  "hotspot_select",
  "build_steps",
  "drag_arrange",
  "reflection_prompt",
  "rubric_self_check",
  "file_upload",
  "image_capture",
  "audio_capture",
  "observation_record",
  "teacher_checkoff",
  "compare_and_explain",
  "choose_next_step",
  "construction_space",
];

export function isInteractiveComponentSpec(component: ComponentSpec): boolean {
  if (INTERACTIVE_COMPONENT_TYPES.includes(component.type)) {
    return true;
  }
  if (component.type === "interactive_widget") {
    return widgetAcceptsInput(component.widget);
  }
  return false;
}

/** Component types that are content-only (no evidence captured). */
export const CONTENT_COMPONENT_TYPES: ComponentType[] = [
  "heading",
  "paragraph",
  "callout",
  "image",
  "divider",
];
