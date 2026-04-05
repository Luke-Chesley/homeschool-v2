import type { ZodType } from "zod";

import { CurriculumAiRevisionTurnSchema, type CurriculumAiRevisionTurn } from "./ai-draft.ts";
import {
  buildCurriculumRevisionPrompt,
  type CurriculumRevisionPromptSnapshot,
} from "../prompts/curriculum-draft.ts";

type RevisionChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export interface RevisionModelClient {
  completeJson<T>(options: {
    model: string;
    temperature?: number;
    systemPrompt: string;
    outputSchema: ZodType<T>;
    messages: RevisionChatMessage[];
  }): Promise<T | null>;
}

export interface RevisionModelLogger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

const DEFAULT_CORRECTION_NOTES = [
  "Return valid JSON matching the schema.",
  "Preserve the canonical tree shape.",
  "For split requests, replace the target skill with sibling skills under the same parent.",
  "Do not create a new goal group unless the request explicitly asks for one.",
];

export async function runCurriculumRevisionDecision(params: {
  learnerName: string;
  messages: RevisionChatMessage[];
  snapshot: CurriculumRevisionPromptSnapshot;
  model: string;
  systemPrompt: string;
  completeJson: RevisionModelClient["completeJson"];
  logger?: RevisionModelLogger;
}): Promise<CurriculumAiRevisionTurn> {
  const logger = params.logger ?? console;
  const messages = normalizeRevisionMessages(params.messages);
  const currentRequest = getLatestUserMessage(messages);
  const snapshotSummary = buildRevisionPromptSummary(params.snapshot);

  logger.info("[curriculum/ai-draft] revision prompt payload", {
    learnerName: params.learnerName,
    currentRequest,
    snapshotSummary,
  });

  const retryNotes: string[][] = [
    [],
    DEFAULT_CORRECTION_NOTES,
  ];

  for (const [attemptIndex, correctionNotes] of retryNotes.entries()) {
    logger.info("[curriculum/ai-draft] revision model attempt", {
      attempt: attemptIndex + 1,
      retried: attemptIndex > 0,
    });

    try {
      const parsedTurn = await params.completeJson({
        model: params.model,
        temperature: 0.2,
        systemPrompt: params.systemPrompt,
        outputSchema: CurriculumAiRevisionTurnSchema,
        messages: [
          {
            role: "user",
            content: buildCurriculumRevisionPrompt({
              learnerName: params.learnerName,
              currentCurriculum: params.snapshot,
              currentRequest,
              messages,
              correctionNotes,
            }),
          },
        ],
      });

      const validatedTurn = CurriculumAiRevisionTurnSchema.safeParse(parsedTurn);
      if (!validatedTurn.success) {
        logger.warn("[curriculum/ai-draft] revision turn failed schema validation", {
          attempt: attemptIndex + 1,
          issues: validatedTurn.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
        continue;
      }

      const turn = sanitizeRevisionTurn(validatedTurn.data);
      if (turn.action === "apply") {
        validateRevisionArtifactStructure(turn.artifact);
      }

      logger.info("[curriculum/ai-draft] revision model response", {
        attempt: attemptIndex + 1,
        action: turn.action,
        changeSummaryCount: turn.changeSummary.length,
        hasArtifact: Boolean(turn.artifact),
        artifact: turn.artifact
          ? {
              domainCount: Object.keys(turn.artifact.document).length,
              unitCount: turn.artifact.units.length,
              lessonCount: turn.artifact.units.reduce(
                (total, unit) => total + unit.lessons.length,
                0,
              ),
            }
          : null,
      });

      return turn;
    } catch (error) {
      logger.warn("[curriculum/ai-draft] revision model attempt failed", {
        attempt: attemptIndex + 1,
        error,
      });
    }
  }

  logger.error("[curriculum/ai-draft] revision model failed twice; returning clarify");
  return {
    assistantMessage:
      "I couldn't produce a valid revision from the model output. Please restate the change in one sentence.",
    action: "clarify",
    changeSummary: [
      "The revision request could not be applied from the current model output.",
    ],
  };
}

export function buildRevisionPromptSummary(snapshot: CurriculumRevisionPromptSnapshot) {
  return {
    sourceTitle: snapshot.source.title,
    sourceKind: snapshot.source.kind,
    sourceStatus: snapshot.source.status,
    counts: snapshot.counts,
    pacing: snapshot.pacing,
    topLevelDomains: snapshot.structure.map((node) => node.title),
    structureSummary: snapshot.structureSummary,
    unitTitles: snapshot.outline.map((unit) => unit.title),
    lessonCount: snapshot.outline.reduce((total, unit) => total + unit.lessons.length, 0),
    linkedSkillTitles: snapshot.outline.flatMap((unit) =>
      unit.lessons.flatMap((lesson) => lesson.linkedSkillTitles),
    ),
  };
}

function normalizeRevisionMessages(messages: RevisionChatMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content.trim(),
  }));
}

function getLatestUserMessage(messages: RevisionChatMessage[]) {
  for (const message of [...messages].reverse()) {
    if (message.role === "user" && message.content.trim()) {
      return message.content.trim();
    }
  }

  return "";
}

function sanitizeRevisionTurn(turn: CurriculumAiRevisionTurn): CurriculumAiRevisionTurn {
  return {
    ...turn,
    assistantMessage: turn.assistantMessage.trim(),
    changeSummary: uniqueNonEmpty(turn.changeSummary),
    artifact: turn.artifact ? sanitizeRevisionArtifact(turn.artifact) : undefined,
  };
}

function sanitizeRevisionArtifact(
  artifact: NonNullable<CurriculumAiRevisionTurn["artifact"]>,
): NonNullable<CurriculumAiRevisionTurn["artifact"]> {
  return {
    ...artifact,
    source: {
      ...artifact.source,
      title: artifact.source.title.trim(),
      description: artifact.source.description.trim(),
      summary: artifact.source.summary.trim(),
      teachingApproach: artifact.source.teachingApproach.trim(),
      subjects: uniqueNonEmpty(artifact.source.subjects),
      gradeLevels: uniqueNonEmpty(artifact.source.gradeLevels),
      successSignals: uniqueNonEmpty(artifact.source.successSignals),
      parentNotes: uniqueNonEmpty(artifact.source.parentNotes),
      rationale: uniqueNonEmpty(artifact.source.rationale),
    },
    intakeSummary: artifact.intakeSummary.trim(),
    pacing: {
      ...artifact.pacing,
      coverageStrategy: artifact.pacing.coverageStrategy.trim(),
      coverageNotes: uniqueNonEmpty(artifact.pacing.coverageNotes),
    },
    document: artifact.document,
    units: artifact.units.map((unit) => ({
      ...unit,
      title: unit.title.trim(),
      description: unit.description.trim(),
      lessons: unit.lessons.map((lesson) => ({
        ...lesson,
        title: lesson.title.trim(),
        description: lesson.description.trim(),
        subject: lesson.subject?.trim() || undefined,
        materials: uniqueNonEmpty(lesson.materials),
        objectives: uniqueNonEmpty(lesson.objectives),
        linkedSkillTitles: uniqueNonEmpty(lesson.linkedSkillTitles),
      })),
    })),
  };
}

function validateRevisionArtifactStructure(artifact: CurriculumAiRevisionTurn["artifact"]) {
  if (!artifact) {
    throw new Error("Revision artifact is missing.");
  }

  if (Object.keys(artifact.document).length === 0) {
    throw new Error("Revision artifact document is empty.");
  }

  if (artifact.units.length === 0) {
    throw new Error("Revision artifact units are empty.");
  }

  if (countDocumentSkills(artifact.document) === 0) {
    throw new Error("Revision artifact does not contain any skills.");
  }
}

function countDocumentSkills(node: unknown): number {
  if (typeof node === "string") {
    return 1;
  }

  if (Array.isArray(node)) {
    return node.reduce((total, child) => total + countDocumentSkills(child), 0);
  }

  if (!node || typeof node !== "object") {
    return 0;
  }

  return Object.values(node).reduce((total, child) => total + countDocumentSkills(child), 0);
}

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  const next: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    next.push(trimmed);
  }

  return next;
}
