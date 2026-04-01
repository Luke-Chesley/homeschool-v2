export interface LessonDraftRouteItemInput {
  title: string;
  subject: string;
  estimatedMinutes: number;
  objective: string;
  lessonLabel: string;
  note?: string;
}

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
}

export const LESSON_DRAFT_PROMPT_VERSION = "1.3.0";

export const LESSON_DRAFT_SYSTEM_PROMPT = `You are a homeschool lesson planner for a calm, parent-first planning workflow.

Write a practical lesson plan from the current day's route. Use the day's objectives and the current week's route context together. Keep the tone direct, grounded, and easy for a parent to teach from.

Requirements:
- Use the provided route items, total time, and objective count as the actual planning constraints.
- Treat the listed objectives as equal planning inputs unless the content itself implies a dependency.
- Use the weekly context to keep today's lesson aligned with what came earlier in the week and what is coming next.
- Keep the plan realistic for the available time. If there is not enough time for every objective, note the tradeoff and collapse or defer lower-priority work.
- Prefer short, concrete sections over long prose.
- Do not add hype, generic teaching platitudes, or filler.
- Use the listed route items as context, but do not assume the exact sequence is fixed.

Return Markdown with these sections:
1. Overview
2. Time Budget
3. Lesson Sequence
4. Materials
5. Parent Notes

Each section should be concise and actionable.`;

export function buildLessonDraftUserPrompt(input: LessonDraftPromptInput) {
  const objectives = input.objectives.length > 0
    ? input.objectives.map((objective, index) => `${index + 1}. ${objective}`).join("\n")
    : "1. Use the current day's items to keep the lesson coherent.";

  const routeItems = input.routeItems
    .map((item, index) => {
      const noteLine = item.note ? `\n   Note: ${item.note}` : "";
      return [
        `${index + 1}. ${item.title} (${item.subject}, ${item.estimatedMinutes} min)`,
        `   Objective: ${item.objective}`,
        `   Route label: ${item.lessonLabel}`,
        noteLine,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const materials = input.materials.length > 0 ? input.materials.join(" · ") : "No shared materials were collected.";
  const weekHighlights =
    input.weekHighlights && input.weekHighlights.length > 0
      ? input.weekHighlights.map((highlight, index) => `${index + 1}. ${highlight}`).join("\n")
      : "1. No weekly highlights were provided.";
  const weekScheduleSummary =
    input.weekScheduleSummary && input.weekScheduleSummary.length > 0
      ? input.weekScheduleSummary.map((day, index) => `${index + 1}. ${day}`).join("\n")
      : "1. No weekly schedule summary was provided.";

  return `Draft a lesson plan for ${input.learnerName} on ${input.dateLabel}.

Curriculum source: ${input.sourceTitle}
Week context: ${input.weekLabel ?? "Current week"}
Route items: ${input.itemCount}
Total time: ${input.totalMinutes} minutes
Objectives in scope: ${input.objectiveCount}

Objectives:
${objectives}

Route items:
${routeItems}

Collected materials:
${materials}

Weekly highlights:
${weekHighlights}

Weekly schedule summary:
${weekScheduleSummary}

Use the route item count, time budget, objective count, and weekly context to shape the plan. Treat the objectives and route items as a set of inputs rather than a strict order. Keep the response ready to teach from, but concise enough to scan quickly.`;
}
