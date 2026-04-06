import type { LessonShape, TeacherContext } from "../lesson-draft/types.ts";
import { LESSON_BLOCK_TYPES } from "../lesson-draft/types.ts";

// ---------------------------------------------------------------------------
// Route item input shape (unchanged from previous version)
// ---------------------------------------------------------------------------

export interface LessonDraftRouteItemInput {
  title: string;
  subject: string;
  estimatedMinutes: number;
  objective: string;
  lessonLabel: string;
  note?: string;
}

// ---------------------------------------------------------------------------
// Prompt input shape
// ---------------------------------------------------------------------------

export interface LessonDraftPromptInput {
  learnerName: string;
  sourceTitle: string;
  dateLabel: string;
  weekLabel?: string;
  itemCount: number;
  totalMinutes: number;
  objectiveCount: number;
  objectives: string[];
  routeItems: LessonDraftRouteItemInput[];
  materials: string[];
  weekHighlights?: string[];
  weekScheduleSummary?: string[];
  lessonShape?: LessonShape;
  teacherContext?: TeacherContext;
}

// ---------------------------------------------------------------------------
// Prompt version
// ---------------------------------------------------------------------------

export const LESSON_DRAFT_PROMPT_VERSION = "2.0.0";

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const BLOCK_TYPE_LIST = LESSON_BLOCK_TYPES.join(", ");

export const LESSON_DRAFT_SYSTEM_PROMPT = `You are a homeschool lesson planner that generates structured lesson data for a parent-facing teaching interface.

IMPORTANT: Return valid JSON only. No markdown, no prose, no code fences. The output must parse as a StructuredLessonDraft object.

Schema (all fields are strings or string arrays unless annotated):
{
  "schema_version": "1.0",
  "title": string,
  "lesson_focus": string,           // 1 sentence, what this lesson is about
  "primary_objectives": string[],   // 1-3 items, each <= 20 words
  "success_criteria": string[],     // 1-4 items, observable/concrete
  "total_minutes": number,
  "blocks": Block[],
  "materials": string[],
  "teacher_notes": string[],        // short bullets, <= 5 items
  "adaptations": Adaptation[],

  // Optional - include only when genuinely useful:
  "prep": string[],
  "assessment_artifact": string,
  "extension": string,
  "follow_through": string,
  "co_teacher_notes": string[],
  "accommodations": string[],
  "lesson_shape": string
}

Block shape:
{
  "type": one of [${BLOCK_TYPE_LIST}],
  "title": string,                  // short label, <= 10 words
  "minutes": number,
  "purpose": string,                // 1 sentence max
  "teacher_action": string,         // 1-2 sentences, what you do
  "learner_action": string,         // 1-2 sentences, what learner does
  "check_for": string,              // optional, 1 sentence
  "materials_needed": string[],     // optional
  "optional": boolean               // optional, true = can skip if time is short
}

Adaptation shape:
{
  "trigger": "if_struggles" | "if_finishes_early" | "if_attention_drops" | "if_materials_missing" | string,
  "action": string                  // 1-2 sentences, actionable instruction
}

Rules:
- Block minutes must sum to total_minutes +/- 15%.
- Include at least one instructional block (model, guided_practice, independent_practice, demonstration, read_aloud, discussion, or project_work).
- Include at least one visible check: a check_for_understanding or reflection block, or a check_for field on any block.
- Do not follow a rigid pedagogical script. Choose only the blocks that fit this lesson.
- Keep all text short and operational. No paragraphs. No narrative. No filler.
- Align blocks to the provided route items and objectives without forcing route order as a script.
- If total time is tight, mark lower-priority blocks as optional:true.
- Adaptations are short, actionable, and ready to use during live teaching.
- Do not include optional top-level fields unless they add clear value for this lesson.`;

// ---------------------------------------------------------------------------
// User prompt builder
// ---------------------------------------------------------------------------

export function buildLessonDraftUserPrompt(input: LessonDraftPromptInput): string {
  const objectives =
    input.objectives.length > 0
      ? input.objectives.map((o, i) => `${i + 1}. ${o}`).join("\n")
      : "1. Use the current day's items to keep the lesson coherent.";

  const routeItems = input.routeItems
    .map((item, i) => {
      const noteLine = item.note ? `\n   Note: ${item.note}` : "";
      return [
        `${i + 1}. ${item.title} (${item.subject}, ${item.estimatedMinutes} min)`,
        `   Objective: ${item.objective}`,
        `   Route label: ${item.lessonLabel}`,
        noteLine,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const materials =
    input.materials.length > 0 ? input.materials.join(" · ") : "None listed.";

  const weekHighlights =
    input.weekHighlights && input.weekHighlights.length > 0
      ? input.weekHighlights.map((h, i) => `${i + 1}. ${h}`).join("\n")
      : "None provided.";

  const weekScheduleSummary =
    input.weekScheduleSummary && input.weekScheduleSummary.length > 0
      ? input.weekScheduleSummary.map((d, i) => `${i + 1}. ${d}`).join("\n")
      : "None provided.";

  const shapeNote = input.lessonShape
    ? `\nLesson shape preference: ${input.lessonShape}`
    : "";

  const teacherNote = input.teacherContext
    ? buildTeacherContextNote(input.teacherContext)
    : "";

  return `Generate a structured lesson plan for ${input.learnerName} on ${input.dateLabel}.

Curriculum source: ${input.sourceTitle}
Week context: ${input.weekLabel ?? "Current week"}
Route items: ${input.itemCount}
Total time: ${input.totalMinutes} minutes
Objectives in scope: ${input.objectiveCount}
${shapeNote}${teacherNote}
Objectives:
${objectives}

Route items:
${routeItems}

Materials available:
${materials}

Weekly highlights:
${weekHighlights}

Weekly schedule:
${weekScheduleSummary}

Return only valid JSON. No other text.`;
}

function buildTeacherContextNote(ctx: TeacherContext): string {
  const lines: string[] = [];
  if (ctx.subject_comfort) lines.push(`Teacher subject comfort: ${ctx.subject_comfort}`);
  if (ctx.prep_tolerance) lines.push(`Prep tolerance: ${ctx.prep_tolerance}`);
  if (ctx.teaching_style) lines.push(`Teaching style: ${ctx.teaching_style}`);
  if (ctx.role) lines.push(`Role: ${ctx.role}`);
  return lines.length > 0 ? "\n" + lines.join("\n") + "\n" : "";
}
