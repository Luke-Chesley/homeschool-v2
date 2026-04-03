/**
 * Prompt store — versioned prompt templates.
 *
 * Prompts are stored as typed records with version strings. The version is
 * included in artifact lineage so outputs can be re-generated with the same
 * prompt later.
 *
 * Convention: prompts are stored by task name + version. A "1.0.0" version
 * always exists as the default.
 *
 * Integration point: prompts can be stored in the database (plan 02) for
 * runtime editing by the parent. This store is the fallback.
 */

import type { AiTaskName } from "@/lib/ai/types";
import {
  CURRICULUM_GENERATION_PROMPT_VERSION,
  CURRICULUM_GENERATION_SYSTEM_PROMPT,
  CURRICULUM_INTAKE_PROMPT_VERSION,
  CURRICULUM_INTAKE_SYSTEM_PROMPT,
} from "@/lib/prompts/curriculum-draft";
import {
  LESSON_DRAFT_PROMPT_VERSION,
  LESSON_DRAFT_SYSTEM_PROMPT,
} from "@/lib/prompts/lesson-draft";

// ---------------------------------------------------------------------------
// Prompt record type
// ---------------------------------------------------------------------------

export interface PromptRecord {
  task: AiTaskName;
  version: string;
  systemPrompt: string;
  userTemplate?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Prompt library
// ---------------------------------------------------------------------------

const PROMPTS: PromptRecord[] = [
  {
    task: "curriculum.intake",
    version: CURRICULUM_INTAKE_PROMPT_VERSION,
    systemPrompt: CURRICULUM_INTAKE_SYSTEM_PROMPT,
    notes: "Conversational intake for AI curriculum drafting",
  },
  {
    task: "curriculum.generate",
    version: CURRICULUM_GENERATION_PROMPT_VERSION,
    systemPrompt: CURRICULUM_GENERATION_SYSTEM_PROMPT,
    notes: "Structured curriculum tree and lesson outline generation",
  },
  {
    task: "chat.answer",
    version: "1.0.0",
    systemPrompt: `You are a helpful homeschool copilot assistant. You help parents plan lessons, understand curriculum, map learning goals to standards, and reflect on their learners' progress.

Be warm, clear, and practical. When you suggest actions (adding a lesson, adjusting a plan, mapping standards), describe them clearly so the parent can apply them. Keep responses focused and avoid unnecessary caveats.

You have access to the household's curriculum context, recent learner outcomes, and standards framework. Use this context to give grounded, specific suggestions rather than generic advice.`,
    notes: "Primary chat system prompt",
  },
  {
    task: "lesson.draft",
    version: LESSON_DRAFT_PROMPT_VERSION,
    systemPrompt: LESSON_DRAFT_SYSTEM_PROMPT,
    notes: "Lesson draft generation prompt",
  },
  {
    task: "worksheet.generate",
    version: "1.0.0",
    systemPrompt: `You are an expert at creating educational worksheets for homeschool learners.

Create worksheets that:
- Have a clear title and instructions
- Progress from simpler to more complex problems
- Include a mix of question types where appropriate
- Are appropriately challenging for the grade level
- Include space for student work

Output in Markdown format suitable for printing.`,
    userTemplate: "Generate a {questionCount}-question worksheet on {topic} for grade {gradeLevel}.",
    notes: "Worksheet generation prompt",
  },
  {
    task: "interactive.generate",
    version: "1.0.0",
    systemPrompt: `You are an expert at creating structured educational activities for homeschool learners.

Generate activity schemas in the specified format (quiz, flashcards, matching, or sequencing). Activities must:
- Be directly tied to the learning objectives
- Have clear, unambiguous questions/items
- Include answer keys where appropriate
- Be age-appropriate for the grade level

Output valid JSON matching the activity schema.`,
    userTemplate: "Generate a {kind} activity on {topic} for grade {gradeLevel}.",
    notes: "Interactive activity generation prompt",
  },
  {
    task: "plan.adapt",
    version: "1.0.0",
    systemPrompt: `You are a thoughtful homeschool curriculum advisor helping parents adjust their teaching plans based on learner outcomes.

When suggesting adaptations:
- Identify patterns in recent outcomes (what went well, what needs more practice)
- Suggest specific, actionable changes to the plan
- Explain the rationale for each suggestion
- Prioritize the learner's confidence and mastery over pace

Be supportive and constructive. Focus on durable learning, not just coverage.`,
    userTemplate: "Review the following outcomes and suggest adjustments to the current plan.",
    notes: "Plan adaptation prompt",
  },
  {
    task: "text.summarize",
    version: "1.0.0",
    systemPrompt: `You summarize educational source material for homeschool parents. Be concise and accurate. Preserve key learning objectives, topics covered, and grade-level information.`,
    notes: "Text summarization prompt",
  },
  {
    task: "standards.suggest",
    version: "1.0.0",
    systemPrompt: `You are an expert in educational standards frameworks. Given a learning objective description, identify the most relevant standards codes.

Return a JSON object with this structure:
{ "standardIds": ["CCSS.MATH.CONTENT.4.NBT.A.1", ...] }

Only include standards that are a clear match. Prefer specificity (leaf-level standards) over domain-level codes.`,
    notes: "Standards suggestion prompt",
  },
];

// ---------------------------------------------------------------------------
// Store accessor
// ---------------------------------------------------------------------------

export function resolvePrompt(
  task: AiTaskName,
  version = "1.0.0"
): PromptRecord {
  const prompt = PROMPTS.find((p) => p.task === task && p.version === version);
  if (!prompt) {
    // Fallback to any version of this task
    const fallback = PROMPTS.find((p) => p.task === task);
    if (fallback) return fallback;
    throw new Error(`No prompt found for task "${task}" version "${version}"`);
  }
  return prompt;
}

export function listPrompts(): PromptRecord[] {
  return PROMPTS;
}

export function listPromptsForTask(task: AiTaskName): PromptRecord[] {
  return PROMPTS.filter((p) => p.task === task);
}
