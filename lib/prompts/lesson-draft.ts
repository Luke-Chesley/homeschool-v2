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
  itemCount: number;
  totalMinutes: number;
  objectiveCount: number;
  objectives: string[];
  leadItemTitle: string;
  leadItemObjective: string;
  routeItems: LessonDraftRouteItemInput[];
  materials: string[];
}

export const LESSON_DRAFT_PROMPT_VERSION = "1.1.0";

export const LESSON_DRAFT_SYSTEM_PROMPT = `You are a homeschool lesson planner for a calm, parent-first planning workflow.

Write a practical lesson plan from the current day's route. Keep the tone direct, grounded, and easy for a parent to teach from.

Requirements:
- Use the provided route items, total time, and objective count as the actual planning constraints.
- Prioritize the listed objectives in order.
- Keep the plan realistic for the available time. If there is not enough time for every objective, note the tradeoff and collapse or defer lower-priority work.
- Prefer short, concrete sections over long prose.
- Do not add hype, generic teaching platitudes, or filler.
- Preserve the route sequence unless the plan clearly needs a small adjustment for pacing.

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
    : "1. Follow the current route sequence and keep the lesson coherent.";

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

  return `Draft a lesson plan for ${input.learnerName} on ${input.dateLabel}.

Curriculum source: ${input.sourceTitle}
Route items: ${input.itemCount}
Total time: ${input.totalMinutes} minutes
Objectives in scope: ${input.objectiveCount}

Lead item:
- Title: ${input.leadItemTitle}
- Objective: ${input.leadItemObjective}

Objectives:
${objectives}

Route items:
${routeItems}

Collected materials:
${materials}

Use the route item count, time budget, and objective count to shape the plan. Keep the response ready to teach from, but concise enough to scan quickly.`;
}
