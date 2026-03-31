/**
 * Mock AI provider adapter.
 *
 * Returns deterministic, realistic-looking responses for development.
 * Replaces with a real provider adapter (Anthropic, OpenAI, etc.) in
 * production by updating the adapter registry.
 *
 * Integration point: wire up real adapters in lib/ai/registry.ts once
 * API keys are provisioned.
 */

import type {
  AiProviderAdapter,
  CompletionOptions,
  CompletionResult,
  StreamChunk,
  StructuredCompletionOptions,
} from "./provider-adapter";

// ---------------------------------------------------------------------------
// Mock response templates
// ---------------------------------------------------------------------------

const MOCK_RESPONSES: Record<string, string> = {
  "chat.answer": `That's a great question! Based on the curriculum context you've shared, here are my thoughts:

**Key considerations:**
- The learner's current progress suggests they're ready for the next concept
- The standards we've mapped align well with this topic
- I'd suggest building on the place value work from last week

Would you like me to draft a lesson outline or suggest some practice activities?`,

  "lesson.draft": `# Lesson Draft: Place Value to 100,000

## Learning Objectives
- Students will read and write numbers up to 100,000 in standard, word, and expanded form
- Students will identify the value of each digit in a multi-digit number

## Materials Needed
- Place value chart (hundreds of thousands through ones)
- Number cards 0–9
- Student workbook pages 7–12

## Lesson Sequence (45 minutes)

### Warm-Up (5 min)
Review numbers to 10,000 using the place value chart from yesterday.

### Direct Instruction (15 min)
Introduce the ten-thousands and hundred-thousands places using concrete examples.

### Guided Practice (15 min)
Work through 3–4 examples together, building from 10,000 to 100,000.

### Independent Practice (10 min)
Students complete workbook pages 7–9.`,

  "standards.suggest": `Based on the objective text, here are the most relevant standards:

**Primary match:** CCSS.MATH.CONTENT.4.NBT.A.2
Read and write multi-digit whole numbers using base-ten numerals, number names, and expanded form.

**Supporting:** CCSS.MATH.CONTENT.4.NBT.A.1
Recognize that in a multi-digit whole number, a digit in one place represents ten times what it represents in the place to its right.`,

  default: `I've processed your request and have a response ready. Let me know if you'd like me to expand on any part of this.`,
};

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

export class MockAiAdapter implements AiProviderAdapter {
  readonly providerId = "mock";
  readonly displayName = "Mock (Development)";

  private getResponse(messages: CompletionOptions["messages"]): string {
    // Try to infer task from system prompt or last user message
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const content = lastUser?.content?.toLowerCase() ?? "";

    if (content.includes("lesson") || content.includes("draft")) {
      return MOCK_RESPONSES["lesson.draft"];
    }
    if (content.includes("standard") || content.includes("ccss")) {
      return MOCK_RESPONSES["standards.suggest"];
    }
    return MOCK_RESPONSES["chat.answer"];
  }

  async complete(options: CompletionOptions): Promise<CompletionResult> {
    // Simulate latency
    await new Promise((r) => setTimeout(r, 80));

    return {
      content: this.getResponse(options.messages),
      usage: { promptTokens: 150, completionTokens: 200 },
      model: options.model ?? "mock-model-1",
    };
  }

  async *stream(options: CompletionOptions): AsyncIterable<StreamChunk> {
    const full = this.getResponse(options.messages);
    const words = full.split(" ");

    for (let i = 0; i < words.length; i++) {
      await new Promise((r) => setTimeout(r, 25));
      yield { delta: (i === 0 ? "" : " ") + words[i], done: false };
    }

    yield { delta: "", done: true };
  }

  async completeJson<T>(options: StructuredCompletionOptions<T>): Promise<T | null> {
    const response = await this.complete(options);
    try {
      const parsed = JSON.parse(response.content) as unknown;
      if (!options.outputSchema) {
        return parsed as T;
      }
      const validated = options.outputSchema.safeParse(parsed);
      return validated.success ? validated.data : null;
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _mockAdapter: MockAiAdapter | null = null;

export function getMockAdapter(): MockAiAdapter {
  if (!_mockAdapter) _mockAdapter = new MockAiAdapter();
  return _mockAdapter;
}
