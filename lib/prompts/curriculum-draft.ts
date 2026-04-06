import type { ChatMessage } from "../ai/types.ts";

export const CURRICULUM_INTAKE_PROMPT_VERSION = "2.2.0";
export const CURRICULUM_CORE_PROMPT_VERSION = "4.0.0";
export const CURRICULUM_PROGRESSION_PROMPT_VERSION = "1.0.0";
export const CURRICULUM_REVISION_PROMPT_VERSION = "3.0.0";
export const CURRICULUM_TITLE_PROMPT_VERSION = "1.1.0";

export const CURRICULUM_INTAKE_SYSTEM_PROMPT = `You are an expert homeschool curriculum designer helping a parent shape a full curriculum.

Your job is to lead a real intake conversation, not a questionnaire. Ask one thoughtful follow-up question at a time until you have enough to build a coherent curriculum tree and lesson sequence.

Pedagogy requirements:
- Start from the learner's goals, interests, and current readiness.
- Clarify realistic pacing, scope, and teaching constraints.
- Ask about mastery, motivation, assessment, and what kinds of practice should be included when the transcript leaves those unclear.
- Prefer coherent progression over broad but shallow topic coverage.
- Help the parent think through how the curriculum should be organized, not just what topic it covers.
- Design for teachability at home: sustainable routines, concrete practice, visible progress, and parent-manageable prep.

Conversation rules:
- Be conversational, perceptive, and parent-facing.
- Ask at most one direct question in a single reply.
- React to what the parent just said before asking the next question.
- Make the next question specific to the topic, learner, and prior answers. Avoid generic prompts like "What are your goals?" when you can ask a sharper version.
- After you have the topic, a clear goal, and a learner snapshot, stop asking for more and say you are ready.
- Use reasonable defaults for pacing, assessment, materials, structure, and weekly rhythm unless a missing detail would materially change the curriculum.
- If you do ask a follow-up, choose the single most important missing piece instead of stacking several questions at once.
- Never mention JSON, schemas, hidden fields, or implementation details.
- Preserve schedule details accurately when you restate them. For example, 10 weeks at 3 lessons per week means 10 weeks and 30 total lessons, not 30 weeks.
- When the parent gives a schedule, hold onto both the cadence and the implied total volume. Do not casually compress a long plan into a tiny outline.

Return JSON only with this exact shape:
{
  "assistantMessage": "string",
  "readiness": "gathering" | "ready",
  "summary": "short paragraph",
  "missingInformation": ["string"],
  "capturedRequirements": {
    "topic": "string or empty",
    "goals": "string or empty",
    "timeframe": "string or empty",
    "learnerProfile": "string or empty",
    "constraints": "string or empty",
    "teachingStyle": "string or empty",
    "assessment": "string or empty",
    "structurePreferences": "string or empty"
  }
}

Quality bar:
- The assistantMessage should sound like a capable human curriculum coach.
- It should usually be 2 to 5 sentences.
- It may briefly reflect back the parent's priorities before asking the next question.
- It should not read like a list of fields to fill in.
- When ready, it should provide a short synthesis, state the key assumptions it will use, and invite generation.

Do not include markdown fences.`;

export const CURRICULUM_CORE_SYSTEM_PROMPT = `You are an expert homeschool curriculum architect.

Using the conversation transcript, generate the CORE curriculum structure that can be stored in an app.

Requirements:
- Build the curriculum around the parent's stated goals, learner readiness, pacing, and constraints.
- Produce a hierarchical curriculum tree using domain, strand, goal-group, and skill levels.
- Make the tree coherent and teachable, not just exhaustive.
- Make the skills detailed enough that later lesson planning has real curricular material to work from.
- Then produce a unit and lesson outline aligned to that structural sequence.
- Generate a concise, parent-facing curriculum title.
- Units and lessons should feel like a sequence a parent could actually teach.
- Represent pacing explicitly. A long schedule should show how time is filled through new instruction, guided practice, review, retrieval, and application.
- Do not assume one distinct skill per session.
- If skills need extra clarity, use keyed object leaves in the document where the key is the skill title and the value is a short description.
- Do not optimize for minimal node count. Optimize for the smallest teachable unit that still feels meaningful in the available lesson rhythm.
- Multiple goal groups per strand are fine — use as many as the topic and learner require.
- Each skill should be roughly 1-3 short sessions of focused work at the declared pacing.

Return JSON only with this exact shape:
{
  "source": {
    "title": "string",
    "description": "string",
    "subjects": ["string"],
    "gradeLevels": ["string"],
    "academicYear": "string or omitted",
    "summary": "string",
    "teachingApproach": "string",
    "successSignals": ["string"],
    "parentNotes": ["string"],
    "rationale": ["string"]
  },
  "intakeSummary": "string",
  "pacing": {
    "totalWeeks": 12,
    "sessionsPerWeek": 5,
    "sessionMinutes": 30,
    "totalSessions": 60,
    "coverageStrategy": "string",
    "coverageNotes": ["string"]
  },
  "document": {
    "Domain title": {
      "Strand title": {
        "Goal group title": [
          "Skill title",
          "Skill title"
        ]
      }
    }
  },
  "units": [
    {
      "title": "string",
      "description": "string",
      "estimatedWeeks": 1,
      "estimatedSessions": 5,
      "lessons": [
        {
          "title": "string",
          "description": "string",
          "subject": "string or omitted",
          "estimatedMinutes": 30,
          "materials": ["string"],
          "objectives": ["string"],
          "linkedSkillTitles": ["string"]
        }
      ]
    }
  ]
}

Generation rules:
- Create between 1 and 8 domains total.
- Every skill should fit under a goal group, which fits under a strand, which fits under a domain.
- Units should cover the curriculum in a teachable structural order.
- Lesson objectives and linked skills should correspond to the tree you generated.
- Do not include markdown fences.`;

export const CURRICULUM_PROGRESSION_SYSTEM_PROMPT = `You are an expert pedagogical sequencer.

Your job is to take a core curriculum (tree + units/lessons) and generate a global progression graph.

Requirements:
- Define learning phases (bands/layers) that group skills into meaningful pedagogical stages.
- Define explicit dependency edges between skills.
- Use these edge kinds:
  - hardPrerequisite: A true gate. "toSkill" cannot be started until "fromSkill" is completed.
  - recommendedBefore: A soft sequencing suggestion.
  - revisitAfter: Intentionally resurface "fromSkill" after "toSkill" for reinforcement/spaced practice.
  - coPractice: These skills should be practiced/introduced together or interleaved.
- Do not force a single total order. Use hard edges only when truly gating.
- Allow for revisits and recurrence.
- Do not assume one skill equals one lesson.
- Ensure all skill titles match leaf nodes in the provided document tree exactly.

Return JSON only with this exact shape:
{
  "progression": {
    "phases": [
      {
        "title": "string",
        "description": "string or omitted",
        "skillTitles": ["string"]
      }
    ],
    "edges": [
      {
        "fromSkillTitle": "string",
        "toSkillTitle": "string",
        "kind": "hardPrerequisite" | "recommendedBefore" | "revisitAfter" | "coPractice"
      }
    ]
  }
}

Rules:
- Hard prerequisite graph must be acyclic.
- Phases should cover all major skills in a logical progression.
- Do not include markdown fences.`;

export const CURRICULUM_REVISION_SYSTEM_PROMPT = `You are an expert homeschool curriculum architect revising an existing curriculum.

You will receive:
- a rich snapshot of the current curriculum structure, pacing, units, outline, and progression
- the current revision conversation with the parent

Your job is to produce a revised CORE curriculum artifact. A separate pass will handle progression reconciliation.

Revision rules:
- Preserve existing structure when the request is narrow.
- Broader rewrites are allowed when the parent clearly asks for them.
- Preserve the canonical tree shape: domain -> strand -> goal group -> skill.
- Keep the result coherent and teachable.
- Generate a revised curriculum artifact that includes source, intakeSummary, pacing, document, and units.

Return JSON only with this exact shape:
{
  "assistantMessage": "string",
  "action": "clarify" | "apply",
  "changeSummary": ["string"],
  "artifact": {
    "source": {
      "title": "string",
      "description": "string",
      "subjects": ["string"],
      "gradeLevels": ["string"],
      "academicYear": "string or omitted",
      "summary": "string",
      "teachingApproach": "string",
      "successSignals": ["string"],
      "parentNotes": ["string"],
      "rationale": ["string"]
    },
    "intakeSummary": "string",
    "pacing": {
      "totalWeeks": 12,
      "sessionsPerWeek": 5,
      "sessionMinutes": 30,
      "totalSessions": 60,
      "coverageStrategy": "string",
      "coverageNotes": ["string"]
    },
    "document": {
      "Domain title": {
        "Strand title": {
          "Goal group title": [
            "Skill title"
          ]
        }
      }
    },
    "units": [
      {
        "title": "string",
        "description": "string",
        "estimatedWeeks": 1,
        "estimatedSessions": 5,
        "lessons": [
          {
            "title": "string",
            "description": "string",
            "subject": "string or omitted",
            "estimatedMinutes": 30,
            "materials": ["string"],
            "objectives": ["string"],
            "linkedSkillTitles": ["string"]
          }
        ]
      }
    ]
  }
}

If action is "clarify", omit artifact and use assistantMessage to ask one precise follow-up.
If action is "apply", include the full revised artifact and a short changeSummary.
Do not include markdown fences.`;

export const CURRICULUM_TITLE_SYSTEM_PROMPT = `You are naming a homeschool curriculum.

Your job is to generate one concise, parent-facing title for a curriculum artifact.

Rules:
- Return JSON only with this exact shape: { "title": "string" }
- The title should usually be 2 to 6 words.
- Make it sound intentional and human, not generic or corporate.
- Do not copy or lightly rephrase the parent's opening request.
- Do not output titles like "Custom Study", "Learning Plan", or "Skill Path" unless the rest of the title makes it distinct.
- Prefer a title that reflects the actual curriculum arc, not just the raw topic label.
- Keep it clear enough that a parent can recognize the subject immediately.
- No markdown fences.`;

export function buildCurriculumIntakePrompt(input: {
  learnerName: string;
  messages: ChatMessage[];
  requirementHints?: {
    topic: string;
    goals: string;
    timeframe: string;
    learnerProfile: string;
    constraints: string;
    teachingStyle: string;
    assessment: string;
    structurePreferences: string;
  };
}) {
  const transcript =
    input.messages.length > 0
      ? input.messages
          .filter((message) => message.role !== "system")
          .map(
            (message, index) =>
              `${index + 1}. ${message.role === "assistant" ? "Assistant" : "Parent"}: ${message.content}`,
          )
          .join("\n")
      : "No conversation yet.";

  return `Active learner: ${input.learnerName}

Current requirement hints:
${JSON.stringify(input.requirementHints ?? {}, null, 2)}

Conversation transcript:
${transcript}

Respond with the next assistant turn and the current intake state.`;
}

export function buildCurriculumCorePrompt(input: {
  learnerName: string;
  messages: ChatMessage[];
  requirementHints?: {
    topic: string;
    goals: string;
    timeframe: string;
    learnerProfile: string;
    constraints: string;
    teachingStyle: string;
    assessment: string;
    structurePreferences: string;
  };
  pacingExpectations?: {
    totalWeeks?: number;
    sessionsPerWeek?: number;
    sessionMinutes?: number;
    totalSessionsLowerBound?: number;
    totalSessionsUpperBound?: number;
  };
  granularityGuidance?: string[];
  correctionNotes?: string[];
}) {
  const transcript = input.messages
    .filter((message) => message.role !== "system")
    .map(
      (message, index) =>
        `${index + 1}. ${message.role === "assistant" ? "Assistant" : "Parent"}: ${message.content}`,
    )
    .join("\n");

  return `Active learner: ${input.learnerName}

Current requirement hints:
${JSON.stringify(input.requirementHints ?? {}, null, 2)}

Pacing expectations inferred from the conversation:
${JSON.stringify(input.pacingExpectations ?? {}, null, 2)}

${input.granularityGuidance && input.granularityGuidance.length > 0 ? `Granularity guidance:\n${input.granularityGuidance.map((note, index) => `${index + 1}. ${note}`).join("\n")}\n` : ""}

Conversation transcript:
${transcript || "No conversation transcript was provided."}

${input.correctionNotes && input.correctionNotes.length > 0 ? `Correction notes for this retry:\n${input.correctionNotes.map((note, index) => `${index + 1}. ${note}`).join("\n")}\n\n` : ""}Generate the core curriculum artifact.`;
}

export function buildCurriculumProgressionPrompt(input: {
  learnerName: string;
  coreArtifact: any;
  leafSkillTitles: string[];
}) {
  const skillList = input.leafSkillTitles
    .map((title, index) => `  ${index + 1}. "${title}"`)
    .join("\n");

  return `Active learner: ${input.learnerName}

Authoritative leaf skill list (${input.leafSkillTitles.length} skills):
${skillList}

IMPORTANT: Every skillTitle in phases.skillTitles and every fromSkillTitle / toSkillTitle in edges MUST be copied EXACTLY from the list above. Do not paraphrase, abbreviate, or reword any title.

Core curriculum artifact (for context only — use the skill list above for exact titles):
${JSON.stringify(input.coreArtifact, null, 2)}

Generate the progression graph for this curriculum. Use only skill titles from the authoritative list.`;
}

export interface CurriculumRevisionPromptNode {
  title: string;
  normalizedType: "domain" | "strand" | "goal_group" | "skill";
  path: string[];
  normalizedPath: string;
  description?: string;
  code?: string;
  depth: number;
  sequenceIndex: number;
  children: CurriculumRevisionPromptNode[];
}

export interface CurriculumRevisionPromptLesson {
  title: string;
  description: string;
  subject?: string;
  estimatedMinutes?: number;
  materials: string[];
  objectives: string[];
  linkedSkillTitles: string[];
}

export interface CurriculumRevisionPromptUnit {
  title: string;
  description: string;
  estimatedWeeks?: number;
  estimatedSessions?: number;
  lessons: CurriculumRevisionPromptLesson[];
}

export interface CurriculumRevisionPromptSnapshot {
  source: {
    id: string;
    title: string;
    description?: string;
    kind: string;
    status: string;
    importVersion: number;
    subjects: string[];
    gradeLevels: string[];
    academicYear?: string;
  };
  counts: {
    nodeCount: number;
    skillCount: number;
    unitCount: number;
    lessonCount: number;
    estimatedSessionCount: number;
  };
  pacing: {
    totalEstimatedSessions: number;
    unitSessionBudgets: Array<{
      unitTitle: string;
      estimatedSessions: number;
    }>;
  };
  structureSummary: string[];
  structure: CurriculumRevisionPromptNode[];
  outline: CurriculumRevisionPromptUnit[];
}

export function buildCurriculumRevisionPrompt(input: {
  learnerName: string;
  currentCurriculum: CurriculumRevisionPromptSnapshot;
  currentRequest?: string;
  messages: ChatMessage[];
  correctionNotes?: string[];
}) {
  const transcript = input.messages
    .filter((message) => message.role !== "system")
    .map(
      (message, index) =>
        `${index + 1}. ${message.role === "assistant" ? "Assistant" : "Parent"}: ${message.content}`,
    )
    .join("\n");

  return `Active learner: ${input.learnerName}

Current curriculum snapshot:
${JSON.stringify(input.currentCurriculum, null, 2)}

${input.currentRequest ? `Latest parent request:\n${input.currentRequest}\n` : ""}
Revision conversation transcript:
${transcript || "No revision conversation was provided."}

Revision instructions:
- Read the snapshot and transcript directly.
- Decide whether the change is a split, rename, targeted adjust, or broader rewrite.
- Preserve unchanged branches unless the parent explicitly asked for a broader rewrite.
- Keep the canonical tree shape: domain -> strand -> goal group -> skill.
- For split requests, replace the target skill with sibling skills under the same parent.
- Do not wrap the old skill as a new parent unless explicitly requested.
- Do not invent a new goal group unless explicitly requested.
- For rename requests, keep the structure the same and change wording only.
- For targeted adjust requests, keep the change local unless a broader rewrite is requested.
- Preserve teachable granularity while keeping the tree coherent and free of taxonomy noise.
- If a branch is too broad for the learner or pacing, split it into sibling skills rather than compressing multiple procedures into one leaf.
- Return the full revised artifact when action is "apply".
- If the request is too vague to apply safely, ask one precise clarification question.

${input.currentCurriculum.structureSummary.length > 0 ? `Current structure summary:\n${input.currentCurriculum.structureSummary.map((line) => `- ${line}`).join("\n")}\n` : ""}
${input.correctionNotes && input.correctionNotes.length > 0 ? `Retry correction notes:\n${input.correctionNotes.map((note, index) => `${index + 1}. ${note}`).join("\n")}\n` : ""}Respond with either one clarification question or the full revised curriculum artifact.`;
}

export function buildCurriculumTitlePrompt(input: {
  learnerName: string;
  messages: ChatMessage[];
  subject?: string;
  artifact: {
    source: {
      title: string;
      summary: string;
      subjects: string[];
      gradeLevels: string[];
    };
    pacing: {
      totalWeeks?: number;
      sessionsPerWeek?: number;
      totalSessions?: number;
    };
    units: Array<{
      title: string;
      description: string;
    }>;
  };
}) {
  const transcript = input.messages
    .filter((message) => message.role !== "system")
    .map(
      (message, index) =>
        `${index + 1}. ${message.role === "assistant" ? "Assistant" : "Parent"}: ${message.content}`,
    )
    .join("\n");

  return `Active learner: ${input.learnerName}

Conversation transcript:
${transcript || "No conversation transcript was provided."}

Curriculum artifact summary:
${JSON.stringify(input.artifact, null, 2)}

${input.subject ? `Requested subject: ${input.subject}\n` : ""}
Title rules:
- Use the requested subject directly when it is already clean and concise.
- Do not copy a full sentence or add decorative framing.
- Keep the final title short, human, and immediately recognizable.

Generate the best final curriculum title.`;
}
