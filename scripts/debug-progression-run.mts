import "@/lib/server-only";
import { parseArgs } from "util";
import { getDb } from "@/lib/db/server";
import {
  curriculumNodes,
  curriculumProgressionState,
  curriculumPhases,
  curriculumPhaseNodes,
  curriculumSkillPrerequisites,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurriculumSource } from "@/lib/curriculum/service";
import { generateCurriculumProgression } from "@/lib/curriculum/ai-draft-service";
import { resolvePrompt } from "@/lib/prompts/store";
import { getLearningCoreGatewayAdapter } from "@/lib/ai/learning-core-adapter";
import {
  buildCurriculumProgressionPrompt,
  CURRICULUM_PROGRESSION_PROMPT_VERSION,
} from "@/lib/prompts/curriculum-draft";
import * as fs from "fs/promises";
import * as path from "path";

async function main() {
  const { values } = parseArgs({
    options: {
      "source-id": { type: "string" },
      "learner-name": { type: "string", default: "Learner" },
      "model-task": { type: "string", default: "curriculum.generate.progression" },
      "skip-repair": { type: "boolean", default: false },
      "single-attempt": { type: "boolean", default: false },
      "max-output-tokens": { type: "string" },
      temperature: { type: "string" },
      "household-id": { type: "string" },
    },
  });

  const sourceId = values["source-id"];
  if (!sourceId) {
    console.error("Missing --source-id");
    process.exit(1);
  }

  const householdId = values["household-id"];
  if (!householdId) {
    console.error("Missing --household-id (required to load source)");
    process.exit(1);
  }

  const learnerName = values["learner-name"]!;
  const modelTask = values["model-task"] as any;
  const skipRepair = values["skip-repair"];
  const singleAttempt = values["single-attempt"];
  const maxOutputTokens = values["max-output-tokens"] ? parseInt(values["max-output-tokens"]) : undefined;
  const temperature = values["temperature"] ? parseFloat(values["temperature"]) : undefined;

  console.log(`\n=== Progression Debug Run ===`);
  console.log(`Source ID: ${sourceId}`);
  console.log(`Learner: ${learnerName}`);
  console.log(`Task: ${modelTask}`);
  if (maxOutputTokens) console.log(`Max Output Tokens: ${maxOutputTokens}`);
  if (temperature) console.log(`Temperature: ${temperature}`);

  const db = getDb();

  // 1. Query DB state before
  console.log(`\n--- DB State (Before) ---`);
  await printDbSummary(db, sourceId);

  // 2. Load source + skill nodes
  const source = await getCurriculumSource(sourceId, householdId);
  if (!source) {
    console.error(`Source not found: ${sourceId}`);
    process.exit(1);
  }

  const skillNodes = await db
    .select({
      id: curriculumNodes.id,
      title: curriculumNodes.title,
      normalizedType: curriculumNodes.normalizedType,
    })
    .from(curriculumNodes)
    .where(eq(curriculumNodes.sourceId, sourceId))
    .then((rows) => rows.filter((r) => r.normalizedType === "skill" && r.title));

  console.log(`Loaded ${skillNodes.length} skill nodes.`);

  const skillRefs = skillNodes.map((n) => ({ skillId: n.id, skillTitle: n.title }));

  // 3. Build prompts
  const promptTemplate = await resolvePrompt(modelTask, CURRICULUM_PROGRESSION_PROMPT_VERSION);
  const userPrompt = buildCurriculumProgressionPrompt({
    learnerName,
    sourceTitle: source.title,
    sourceSummary: source.description || undefined,
    skillCatalog: skillRefs.map((r) => ({ skillRef: r.skillId, title: r.skillTitle })),
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const debugDir = path.join("tmp", "progression-debug", sourceId, timestamp);
  await fs.mkdir(debugDir, { recursive: true });

  await fs.writeFile(path.join(debugDir, "prompt.system.txt"), promptTemplate.systemPrompt);
  await fs.writeFile(path.join(debugDir, "prompt.user.txt"), userPrompt);

  // Save run manifest with all static metadata known up front.
  const manifestInitial = {
    runId: timestamp,
    sourceId,
    learnerName,
    promptVersion: CURRICULUM_PROGRESSION_PROMPT_VERSION,
    skillCount: skillNodes.length,
    timestamp: new Date().toISOString(),
  };
  await fs.writeFile(path.join(debugDir, "manifest.json"), JSON.stringify(manifestInitial, null, 2));

  console.log(`Prompts saved to ${debugDir}`);

  // 4. Run progression generation
  console.log(`\n--- Running Generation ---`);
  
  const result = await generateCurriculumProgression(
    {
      learner: { displayName: learnerName },
      artifact: {
        source: {
          title: source.title,
          description: source.description || source.title,
          summary: source.description || source.title,
        },
        document: { Skills: {} }, // Mock artifact
      } as any,
      skillRefs,
    },
    {
      resolvePrompt: async () => promptTemplate,
      complete: async (options) => {
        const adapter = getLearningCoreGatewayAdapter();
        const finalOptions = {
          ...options,
          ...(maxOutputTokens ? { maxTokens: maxOutputTokens } : {}),
          ...(temperature !== undefined ? { temperature } : {}),
        };
        console.log(`Calling adapter with options:`, {
          model: finalOptions.model,
          temperature: finalOptions.temperature,
          maxTokens: finalOptions.maxTokens,
        });
        return adapter.complete(finalOptions);
      },
    }
  );

  // 5. Analyze and save attempts
  console.log(`\n--- Results Analysis ---`);
  console.log(`Success: ${result.progression ? "YES" : "NO"}`);
  console.log(`Attempt Count: ${result.attemptCount}`);

  for (const [i, attempt] of result.attempts.entries()) {
    const attemptDir = path.join(debugDir, `attempt-${i + 1}`);
    await fs.mkdir(attemptDir, { recursive: true });

    const prefix = path.join(attemptDir, `attempt-${i + 1}`);

    // ── Save effective settings ──────────────────────────────────────────────
    if (attempt.effectiveSettings) {
      await fs.writeFile(`${prefix}.settings.json`, JSON.stringify(attempt.effectiveSettings, null, 2));
    }

    if (attempt.rawResponse) {
      await fs.writeFile(`${prefix}.raw.txt`, attempt.rawResponse);

      const truncation = detectTruncation(attempt.rawResponse);
      console.log(`\nAttempt ${i + 1}:`);
      console.log(`- Raw Length: ${attempt.rawResponse.length}`);
      console.log(`- Truncated: ${truncation.looksTruncated} (${truncation.likelyCause})`);
      console.log(`- Parse Status: ${attempt.parseStatus} (${attempt.parseFailureKind ?? "ok"})`);
      console.log(`- Schema Status: ${attempt.schemaStatus}`);
      console.log(`- Semantic Status: ${attempt.semanticStatus}`);
      console.log(`- Accepted: ${attempt.accepted}`);

      if (attempt.adapterDebugMetadata) {
        await fs.writeFile(`${prefix}.adapter.json`, JSON.stringify(attempt.adapterDebugMetadata, null, 2));
        const meta = attempt.adapterDebugMetadata as any;
        const inputTokens = meta.rawPayload?.usage?.input_tokens ?? "?";
        const outputTokens = meta.rawPayload?.usage?.output_tokens ?? "?";
        console.log(`- Stop Reason: ${meta.stopReason} | Input tokens: ${inputTokens} | Output tokens: ${outputTokens}`);
        if (meta.stopReason && meta.stopReason !== "end_turn") {
          console.log(`  *** NOT end_turn — possible truncation from provider ***`);
        }
      }

      const balance = getBraceBalance(attempt.rawResponse);
      console.log(`- Brace Balance: {:${balance.braces}, [:${balance.brackets}`);
      console.log(`- Ends with: "${attempt.rawResponse.trim().slice(-1)}"`);
    }

    if (attempt.parsedJson) {
      await fs.writeFile(`${prefix}.parsed.json`, JSON.stringify(attempt.parsedJson, null, 2));
    }

    if (attempt.validationIssues) {
      await fs.writeFile(`${prefix}.validation.json`, JSON.stringify({
        issues: attempt.validationIssues,
        missingSkillRefs: attempt.missingSkillRefs,
        duplicateAssignedSkillRefs: attempt.duplicateAssignedSkillRefs,
        invalidPhaseSkillRefs: attempt.invalidPhaseSkillRefs,
        summary: attempt.summary,
      }, null, 2));
    }

    // ── Save full repair artifacts ───────────────────────────────────────────
    if (attempt.repairAttempt?.attempted) {
      const repairMeta = attempt.repairAttempt as any;
      if (repairMeta.rawResponse) {
        await fs.writeFile(`${prefix}.repair.raw.txt`, repairMeta.rawResponse);
      }
      // Save repair validation (covers both accepted and still-invalid cases)
      await fs.writeFile(`${prefix}.repair.json`, JSON.stringify({
        attempted: repairMeta.attempted,
        semanticSucceeded: repairMeta.semanticSucceeded,
        accepted: repairMeta.accepted,
        failureReason: repairMeta.failureReason,
        repairedValidation: repairMeta.repairedValidation ?? null,
      }, null, 2));

      if (repairMeta.accepted) {
        console.log(`- Repair: ACCEPTED (semantically valid after repair)`);
      } else if (repairMeta.repairedValidation) {
        console.log(`- Repair: parsed OK but repaired draft still semantically invalid (${repairMeta.failureReason})`);
      } else {
        console.log(`- Repair: FAILED — ${repairMeta.failureReason}`);
      }
    }
  }

  // 6. Query DB state after
  console.log(`\n--- DB State (After) ---`);
  await printDbSummary(db, sourceId);

  printFinalDiagnosis(result);

  // 7. Save final manifest with complete run summary.
  const lastAttempt = result.attempts[result.attempts.length - 1];
  const accepted = !!result.progression;
  const finalManifest = {
    runId: timestamp,
    sourceId,
    learnerName,
    promptVersion: CURRICULUM_PROGRESSION_PROMPT_VERSION,
    skillCount: skillNodes.length,
    timestamp: new Date().toISOString(),
    provider: lastAttempt?.effectiveSettings ? "configured" : "unknown",
    model: lastAttempt?.effectiveSettings?.model ?? "unknown",
    effectiveSettings: lastAttempt?.effectiveSettings ?? null,
    attemptCount: result.attemptCount,
    accepted,
    // Lifecycle summary
    lifecycle: {
      responseReceived: !!lastAttempt?.rawResponseReceived,
      parseSucceeded: lastAttempt?.parseStatus === "ok",
      schemaSucceeded: lastAttempt?.schemaStatus === "ok",
      semanticSucceeded: lastAttempt?.semanticStatus === "ok",
      repairAttempted: !!lastAttempt?.repairAttempt?.attempted,
      repairSemanticSucceeded: lastAttempt?.repairAttempt?.semanticSucceeded ?? false,
      accepted,
      // Note: this debug script does not persist to DB — persisted is always false here
      persisted: false,
    },
    stopReason: (lastAttempt?.adapterDebugMetadata as any)?.stopReason ?? null,
    outputTokens: (lastAttempt?.adapterDebugMetadata as any)?.rawPayload?.usage?.output_tokens ?? null,
    inputTokens: (lastAttempt?.adapterDebugMetadata as any)?.rawPayload?.usage?.input_tokens ?? null,
    failureReason: result.failureReason ?? null,
    acceptedPhaseCount: accepted ? result.progression!.phases.length : null,
    acceptedEdgeCount: accepted ? result.progression!.edges.length : null,
  };
  await fs.writeFile(path.join(debugDir, "manifest.json"), JSON.stringify(finalManifest, null, 2));
  console.log(`\nFinal manifest saved to ${path.join(debugDir, "manifest.json")}`);
}

function detectTruncation(text: string) {
  const trimmed = text.trim();
  const lastChar = trimmed.slice(-1);
  const balanced = getBraceBalance(trimmed);
  
  const looksTruncated = balanced.braces > 0 || balanced.brackets > 0 || !["}", "]"].includes(lastChar);
  
  let likelyCause = "unknown";
  if (looksTruncated) {
    if (balanced.braces > 0 || balanced.brackets > 0) likelyCause = "max_tokens";
    else if (!["}", "]"].includes(lastChar)) likelyCause = "malformed_output";
  }

  return { looksTruncated, likelyCause };
}

function getBraceBalance(text: string) {
  let braces = 0;
  let brackets = 0;
  for (const char of text) {
    if (char === "{") braces++;
    if (char === "}") braces--;
    if (char === "[") brackets++;
    if (char === "]") brackets--;
  }
  return { braces, brackets };
}

async function printDbSummary(db: any, sourceId: string) {
  const [progState] = await db
    .select()
    .from(curriculumProgressionState)
    .where(eq(curriculumProgressionState.sourceId, sourceId));

  if (!progState) {
    console.log("No progression state found.");
  } else {
    console.log(`Status: ${progState.status}`);
    console.log(`Failure Category: ${progState.lastFailureCategory}`);
    console.log(`Failure Reason: ${progState.lastFailureReason}`);
    console.log(`Using Fallback: ${progState.usingInferredFallback}`);
  }

  const phases = await db
    .select()
    .from(curriculumPhases)
    .where(eq(curriculumPhases.sourceId, sourceId));
  console.log(`Phases: ${phases.length}`);

  const phaseNodes = await db
    .select()
    .from(curriculumPhaseNodes)
    .innerJoin(curriculumPhases, eq(curriculumPhaseNodes.phaseId, curriculumPhases.id))
    .where(eq(curriculumPhases.sourceId, sourceId));
  console.log(`Phase Membership Count: ${phaseNodes.length}`);

  const prereqs = await db
    .select()
    .from(curriculumSkillPrerequisites)
    .where(eq(curriculumSkillPrerequisites.sourceId, sourceId));
  
  const explicit = prereqs.filter((p: any) => p.metadata?.derivedFrom === "explicit_progression_graph").length;
  const inferred = prereqs.filter((p: any) => p.metadata?.derivedFrom !== "explicit_progression_graph").length;
  
  console.log(`Prerequisites: ${prereqs.length} (${explicit} explicit, ${inferred} inferred)`);
}

function printFinalDiagnosis(result: any) {
  console.log(`\n=== Final Diagnosis ===`);
  const lastAttempt = result.attempts[result.attempts.length - 1];
  
  const providerComplete = lastAttempt?.adapterDebugMetadata?.stopReason === "end_turn" || lastAttempt?.adapterDebugMetadata?.finishReason === "stop";
  const adapterCaptured = lastAttempt?.rawResponse && lastAttempt.adapterDebugMetadata ? lastAttempt.rawResponse.length === lastAttempt.adapterDebugMetadata.rawContentLength : "unclear";
  const truncated = lastAttempt?.rawResponse ? detectTruncation(lastAttempt.rawResponse).looksTruncated : false;
  
  console.log(`- Provider complete: ${providerComplete}`);
  console.log(`- Adapter captured full response: ${adapterCaptured}`);
  console.log(`- Truncated before parse: ${truncated}`);
  console.log(`- Schema valid: ${lastAttempt?.schemaStatus === "ok"}`);
  console.log(`- Semantic valid: ${lastAttempt?.semanticStatus === "ok"}`);
  
  let primaryPoint = "unknown";
  if (truncated) primaryPoint = "provider truncation (max_tokens?)";
  else if (lastAttempt?.parseStatus === "error") primaryPoint = "parser bug or malformed output";
  else if (lastAttempt?.semanticStatus === "error") primaryPoint = "semantic corruption";
  else if (!result.progression) primaryPoint = "all attempts failed";
  else primaryPoint = "none (success)";

  console.log(`- Most likely primary failure point: ${primaryPoint}`);
}

main().catch(console.error);
