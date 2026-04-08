import "@/lib/server-only";

import type { AiTaskName } from "@/lib/ai/types";
import { getRepositories } from "@/lib/db";
import { ensureDatabaseReady } from "@/lib/db/server";
import {
  CURRICULUM_CORE_PROMPT_VERSION,
  CURRICULUM_CORE_SYSTEM_PROMPT,
  CURRICULUM_INTAKE_PROMPT_VERSION,
  CURRICULUM_INTAKE_SYSTEM_PROMPT,
  CURRICULUM_PROGRESSION_PROMPT_VERSION,
  CURRICULUM_PROGRESSION_SYSTEM_PROMPT,
  CURRICULUM_REVISION_PROMPT_VERSION,
  CURRICULUM_REVISION_SYSTEM_PROMPT,
  CURRICULUM_TITLE_PROMPT_VERSION,
  CURRICULUM_TITLE_SYSTEM_PROMPT,
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
  id?: string;
}

// ---------------------------------------------------------------------------
// Prompt library
// ---------------------------------------------------------------------------

const STATIC_PROMPTS: PromptRecord[] = [
  {
    task: "curriculum.intake",
    version: CURRICULUM_INTAKE_PROMPT_VERSION,
    systemPrompt: CURRICULUM_INTAKE_SYSTEM_PROMPT,
    notes: "Conversational intake for AI curriculum drafting",
  },
  {
    task: "curriculum.generate",
    version: CURRICULUM_CORE_PROMPT_VERSION,
    systemPrompt: CURRICULUM_CORE_SYSTEM_PROMPT,
    notes: "Alias prompt for async curriculum generation jobs",
  },
  {
    task: "curriculum.generate.core",
    version: CURRICULUM_CORE_PROMPT_VERSION,
    systemPrompt: CURRICULUM_CORE_SYSTEM_PROMPT,
    notes: "Pass 1: Core curriculum structure (tree + units + lessons)",
  },
  {
    task: "curriculum.generate.progression",
    version: CURRICULUM_PROGRESSION_PROMPT_VERSION,
    systemPrompt: CURRICULUM_PROGRESSION_SYSTEM_PROMPT,
    notes: "Global progression graph generation for a curriculum",
  },
  {
    task: "curriculum.revise.progression",
    version: CURRICULUM_PROGRESSION_PROMPT_VERSION,
    systemPrompt: CURRICULUM_PROGRESSION_SYSTEM_PROMPT,
    notes: "Global progression graph reconciliation after curriculum revision",
  },
  {
    task: "curriculum.revise",
    version: CURRICULUM_REVISION_PROMPT_VERSION,
    systemPrompt: CURRICULUM_REVISION_SYSTEM_PROMPT,
    notes: "Structured curriculum revision for existing sources",
  },
  {
    task: "curriculum.title",
    version: CURRICULUM_TITLE_PROMPT_VERSION,
    systemPrompt: CURRICULUM_TITLE_SYSTEM_PROMPT,
    notes: "Concise curriculum title generation",
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

function resolveStaticPrompt(
  task: AiTaskName,
  version = "1.0.0"
): PromptRecord {
  const prompt = STATIC_PROMPTS.find((p) => p.task === task && p.version === version);
  if (!prompt) {
    // Fallback to any version of this task
    const fallback = STATIC_PROMPTS.find((p) => p.task === task);
    if (fallback) return fallback;
    throw new Error(`No prompt found for task "${task}" version "${version}"`);
  }
  return prompt;
}

let seedPromise: Promise<void> | null = null;

async function ensurePromptTemplatesSeeded() {
  if (seedPromise) {
    return seedPromise;
  }

  seedPromise = (async () => {
    await ensureDatabaseReady();
    const repos = getRepositories();

    await Promise.all(
      STATIC_PROMPTS.map((prompt) =>
        repos.aiPlatform.upsertPromptTemplate({
          organizationId: null,
          taskName: prompt.task,
          version: prompt.version,
          status: "active",
          label: `${prompt.task}:${prompt.version}`,
          systemPrompt: prompt.systemPrompt,
          userTemplate: prompt.userTemplate ?? null,
          notes: prompt.notes ?? null,
          isDefault: true,
          createdByAdultUserId: null,
          metadata: {
            source: "static-seed",
          },
        }),
      ),
    );
  })().catch((error) => {
    seedPromise = null;
    throw error;
  });

  return seedPromise;
}

export async function resolvePrompt(
  task: AiTaskName,
  version = "1.0.0",
  organizationId?: string | null,
): Promise<PromptRecord> {
  await ensurePromptTemplatesSeeded();

  const repos = getRepositories();
  const prompt = await repos.aiPlatform.findPromptTemplate({
    organizationId: organizationId ?? null,
    taskName: task,
    version,
  });

  if (!prompt) {
    return resolveStaticPrompt(task, version);
  }

  return {
    id: prompt.id,
    task: prompt.taskName as AiTaskName,
    version: prompt.version,
    systemPrompt: prompt.systemPrompt,
    userTemplate: prompt.userTemplate ?? undefined,
    notes: prompt.notes ?? undefined,
  };
}

export async function listPrompts(
  task?: AiTaskName,
  organizationId?: string | null,
): Promise<PromptRecord[]> {
  await ensurePromptTemplatesSeeded();
  const prompts = await getRepositories().aiPlatform.listPromptTemplates(task, organizationId ?? null);

  return prompts.map((prompt) => ({
    id: prompt.id,
    task: prompt.taskName as AiTaskName,
    version: prompt.version,
    systemPrompt: prompt.systemPrompt,
    userTemplate: prompt.userTemplate ?? undefined,
    notes: prompt.notes ?? undefined,
  }));
}

export async function listPromptsForTask(
  task: AiTaskName,
  organizationId?: string | null,
): Promise<PromptRecord[]> {
  return listPrompts(task, organizationId);
}
