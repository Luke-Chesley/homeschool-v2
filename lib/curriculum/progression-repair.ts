/**
 * Bounded repair pass for "almost valid" progression drafts.
 *
 * When a progression draft parses and passes schema validation but fails
 * semantic validation due to missing/invalid skillRefs or coverage gaps,
 * we run one structured repair prompt instead of throwing away the draft.
 *
 * NOTE: This module does NOT import from ai-draft-service.ts to avoid a
 * circular dependency. The caller passes a `parseFn` instead.
 */

import "@/lib/server-only";

import type { CurriculumAiProgression } from "./ai-draft.ts";
import type { ProgressionValidationResult } from "./progression-validation.ts";

export interface ProgressionRepairAttempt {
  attempted: boolean;
  success: boolean;
  repairedProgression: CurriculumAiProgression | null;
  rawResponse: string | null;
  failureReason: string | null;
}

type ParseResult =
  | { kind: "success"; progression: CurriculumAiProgression }
  | { kind: "parse_failure" | "schema_failure" };

export async function repairProgressionDraft(params: {
  catalog: Array<{ skillRef: string; title: string }>;
  invalidDraft: CurriculumAiProgression;
  validationResult: ProgressionValidationResult;
  systemPrompt: string;
  complete: (options: {
    model: string;
    temperature: number;
    maxTokens?: number;
    systemPrompt: string;
    messages: Array<{ role: string; content: string }>;
  }) => Promise<{ content: string }>;
  model: string;
  parseFn: (content: string) => ParseResult;
}): Promise<ProgressionRepairAttempt> {
  const { catalog, invalidDraft, validationResult, systemPrompt, complete, model, parseFn } = params;

  const { missingSkillRefs, duplicateAssignedSkillRefs, invalidPhaseSkillRefs } = validationResult;

  const catalogLines = catalog
    .map((r, i) => `${i + 1}. skillRef="${r.skillRef}" title="${r.title}"`)
    .join("\n");

  const missingBlock =
    missingSkillRefs.length > 0
      ? `\nMISSING from all phases (${missingSkillRefs.length}):\n${missingSkillRefs.map((r) => `  - "${r}"`).join("\n")}`
      : "";

  const duplicateBlock =
    duplicateAssignedSkillRefs.length > 0
      ? `\nDUPLICATE phase assignments (must appear in exactly one phase):\n${duplicateAssignedSkillRefs.map((r) => `  - "${r}"`).join("\n")}`
      : "";

  const invalidBlock =
    invalidPhaseSkillRefs.length > 0
      ? `\nINVALID refs in phases (not in catalog — remove them):\n${invalidPhaseSkillRefs.map((r) => `  - "${r}"`).join("\n")}`
      : "";

  const repairUserPrompt = `You previously generated a curriculum progression that failed validation. Please repair it.

## Authoritative skill catalog (${catalog.length} skills — use these skillRefs exactly):

${catalogLines}

## Validation failures to fix:
${missingBlock}${duplicateBlock}${invalidBlock}

## Your previous draft (repair this, do not regenerate from scratch):

${JSON.stringify({ progression: invalidDraft }, null, 2)}

## Repair instructions:

1. Every skillRef from the catalog must appear in exactly one phase.
2. Assign all ${missingSkillRefs.length} missing skillRefs to an appropriate phase.
3. Remove any duplicate phase assignments — each skillRef must appear in only one phase.
4. Remove or fix any invalid skillRefs that are not in the catalog.
5. Keep phase titles from the previous draft if they still make sense.
6. Remove any edges whose fromSkillRef or toSkillRef is not in the catalog.
7. Return ONLY valid JSON in the exact same schema — no prose, no markdown fences.

Required JSON shape:
{
  "progression": {
    "phases": [{ "title": "string", "description": "string (optional)", "skillRefs": ["skillRef", ...] }],
    "edges": [{ "fromSkillRef": "string", "toSkillRef": "string", "kind": "hardPrerequisite|recommendedBefore|revisitAfter|coPractice" }]
  }
}`;

  try {
    const response = await complete({
      model,
      temperature: 0.1,
      maxTokens: 4096,
      systemPrompt,
      messages: [{ role: "user", content: repairUserPrompt }],
    });

    const rawResponse = response.content;
    const parsed = parseFn(rawResponse);

    if (parsed.kind !== "success") {
      return {
        attempted: true,
        success: false,
        repairedProgression: null,
        rawResponse,
        failureReason: `Repair response failed ${parsed.kind}`,
      };
    }

    return {
      attempted: true,
      success: true,
      repairedProgression: parsed.progression,
      rawResponse,
      failureReason: null,
    };
  } catch (error) {
    return {
      attempted: true,
      success: false,
      repairedProgression: null,
      rawResponse: null,
      failureReason: `Repair model call failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
