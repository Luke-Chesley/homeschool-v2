import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAppSession } from "@/lib/app-session/server";
import type { ChatMessage } from "@/lib/ai/types";
import { executeCopilotChat } from "@/lib/learning-core/copilot";

const LessonBlockSchema = z.object({
  type: z.string(),
  title: z.string(),
  minutes: z.number(),
  purpose: z.string(),
  teacher_action: z.string(),
  learner_action: z.string(),
  check_for: z.string().optional().nullable(),
  optional: z.boolean().optional(),
  materials_needed: z.array(z.string()).optional(),
});

const RequestSchema = z.object({
  lessonTitle: z.string().min(1),
  lessonFocus: z.string().min(1),
  blockIndex: z.number().int().min(0),
  block: LessonBlockSchema,
});

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const session = await requireAppSession();
  const { lessonTitle, lessonFocus, blockIndex, block } = parsed.data;

  const blockSummary = [
    `Lesson title: ${lessonTitle}`,
    `Lesson focus: ${lessonFocus}`,
    `Step number: ${blockIndex + 1}`,
    `Step type: ${block.type}`,
    `Step title: ${block.title}`,
    `Duration: ${block.minutes} minutes`,
    `Purpose: ${block.purpose}`,
    `Teacher action: ${block.teacher_action}`,
    `Learner action: ${block.learner_action}`,
    block.check_for ? `Look for: ${block.check_for}` : null,
    block.optional ? "This step is optional." : null,
    block.materials_needed && block.materials_needed.length > 0
      ? `Materials: ${block.materials_needed.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are writing inline lesson support for a homeschooling adult who may not know the topic well. " +
        "Answer only for the single lesson step provided. Do not regenerate or redesign the full lesson. " +
        "Keep the answer short and practical. Use three labeled parts in plain text: Meaning, What to do/say, Look for. " +
        "Mention simple teacher language the adult can use. If the topic is unfamiliar, briefly explain it in everyday terms.",
    },
    {
      role: "user",
      content:
        "Give concise step-specific help for this lesson block.\n\n" +
        `${blockSummary}\n\n` +
        "Constraints:\n" +
        "- 120 words max.\n" +
        "- Focus on this exact step only.\n" +
        "- Assume the adult may not know the subject.\n" +
        "- Be concrete, calm, and jargon-light.\n",
    },
  ];

  try {
    const result = await executeCopilotChat({
      messages,
      context: {
        learnerId: session.activeLearner.id,
        learnerName: session.activeLearner.displayName,
        standardIds: [],
        goalIds: [],
        feedbackNotes: [],
        recentOutcomes: [],
      },
      organizationId: session.organization.id,
      learnerId: session.activeLearner.id,
    });

    return NextResponse.json({ answer: result.artifact.answer.trim() });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not generate lesson step help.",
      },
      { status: 500 },
    );
  }
}
