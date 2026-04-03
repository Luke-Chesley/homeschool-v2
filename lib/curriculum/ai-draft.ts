import { z } from "zod";

export const CurriculumAiDraftQuestionIdSchema = z.enum([
  "topic",
  "goals",
  "timeframe",
  "learnerProfile",
  "constraints",
]);

export type CurriculumAiDraftQuestionId = z.infer<typeof CurriculumAiDraftQuestionIdSchema>;

export interface CurriculumAiDraftQuestion {
  id: CurriculumAiDraftQuestionId;
  prompt: string;
  helperText: string;
  placeholder: string;
  suggestedReplies: string[];
}

export function buildCurriculumAiDraftQuestions(
  learnerName: string,
): CurriculumAiDraftQuestion[] {
  return [
    {
      id: "topic",
      prompt: `What does ${learnerName} want to learn or explore right now?`,
      helperText:
        "Start with the topic, interest, or experience you want this curriculum to revolve around.",
      placeholder: "For example: I want to build a chess curriculum for my child.",
      suggestedReplies: [
        "We want to learn about chess.",
        "I want a hands-on nature study around birds and habitats.",
        "We need a writing curriculum focused on personal narratives.",
      ],
    },
    {
      id: "goals",
      prompt: "What do you hope will be true by the end of this plan?",
      helperText:
        "Name the skills, habits, or products you want to see so the draft can aim at clear outcomes.",
      placeholder: "Describe the goals, milestones, or visible outcomes you want.",
      suggestedReplies: [
        "I want them to understand the rules, notation, and basic strategy.",
        "I want confidence, consistency, and a project they can show off.",
        "I want a balance of knowledge, practice, and independent work.",
      ],
    },
    {
      id: "timeframe",
      prompt: "How much time do you want to plan for, and what pace is realistic?",
      helperText:
        "A strong draft needs pacing, session length, and planning horizon, not just content coverage.",
      placeholder: "For example: 6 weeks, three 30-minute sessions per week.",
      suggestedReplies: [
        "About 6 weeks with three 30-minute sessions each week.",
        "A one-month unit with short daily lessons.",
        "A semester-long study with two deeper sessions each week.",
      ],
    },
    {
      id: "learnerProfile",
      prompt: `What does ${learnerName} already know, and what support do they need?`,
      helperText:
        "Prior knowledge, confidence, attention, and challenge level should shape the sequence.",
      placeholder: "Share what they already know, where they struggle, and how they learn best.",
      suggestedReplies: [
        "They know the basic moves but need help thinking ahead.",
        "They are curious but get discouraged when work feels too open-ended.",
        "They learn best with visuals, discussion, and short practice bursts.",
      ],
    },
    {
      id: "constraints",
      prompt: "Are there any materials, routines, or non-negotiables I should plan around?",
      helperText:
        "Include available resources, preferred formats, assessment ideas, and any family constraints.",
      placeholder: "Mention books, tools, outings, routines, or things this plan should avoid.",
      suggestedReplies: [
        "We have a chess board, a few beginner books, and want offline practice.",
        "Please keep prep light and include project-based work.",
        "We need something flexible enough for mixed-energy days.",
      ],
    },
  ];
}

export const CurriculumAiDraftAnswerSchema = z.object({
  questionId: CurriculumAiDraftQuestionIdSchema,
  answer: z.string().trim().min(1).max(4_000),
});

export type CurriculumAiDraftAnswer = z.infer<typeof CurriculumAiDraftAnswerSchema>;

export const CurriculumAiDraftRequestSchema = z.object({
  answers: z.array(CurriculumAiDraftAnswerSchema).min(3),
});

export const CurriculumAiDraftSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(600),
  subjects: z.array(z.string().trim().min(1).max(80)).max(5).default([]),
  gradeLevels: z.array(z.string().trim().min(1).max(40)).max(4).default([]),
  academicYear: z.string().trim().min(1).max(80).optional(),
  summary: z.string().trim().min(1).max(900),
  teachingApproach: z.string().trim().min(1).max(300),
  successSignals: z.array(z.string().trim().min(1).max(200)).max(5).default([]),
  parentNotes: z.array(z.string().trim().min(1).max(240)).max(5).default([]),
  rationale: z.array(z.string().trim().min(1).max(240)).max(5).default([]),
});

export type CurriculumAiDraft = z.infer<typeof CurriculumAiDraftSchema>;

export const CurriculumAiDraftResponseSchema = z.object({
  draft: CurriculumAiDraftSchema,
});

export type CurriculumAiDraftResponse = z.infer<typeof CurriculumAiDraftResponseSchema>;
