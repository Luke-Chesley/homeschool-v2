"use client";

/**
 * Component registry — maps each component type to its renderer.
 *
 * This is the single integration point for adding new component types.
 * The registry is keyed by ComponentType and returns a renderer component.
 *
 * Rendering is deterministic: only registered types can be rendered.
 * Unknown types produce a visible fallback, not a crash.
 */

import * as React from "react";
import type { ComponentSpec } from "@/lib/activities/components";
import type { ComponentRendererProps } from "./types";

// Content components
import {
  HeadingComponent,
  ParagraphComponent,
  CalloutComponent,
  ImageComponent,
  DividerComponent,
} from "./ContentComponents";

// Input components
import {
  ShortAnswerComponent,
  TextResponseComponent,
  RichTextResponseComponent,
  SingleSelectComponent,
  MultiSelectComponent,
  RatingComponent,
  ConfidenceCheckComponent,
} from "./InputComponents";

// Structured interaction components
import {
  ChecklistComponent,
  OrderedSequenceComponent,
  MatchingPairsComponent,
  CategorizationComponent,
  SortIntoGroupsComponent,
  BuildStepsComponent,
  DragArrangeComponent,
} from "./StructuredComponents";

// Assessment / reflection components
import {
  ReflectionPromptComponent,
  RubricSelfCheckComponent,
  CompareAndExplainComponent,
  ChooseNextStepComponent,
  ConstructionSpaceComponent,
} from "./AssessmentComponents";

// Evidence capture components
import {
  FileUploadComponent,
  ImageCaptureComponent,
  AudioCaptureComponent,
  ObservationRecordComponent,
  TeacherCheckoffComponent,
  LabelMapComponent,
  HotspotSelectComponent,
} from "./EvidenceCaptureComponents";

// ---------------------------------------------------------------------------
// Registry type
// ---------------------------------------------------------------------------

type RendererFn = (props: ComponentRendererProps<ComponentSpec>) => React.ReactElement | null;

// ---------------------------------------------------------------------------
// Build the registry
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REGISTRY: Partial<Record<ComponentSpec["type"], RendererFn>> = {
  // Content
  heading: (p) => <HeadingComponent spec={p.spec as Parameters<typeof HeadingComponent>[0]["spec"]} />,
  paragraph: (p) => <ParagraphComponent spec={p.spec as Parameters<typeof ParagraphComponent>[0]["spec"]} />,
  callout: (p) => <CalloutComponent spec={p.spec as Parameters<typeof CalloutComponent>[0]["spec"]} />,
  image: (p) => <ImageComponent spec={p.spec as Parameters<typeof ImageComponent>[0]["spec"]} />,
  divider: () => <DividerComponent />,

  // Input
  short_answer: (p) => <ShortAnswerComponent {...(p as Parameters<typeof ShortAnswerComponent>[0])} />,
  text_response: (p) => <TextResponseComponent {...(p as Parameters<typeof TextResponseComponent>[0])} />,
  rich_text_response: (p) => <RichTextResponseComponent {...(p as Parameters<typeof RichTextResponseComponent>[0])} />,
  single_select: (p) => <SingleSelectComponent {...(p as Parameters<typeof SingleSelectComponent>[0])} />,
  multi_select: (p) => <MultiSelectComponent {...(p as Parameters<typeof MultiSelectComponent>[0])} />,
  rating: (p) => <RatingComponent {...(p as Parameters<typeof RatingComponent>[0])} />,
  confidence_check: (p) => <ConfidenceCheckComponent {...(p as Parameters<typeof ConfidenceCheckComponent>[0])} />,

  // Structured interaction
  checklist: (p) => <ChecklistComponent {...(p as Parameters<typeof ChecklistComponent>[0])} />,
  ordered_sequence: (p) => <OrderedSequenceComponent {...(p as Parameters<typeof OrderedSequenceComponent>[0])} />,
  matching_pairs: (p) => <MatchingPairsComponent {...(p as Parameters<typeof MatchingPairsComponent>[0])} />,
  categorization: (p) => <CategorizationComponent {...(p as Parameters<typeof CategorizationComponent>[0])} />,
  sort_into_groups: (p) => <SortIntoGroupsComponent {...(p as Parameters<typeof SortIntoGroupsComponent>[0])} />,
  build_steps: (p) => <BuildStepsComponent {...(p as Parameters<typeof BuildStepsComponent>[0])} />,
  drag_arrange: (p) => <DragArrangeComponent {...(p as Parameters<typeof DragArrangeComponent>[0])} />,

  // Assessment
  reflection_prompt: (p) => <ReflectionPromptComponent {...(p as Parameters<typeof ReflectionPromptComponent>[0])} />,
  rubric_self_check: (p) => <RubricSelfCheckComponent {...(p as Parameters<typeof RubricSelfCheckComponent>[0])} />,
  compare_and_explain: (p) => <CompareAndExplainComponent {...(p as Parameters<typeof CompareAndExplainComponent>[0])} />,
  choose_next_step: (p) => <ChooseNextStepComponent {...(p as Parameters<typeof ChooseNextStepComponent>[0])} />,
  construction_space: (p) => <ConstructionSpaceComponent {...(p as Parameters<typeof ConstructionSpaceComponent>[0])} />,

  // Evidence capture
  file_upload: (p) => <FileUploadComponent {...(p as Parameters<typeof FileUploadComponent>[0])} />,
  image_capture: (p) => <ImageCaptureComponent {...(p as Parameters<typeof ImageCaptureComponent>[0])} />,
  audio_capture: (p) => <AudioCaptureComponent {...(p as Parameters<typeof AudioCaptureComponent>[0])} />,
  observation_record: (p) => <ObservationRecordComponent {...(p as Parameters<typeof ObservationRecordComponent>[0])} />,
  teacher_checkoff: (p) => <TeacherCheckoffComponent {...(p as Parameters<typeof TeacherCheckoffComponent>[0])} />,
  label_map: (p) => <LabelMapComponent {...(p as Parameters<typeof LabelMapComponent>[0])} />,
  hotspot_select: (p) => <HotspotSelectComponent {...(p as Parameters<typeof HotspotSelectComponent>[0])} />,
};

// ---------------------------------------------------------------------------
// Public: render a single component
// ---------------------------------------------------------------------------

export interface RenderComponentProps {
  spec: ComponentSpec;
  value: unknown;
  onChange: (componentId: string, value: unknown) => void;
  disabled?: boolean;
  hintStrategy?: "on_request" | "always" | "after_wrong_attempt";
}

export function renderComponent({
  spec,
  value,
  onChange,
  disabled,
  hintStrategy,
}: RenderComponentProps): React.ReactElement {
  const renderer = REGISTRY[spec.type];
  if (!renderer) {
    return (
      <div className="rounded-lg border border-dashed border-border/50 p-3 text-xs text-muted-foreground">
        Unknown component type: {spec.type}
      </div>
    );
  }

  return renderer({ spec, value, onChange, disabled, hintStrategy }) ?? (
    <div className="rounded-lg border border-dashed border-border/50 p-3 text-xs text-muted-foreground">
      Component error: {spec.type}
    </div>
  );
}

export function isRegistered(type: string): boolean {
  return type in REGISTRY;
}

export function getRegisteredTypes(): string[] {
  return Object.keys(REGISTRY);
}
