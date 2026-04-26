import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  isAppApiSessionError,
  requireAppApiSession,
} from "@/lib/app-session/server";
import { executeTopicSuggest } from "@/lib/learning-core/topic-suggestions";

const TopicSuggestionsRequestSchema = z
  .object({
    query: z.string().trim().min(2).max(120),
    learner: z.string().trim().min(1).max(120).nullable().optional(),
    timeframe: z.string().trim().min(1).max(120).nullable().optional(),
    localSuggestions: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  })
  .strict();

function normalizeSuggestion(value: string) {
  return value.replace(/\s+/g, " ").trim().replace(/[.。]+$/u, "");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = TopicSuggestionsRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid topic suggestion input.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const session = await requireAppApiSession({ requireLearner: false });
    const result = await executeTopicSuggest({
      input: {
        query: parsed.data.query,
        learner: parsed.data.learner ?? session.activeLearner?.displayName ?? null,
        timeframe: parsed.data.timeframe ?? null,
        local_suggestions: parsed.data.localSuggestions,
        max_suggestions: 8,
      },
      organizationId: session.organization.id,
      learnerId: session.activeLearner?.id ?? null,
    });

    const localKeys = new Set(parsed.data.localSuggestions.map((value) => normalizeSuggestion(value).toLowerCase()));
    const suggestions = result.artifact.suggestions
      .map((suggestion) => normalizeSuggestion(suggestion.topic))
      .filter((suggestion) => suggestion.length >= 2)
      .filter((suggestion, index, suggestionsList) => {
        const key = suggestion.toLowerCase();
        return !localKeys.has(key) && suggestionsList.findIndex((item) => item.toLowerCase() === key) === index;
      })
      .slice(0, 8);

    return NextResponse.json({ suggestions });
  } catch (error) {
    if (isAppApiSessionError(error)) {
      return NextResponse.json(
        { error: error.message, suggestions: [] },
        { status: error.status },
      );
    }
    console.error("[api/curriculum/topic-suggestions POST]", error);
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }
}
