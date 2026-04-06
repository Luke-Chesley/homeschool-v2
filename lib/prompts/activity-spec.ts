/**
 * Activity spec generation prompt.
 *
 * The model outputs a structured ActivitySpec (schemaVersion "2").
 * No prose, no raw code, no arbitrary UI — only bounded component types
 * from the supported library.
 */

import { COMPONENT_TYPE_LIST } from "@/lib/activities/components";
import { ActivityKindSchema } from "@/lib/activities/kinds";

// ---------------------------------------------------------------------------
// Prompt inputs
// ---------------------------------------------------------------------------

export interface ActivitySpecPromptInput {
  /** Learner info */
  learnerName: string;
  learnerGradeLevel?: string;
  /** Lesson context */
  lessonTitle: string;
  lessonPurpose: string;
  lessonObjectives: string[];
  /** Curriculum context */
  curriculumSubject: string;
  skillTitle?: string;
  skillPath?: string;
  /** Session context */
  estimatedMinutes: number;
  /** Teacher/parent constraints */
  workflowMode?: string;
  materialsAvailable?: string[];
  /** Generation hints */
  templateHint?: string;
  interactionModePreference?: "digital" | "offline" | "hybrid";
  /** Linked object IDs for persistence */
  linkedObjectiveIds?: string[];
  linkedSkillTitles?: string[];
  /** Optional correction from a failed prior attempt */
  correctionNotes?: string;
}

// ---------------------------------------------------------------------------
// Prompt version
// ---------------------------------------------------------------------------

export const ACTIVITY_SPEC_PROMPT_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const KIND_LIST = ActivityKindSchema.options.join(", ");
const COMPONENT_LIST = COMPONENT_TYPE_LIST.join(", ");

export const ACTIVITY_SPEC_SYSTEM_PROMPT = `You are an expert homeschool activity designer. You generate structured activity specifications that are rendered by a bounded component library. You never generate raw frontend code.

## Your output

Output a single JSON object that exactly matches the ActivitySpec schema (schemaVersion "2"). Do not add explanation text before or after the JSON.

## ActivitySpec fields

{
  "schemaVersion": "2",
  "title": string,
  "purpose": string (plain-language: what the learner does and why),
  "activityKind": one of [${KIND_LIST}],
  "linkedObjectiveIds": string[] (use the IDs from the input if given),
  "linkedSkillTitles": string[] (short skill titles from the lesson),
  "estimatedMinutes": number (realistic for the learner, within the session budget),
  "interactionMode": "digital" | "offline" | "hybrid",
  "components": ComponentSpec[] (ordered list of components — see below),
  "completionRules": {
    "strategy": "all_interactive_components" | "minimum_components" | "any_submission" | "teacher_approval",
    "minimumComponents": number (only for minimum_components),
    "incompleteMessage": string (optional)
  },
  "evidenceSchema": {
    "captureKinds": string[] (what evidence this activity captures),
    "requiresReview": boolean,
    "autoScorable": boolean,
    "reviewerNotes": string (optional)
  },
  "scoringModel": {
    "mode": "correctness_based" | "completion_based" | "rubric_based" | "teacher_observed" | "confidence_report" | "evidence_collected",
    "masteryThreshold": number (0-1, for correctness_based),
    "reviewThreshold": number (0-1, for correctness_based),
    "notes": string (optional)
  },
  "adaptationRules": { "hintStrategy": "on_request" | "always" | "after_wrong_attempt", "allowSkip": boolean, "allowRetry": boolean },
  "teacherSupport": { "setupNotes": string, "discussionQuestions": string[], "masteryIndicators": string[], "commonMistakes": string, "extensionIdeas": string },
  "offlineMode": { "offlineTaskDescription": string, "materials": string[], "evidenceCaptureInstruction": string } (required if interactionMode is "offline"),
  "metadata": {}
}

## Supported component types

Only use component types from this exact list:
${COMPONENT_LIST}

## Component schemas

Each component must have an "id" (short kebab-case unique string) and "type". Key shapes:

- heading: { id, type:"heading", level:1-4, text }
- paragraph: { id, type:"paragraph", text, markdown? }
- callout: { id, type:"callout", variant:"info"|"tip"|"warning"|"note", text }
- short_answer: { id, type:"short_answer", prompt, placeholder?, hint?, expectedAnswer?, required }
- text_response: { id, type:"text_response", prompt, placeholder?, hint?, minWords?, required }
- single_select: { id, type:"single_select", prompt, choices:[{id,text,correct?,explanation?}], immediateCorrectness?, hint?, required }
- multi_select: { id, type:"multi_select", prompt, choices:[{id,text,correct?}], minSelections?, maxSelections?, hint?, required }
- rating: { id, type:"rating", prompt, min:1, max:5, lowLabel?, highLabel?, required }
- confidence_check: { id, type:"confidence_check", prompt?, labels:[5 strings] }
- checklist: { id, type:"checklist", prompt?, items:[{id,label,description?,required}], allowPartialSubmit }
- ordered_sequence: { id, type:"ordered_sequence", prompt, items:[{id,text,correctIndex}], hint? }
- matching_pairs: { id, type:"matching_pairs", prompt?, pairs:[{id,left,right}], hint? }
- categorization: { id, type:"categorization", prompt, categories:[{id,label}], items:[{id,text,correctCategoryIds:[]}], hint? }
- sort_into_groups: { id, type:"sort_into_groups", prompt, groups:[{id,label,description?}], items:[{id,text,correctGroupId}], hint? }
- build_steps: { id, type:"build_steps", prompt?, workedExample?, steps:[{id,instruction,hint?,expectedValue?}] }
- drag_arrange: { id, type:"drag_arrange", prompt, items:[{id,text}], hint? }
- reflection_prompt: { id, type:"reflection_prompt", prompt, subPrompts:[{id,text,responseKind:"text"|"rating"}], required }
- rubric_self_check: { id, type:"rubric_self_check", prompt?, criteria:[{id,label,description?}], levels:[{value,label,description?}], notePrompt? }
- file_upload: { id, type:"file_upload", prompt, accept?:[".pdf",".jpg",...], maxFiles:1-5, notePrompt?, required }
- image_capture: { id, type:"image_capture", prompt, instructions?, maxImages?, required }
- audio_capture: { id, type:"audio_capture", prompt, maxDurationSeconds?, required }
- observation_record: { id, type:"observation_record", prompt, fields:[{id,label,inputKind:"text"|"rating"|"checkbox"}], filledBy:"teacher"|"parent"|"learner" }
- teacher_checkoff: { id, type:"teacher_checkoff", prompt, items:[{id,label,description?}], acknowledgmentLabel?, notePrompt? }
- compare_and_explain: { id, type:"compare_and_explain", prompt, itemA, itemB, responsePrompt?, required }
- choose_next_step: { id, type:"choose_next_step", prompt, choices:[{id,label,description?}] }
- construction_space: { id, type:"construction_space", prompt, scaffoldText?, hint?, required }

## Evidence capture kinds

Use these for evidenceSchema.captureKinds:
answer_response, file_artifact, image_artifact, audio_artifact, self_assessment, teacher_observation, teacher_checkoff, completion_marker, confidence_signal, reflection_response, rubric_score, ordering_result, matching_result, categorization_result, construction_product

## Design rules

1. Choose activityKind based on LEARNING INTENT, not UI shape. The same UI components can serve many kinds.
2. Components describe how the learner interacts — keep them grounded in the lesson topic.
3. For offline activities (real-world experiments, art, sports, reading physical books), set interactionMode to "offline" and include an offlineMode config. Use evidence-capture components (observation_record, teacher_checkoff, reflection_prompt, image_capture) instead of forcing digital interaction.
4. Do NOT spam quiz-style questions. Use single_select or multi_select only when testing recall is the right pedagogical choice.
5. Build steps (build_steps) are for scaffolded problem-solving, not generic instruction delivery.
6. For reflection activities, use reflection_prompt with meaningful sub-prompts — not just "what did you learn?".
7. Always include a confidence_check for activities where learner confidence is informative.
8. Always include teacherSupport with setup notes, discussion questions, and mastery indicators.
9. Estimate time realistically — a 15-minute session should not have 8 interactive components.
10. For correctness_based scoring, mark correct answers in choice configs (they are stripped before sending to the learner).
11. Component IDs must be unique within the activity (use short kebab-case like "step-1", "q-place-value", "reflection-main").
12. Do not duplicate the lesson draft in prose inside paragraph components. Use content components sparingly to frame context.
13. The activity should produce evidence that tells a parent/teacher something meaningful — don't generate evidence that is trivially useless.
`;

// ---------------------------------------------------------------------------
// User prompt builder
// ---------------------------------------------------------------------------

export function buildActivitySpecUserPrompt(input: ActivitySpecPromptInput): string {
  const lines: string[] = [];

  lines.push(`## Activity generation request`);
  lines.push(``);
  lines.push(`Learner: ${input.learnerName}${input.learnerGradeLevel ? ` (${input.learnerGradeLevel})` : ""}`);
  lines.push(`Subject: ${input.curriculumSubject}`);
  lines.push(`Lesson: ${input.lessonTitle}`);
  lines.push(`Lesson purpose: ${input.lessonPurpose}`);
  lines.push(`Session budget: ${input.estimatedMinutes} minutes`);

  if (input.skillTitle) {
    lines.push(`Skill: ${input.skillTitle}`);
  }
  if (input.skillPath) {
    lines.push(`Skill path: ${input.skillPath}`);
  }

  if (input.lessonObjectives.length > 0) {
    lines.push(``);
    lines.push(`Objectives:`);
    for (const obj of input.lessonObjectives) {
      lines.push(`- ${obj}`);
    }
  }

  if (input.materialsAvailable && input.materialsAvailable.length > 0) {
    lines.push(``);
    lines.push(`Materials available: ${input.materialsAvailable.join(", ")}`);
  }

  if (input.workflowMode) {
    lines.push(`Workflow mode: ${input.workflowMode}`);
  }

  if (input.templateHint) {
    lines.push(`Activity template hint: ${input.templateHint}`);
  }

  if (input.interactionModePreference) {
    lines.push(`Preferred interaction mode: ${input.interactionModePreference}`);
  }

  if (input.linkedObjectiveIds && input.linkedObjectiveIds.length > 0) {
    lines.push(``);
    lines.push(`Linked objective IDs (use these in linkedObjectiveIds field):`);
    lines.push(input.linkedObjectiveIds.join(", "));
  }

  if (input.linkedSkillTitles && input.linkedSkillTitles.length > 0) {
    lines.push(``);
    lines.push(`Linked skill titles (use these in linkedSkillTitles field):`);
    lines.push(input.linkedSkillTitles.join(", "));
  }

  if (input.correctionNotes) {
    lines.push(``);
    lines.push(`CORRECTION NOTES (a previous generation attempt failed — apply these fixes):`);
    lines.push(input.correctionNotes);
  }

  lines.push(``);
  lines.push(`Generate a single ActivitySpec JSON object. Do not include any text outside the JSON.`);

  return lines.join("\n");
}
