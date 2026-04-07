/**
 * One-off debug script: Curriculum Progression Pipeline Inspector
 *
 * Usage:
 *   node --env-file=.env.local --import ./scripts/path-loader.mjs \
 *        --experimental-strip-types \
 *        scripts/debug-curriculum-progression.mts [title or sourceId]
 *
 * Default target: "Summer Chess Fundamentals for Beginners"
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { eq, ilike, inArray, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../lib/db/schema/index.ts";
import {
  curriculumSources,
  curriculumPhases,
  curriculumPhaseNodes,
} from "../lib/db/schema/curriculum.ts";
import {
  curriculumNodes,
  curriculumSkillPrerequisites,
} from "../lib/db/schema/curriculumRouting.ts";
import {
  parseCurriculumProgression,
} from "../lib/curriculum/ai-draft-service.ts";
import {
  validateProgressionSemantics,
  extractLeafSkillTitles,
} from "../lib/curriculum/progression-validation.ts";
import {
  buildCurriculumProgressionPrompt,
  CURRICULUM_PROGRESSION_SYSTEM_PROMPT,
  CURRICULUM_PROGRESSION_PROMPT_VERSION,
} from "../lib/prompts/curriculum-draft.ts";
import { getModelForTask, DEFAULT_ROUTING_CONFIG } from "../lib/ai/provider-adapter.ts";
import { getAiRoutingConfig } from "../lib/ai/routing.ts";

// ── Setup ──────────────────────────────────────────────────────────────────────

const TARGET_TITLE = process.argv[2] ?? "Summer Chess Fundamentals for Beginners";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set. Run with --env-file=.env.local");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { idle_timeout: 10, max: 1, prepare: false, onnotice: () => {} });
const db = drizzle(sql, { schema });

function sep(label: string) {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`  ${label}`);
  console.log("═".repeat(70));
}

function sub(label: string) {
  console.log(`\n── ${label}`);
}

function ensureTmp() {
  mkdirSync(resolve(process.cwd(), "tmp"), { recursive: true });
}

function writeTmp(filename: string, data: unknown) {
  ensureTmp();
  const path = resolve(process.cwd(), "tmp", filename);
  writeFileSync(path, typeof data === "string" ? data : JSON.stringify(data, null, 2));
  return path;
}

// ── 1. Find the source ─────────────────────────────────────────────────────────

sep("1. SOURCE LOOKUP");

// Try exact match first, then ilike
let sourceRows = await db
  .select()
  .from(curriculumSources)
  .where(eq(curriculumSources.title, TARGET_TITLE))
  .orderBy(asc(curriculumSources.importVersion));

if (sourceRows.length === 0) {
  console.log(`No exact match for "${TARGET_TITLE}", trying fuzzy...`);
  sourceRows = await db
    .select()
    .from(curriculumSources)
    .where(ilike(curriculumSources.title, `%${TARGET_TITLE}%`))
    .orderBy(asc(curriculumSources.importVersion));
}

if (sourceRows.length === 0) {
  console.error(`ERROR: No curriculum source found matching "${TARGET_TITLE}"`);
  await sql.end();
  process.exit(1);
}

if (sourceRows.length > 1) {
  console.log(`Found ${sourceRows.length} matches — using most recent active/imported:`);
  for (const row of sourceRows) {
    console.log(`  [${row.status}] v${row.importVersion} | ${row.id} | ${row.title}`);
  }
}

// Pick the last imported active one, or just the last one
const source =
  sourceRows.find((r) => r.status === "active") ??
  sourceRows[sourceRows.length - 1];

console.log(`\nSelected source:`);
console.log(`  ID:             ${source.id}`);
console.log(`  Title:          ${source.title}`);
console.log(`  Kind:           ${source.kind}`);
console.log(`  Status:         ${source.status}`);
console.log(`  Import version: ${source.importVersion}`);
console.log(`  Organization:   ${source.organizationId}`);

const meta = source.metadata as Record<string, unknown>;
console.log(`\nSource metadata keys:`, Object.keys(meta));
if (meta.normalizedSkillCount) {
  console.log(`  normalizedSkillCount: ${meta.normalizedSkillCount}`);
}
if (meta.normalizedNodeCount) {
  console.log(`  normalizedNodeCount:  ${meta.normalizedNodeCount}`);
}
if (meta.lastImportedAt) {
  console.log(`  lastImportedAt:       ${meta.lastImportedAt}`);
}
if (meta.pacing) {
  console.log(`  pacing:               ${JSON.stringify(meta.pacing)}`);
}

// ── 2. Model routing ───────────────────────────────────────────────────────────

sep("2. MODEL ROUTING");

const TASK = "curriculum.generate.progression";
const routingConfig = getAiRoutingConfig();
const selectedModel = getModelForTask(TASK, routingConfig);
const defaultModel = getModelForTask(TASK, DEFAULT_ROUTING_CONFIG);
const providerId = routingConfig.providerId;

const explicitlyRouted = routingConfig.taskDefaults?.[TASK] !== undefined;

console.log(`  Task:                ${TASK}`);
console.log(`  Provider:            ${providerId}`);
console.log(`  Model selected:      ${selectedModel}`);
console.log(`  Default (mock) model: ${defaultModel}`);
console.log(`  Explicitly routed:   ${explicitlyRouted}`);
console.log(`  Prompt version:      ${CURRICULUM_PROGRESSION_PROMPT_VERSION}`);

if (providerId === "mock") {
  console.log(`\n  ⚠️  WARNING: Using MOCK adapter — no real AI calls will be made.`);
  console.log(`     Set ANTHROPIC_API_KEY in environment to use the real model.`);
}

// ── 3. Skill nodes from DB ─────────────────────────────────────────────────────

sep("3. SKILL NODES FROM DB");

const allNodes = await db
  .select()
  .from(curriculumNodes)
  .where(eq(curriculumNodes.sourceId, source.id))
  .orderBy(asc(curriculumNodes.depth), asc(curriculumNodes.sequenceIndex));

const skillNodes = allNodes.filter((n) => n.normalizedType === "skill" && n.isActive);
const canonicalSkillNodes = [...skillNodes].sort((a, b) => {
  const aOrder = typeof (a.metadata as Record<string, unknown>).canonicalSequenceIndex === "number"
    ? (a.metadata as Record<string, unknown>).canonicalSequenceIndex as number
    : a.sequenceIndex;
  const bOrder = typeof (b.metadata as Record<string, unknown>).canonicalSequenceIndex === "number"
    ? (b.metadata as Record<string, unknown>).canonicalSequenceIndex as number
    : b.sequenceIndex;
  return aOrder - bOrder;
});

const dbSkillTitles = canonicalSkillNodes.map((n) => n.title);

console.log(`  Total nodes in DB:  ${allNodes.length}`);
console.log(`  Active skill nodes: ${skillNodes.length}`);
console.log(`\n  DB skill titles (normalized, in canonical order):`);
for (const [i, title] of dbSkillTitles.entries()) {
  console.log(`    ${String(i + 1).padStart(3)}. "${title}"`);
}

// ── 4. Reconstruct document approximation from tree ───────────────────────────

sub("4a. Reconstruct document from tree nodes");

// Build tree structure: domain > strand > goal_group > skill
const domainNodes = allNodes.filter((n) => n.normalizedType === "domain" && n.isActive);
const strandNodes = allNodes.filter((n) => n.normalizedType === "strand" && n.isActive);
const goalGroupNodes = allNodes.filter((n) => n.normalizedType === "goal_group" && n.isActive);

const reconstructedDocument: Record<string, unknown> = {};
for (const domain of domainNodes) {
  const domainStrands = strandNodes.filter((s) => s.parentNodeId === domain.id);
  const domainDoc: Record<string, unknown> = {};
  for (const strand of domainStrands) {
    const strandGoalGroups = goalGroupNodes.filter((g) => g.parentNodeId === strand.id);
    const strandDoc: Record<string, unknown> = {};
    for (const gg of strandGoalGroups) {
      const ggSkills = skillNodes.filter((s) => s.parentNodeId === gg.id);
      const ggDoc: Record<string, string> = {};
      for (const skill of ggSkills) {
        ggDoc[skill.title] = (skill.description as string | null) ?? "";
      }
      strandDoc[gg.title] = ggDoc;
    }
    domainDoc[strand.title] = strandDoc;
  }
  reconstructedDocument[domain.title] = domainDoc;
}

// What extractLeafSkillTitles would produce from the reconstructed doc:
const reconstructedLeafTitles = extractLeafSkillTitles(reconstructedDocument as Record<string, unknown>);

console.log(`\n  Reconstructed doc leaf titles (${reconstructedLeafTitles.length} skills):`);
for (const [i, t] of reconstructedLeafTitles.entries()) {
  console.log(`    ${String(i + 1).padStart(3)}. "${t}"`);
}

// Compare reconstructed vs db titles
sub("4b. Title mismatch check: extractLeafSkillTitles vs DB normalized titles");

let mismatchCount = 0;
const maxLen = Math.max(reconstructedLeafTitles.length, dbSkillTitles.length);
for (let i = 0; i < maxLen; i++) {
  const raw = reconstructedLeafTitles[i];
  const normalized = dbSkillTitles[i];
  if (raw !== normalized) {
    console.log(`  MISMATCH at index ${i}:`);
    console.log(`    raw (prompt):       "${raw}"`);
    console.log(`    normalized (DB):    "${normalized}"`);
    mismatchCount++;
  }
}

if (mismatchCount === 0) {
  console.log(`  ✓ All ${reconstructedLeafTitles.length} titles match exactly (no mismatch detected)`);
} else {
  console.log(`\n  ⚠️  ${mismatchCount} title mismatches found!`);
  console.log(`     This means: the model receives raw titles but normalization maps cleaned titles.`);
  console.log(`     Any progression skill ref from the model using the raw title CANNOT be looked up.`);
}

// ── 5. Current persisted progression state ─────────────────────────────────────

sep("5. PERSISTED PROGRESSION STATE (current DB)");

const persistedPhases = await db
  .select()
  .from(curriculumPhases)
  .where(eq(curriculumPhases.sourceId, source.id))
  .orderBy(asc(curriculumPhases.position));

const phaseIds = persistedPhases.map((p) => p.id);
const persistedPhaseNodes = phaseIds.length > 0
  ? await db
      .select()
      .from(curriculumPhaseNodes)
      .where(inArray(curriculumPhaseNodes.phaseId, phaseIds))
  : [];

const persistedPrereqs = await db
  .select()
  .from(curriculumSkillPrerequisites)
  .where(eq(curriculumSkillPrerequisites.sourceId, source.id));

console.log(`  Phase count:         ${persistedPhases.length}`);
console.log(`  Phase-node links:    ${persistedPhaseNodes.length}`);
console.log(`  Prerequisite edges:  ${persistedPrereqs.length}`);

if (persistedPhases.length > 0) {
  console.log(`\n  Phases (in order):`);
  for (const phase of persistedPhases) {
    const nodeCount = persistedPhaseNodes.filter((pn) => pn.phaseId === phase.id).length;
    console.log(`    [${phase.position}] "${phase.title}" — ${nodeCount} skills`);
  }
}

const prereqByKind: Record<string, number> = {};
for (const p of persistedPrereqs) {
  prereqByKind[p.kind] = (prereqByKind[p.kind] ?? 0) + 1;
}
console.log(`\n  Prerequisites by kind:`);
for (const [kind, count] of Object.entries(prereqByKind)) {
  console.log(`    ${kind}: ${count}`);
}

const explicitPrereqs = persistedPrereqs.filter((p) => p.kind !== "inferred");
const inferredPrereqs = persistedPrereqs.filter((p) => p.kind === "inferred");
console.log(`\n  Explicit prereqs: ${explicitPrereqs.length}`);
console.log(`  Inferred prereqs: ${inferredPrereqs.length}`);

if (persistedPrereqs.length > 0) {
  const sample = persistedPrereqs.slice(0, 5);
  console.log(`\n  Sample prerequisites:`);
  for (const p of sample) {
    const fromNode = allNodes.find((n) => n.id === p.prerequisiteSkillNodeId);
    const toNode = allNodes.find((n) => n.id === p.skillNodeId);
    console.log(`    [${p.kind}] "${fromNode?.title ?? p.prerequisiteSkillNodeId}" → "${toNode?.title ?? p.skillNodeId}"`);
  }
}

// Diagnose current state
const hasExplicitPhases = persistedPhases.length > 0;
const hasExplicitEdges = explicitPrereqs.length > 0;
const hasInferredOnly = !hasExplicitPhases && !hasExplicitEdges && inferredPrereqs.length > 0;
const hasNone = persistedPrereqs.length === 0 && persistedPhases.length === 0;

console.log(`\n  CURRENT STATE DIAGNOSIS:`);
if (hasExplicitPhases && hasExplicitEdges) {
  console.log(`  → Explicit phased progression with explicit edges`);
} else if (hasExplicitPhases && !hasExplicitEdges) {
  console.log(`  → Explicit phases present BUT no explicit edges`);
} else if (!hasExplicitPhases && hasExplicitEdges) {
  console.log(`  → Explicit edges WITHOUT phases (unphased explicit progression)`);
} else if (hasInferredOnly) {
  console.log(`  → Inferred fallback only — no explicit progression data was persisted`);
} else if (hasNone) {
  console.log(`  → No progression data at all`);
} else {
  console.log(`  → Mixed state (check above counts)`);
}

// ── 6. Run the second pass directly ───────────────────────────────────────────

sep("6. RUNNING SECOND PASS DIRECTLY");

// We use the db-normalized titles as the authoritative skill list for the rerun.
// This is what normalization would use for skillIdByTitle lookup.
const leafSkillTitlesForRerun = dbSkillTitles;

const pseudoArtifact = {
  source: { title: source.title, description: source.summary ?? "" },
  document: reconstructedDocument,
};

const userPromptContent = buildCurriculumProgressionPrompt({
  learnerName: "Learner",
  coreArtifact: pseudoArtifact,
  leafSkillTitles: leafSkillTitlesForRerun,
});

console.log(`  Leaf skill count for rerun: ${leafSkillTitlesForRerun.length}`);
console.log(`  Model: ${selectedModel}`);
console.log(`  Provider: ${providerId}`);
console.log(`  System prompt version: ${CURRICULUM_PROGRESSION_PROMPT_VERSION}`);

writeTmp("debug-progression-prompt.txt", userPromptContent);
console.log(`\n  User prompt saved to: tmp/debug-progression-prompt.txt`);

let rawResponse: string | null = null;
let parseResult: ReturnType<typeof parseCurriculumProgression> | null = null;
let validationResult: ReturnType<typeof validateProgressionSemantics> | null = null;
let rerunAttempts = 0;
let rerunFailureReason: string | null = null;
let canRunLive = providerId !== "mock";

if (!canRunLive) {
  console.log(`\n  ⚠️  MOCK adapter active — skipping live AI call.`);
  console.log(`     Inspect DB state and title mismatches above for diagnosis.`);
} else {
  console.log(`\n  Calling ${providerId} adapter (${selectedModel})...`);

  const { getAdapterForTask } = await import("../lib/ai/registry.ts");
  const adapter = getAdapterForTask(TASK);

  const attemptNotes: string[][] = [
    [],
    [
      "Ensure ALL skill titles match EXACTLY the titles in the authoritative leaf skill list.",
      "Copy the exact string from the list — do not paraphrase, abbreviate, or rephrase.",
      "Avoid cycles in hard prerequisites.",
      "Every phase must include at least one skill from the authoritative list.",
    ],
  ];

  for (const correctionNotes of attemptNotes) {
    rerunAttempts++;
    const correctionBlock = correctionNotes.length > 0
      ? `\n\nCorrection notes for this retry:\n${correctionNotes.map((n, i) => `${i + 1}. ${n}`).join("\n")}`
      : "";

    try {
      console.log(`\n  Attempt ${rerunAttempts}...`);
      const response = await adapter.complete({
        model: selectedModel,
        temperature: 0.2,
        systemPrompt: CURRICULUM_PROGRESSION_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: userPromptContent + correctionBlock,
          },
        ],
      });

      rawResponse = response.content;
      const rawPath = writeTmp(`debug-progression-raw-attempt${rerunAttempts}.txt`, rawResponse);
      console.log(`  Raw response saved to: ${rawPath}`);
      console.log(`  Raw response length: ${rawResponse.length} chars`);

      parseResult = parseCurriculumProgression(rawResponse);
      console.log(`  Parse result kind: ${parseResult.kind}`);

      if (parseResult.kind !== "success") {
        rerunFailureReason = `${parseResult.kind} on attempt ${rerunAttempts}`;
        console.log(`  Parse/schema issues:`, JSON.stringify(parseResult.issues, null, 2));
        continue;
      }

      const parsedPath = writeTmp(`debug-progression-parsed-attempt${rerunAttempts}.json`, parseResult.progression);
      console.log(`  Parsed progression saved to: ${parsedPath}`);

      validationResult = validateProgressionSemantics(parseResult.progression, leafSkillTitlesForRerun);
      const { summary } = validationResult;

      console.log(`\n  SEMANTIC VALIDATION SUMMARY (attempt ${rerunAttempts}):`);
      console.log(`    skillsInCurriculum:      ${summary.skillsInCurriculum}`);
      console.log(`    skillsAssignedToPhases:  ${summary.skillsAssignedToPhases}`);
      console.log(`    phaseCount:              ${summary.phaseCount}`);
      console.log(`    edgesAccepted:           ${summary.edgesAccepted}`);
      console.log(`    edgesDropped:            ${summary.edgesDropped}`);
      console.log(`    unresolvedEdgeEndpoints: ${summary.unresolvedEdgeEndpoints}`);
      console.log(`    unresolvedPhaseSkills:   ${summary.unresolvedPhaseSkills}`);
      console.log(`    hardPrerequisiteEdges:   ${summary.hardPrerequisiteEdges}`);
      console.log(`    valid:                   ${validationResult.valid}`);

      if (validationResult.issues.length > 0) {
        console.log(`\n  Validation issues (${validationResult.issues.length} total):`);
        const grouped: Record<string, typeof validationResult.issues> = {};
        for (const issue of validationResult.issues) {
          (grouped[issue.code] ??= []).push(issue);
        }
        for (const [code, issues] of Object.entries(grouped)) {
          console.log(`  [${code}] × ${issues.length}`);
          for (const issue of issues.slice(0, 5)) {
            console.log(`    "${issue.message.slice(0, 120)}"`);
          }
          if (issues.length > 5) {
            console.log(`    ... and ${issues.length - 5} more`);
          }
        }
      }

      if (!validationResult.valid) {
        const blockingIssues = validationResult.issues.filter(
          (i) => i.code === "hard_prerequisite_cycle" || i.code === "self_loop" || i.code === "empty_phases",
        );
        rerunFailureReason = `semantic validation blocked: ${blockingIssues.map((i) => i.code).join(", ")}`;
        continue;
      }

      // Check quality threshold
      const minPhaseCoverage = leafSkillTitlesForRerun.length >= 4
        ? Math.ceil(leafSkillTitlesForRerun.length * 0.4)
        : 0;

      if (summary.phaseCount === 0) {
        rerunFailureReason = `no phases on attempt ${rerunAttempts}`;
        continue;
      }
      if (summary.skillsAssignedToPhases < minPhaseCoverage) {
        rerunFailureReason = `insufficient phase coverage (${summary.skillsAssignedToPhases}/${leafSkillTitlesForRerun.length} < ${minPhaseCoverage}) on attempt ${rerunAttempts}`;
        continue;
      }

      rerunFailureReason = null;
      console.log(`\n  ✓ Attempt ${rerunAttempts} ACCEPTED`);
      break;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      rerunFailureReason = `model call error on attempt ${rerunAttempts}: ${errMsg}`;
      console.error(`  Model call error:`, errMsg);
    }
  }

  if (rerunFailureReason) {
    console.log(`\n  ✗ All attempts exhausted. Last failure: ${rerunFailureReason}`);
  }
}

// ── 7. Compare raw second-pass output to persisted state ──────────────────────

sep("7. COMPARISON: SECOND-PASS OUTPUT vs PERSISTED STATE");

if (!canRunLive) {
  console.log("  (Skipped — mock adapter, no live output to compare)");
} else if (!parseResult || parseResult.kind !== "success") {
  console.log(`  No usable parsed progression to compare (parse failed: ${rerunFailureReason})`);
} else {
  const freshPhases = parseResult.progression.phases;
  const freshEdges = parseResult.progression.edges;

  console.log(`  Fresh second-pass phases:     ${freshPhases.length}`);
  console.log(`  Persisted phases:             ${persistedPhases.length}`);
  console.log(`  Fresh second-pass edges:      ${freshEdges.length}`);
  console.log(`  Persisted prerequisite edges: ${persistedPrereqs.length}`);

  if (freshPhases.length > 0) {
    console.log(`\n  Fresh phase titles:`);
    for (const p of freshPhases) {
      const resolvedSkills = p.skillTitles.filter((t) => dbSkillTitles.includes(t)).length;
      console.log(`    "${p.title}" — ${p.skillTitles.length} refs, ${resolvedSkills} resolvable`);
    }
  }

  if (freshEdges.length > 0) {
    // Check how many edges would resolve against DB titles
    const titleSet = new Set(dbSkillTitles);
    const resolvable = freshEdges.filter(
      (e) => titleSet.has(e.fromSkillTitle) && titleSet.has(e.toSkillTitle),
    ).length;
    const unresolvable = freshEdges.length - resolvable;
    console.log(`\n  Fresh edges resolvable against DB titles: ${resolvable} / ${freshEdges.length}`);
    if (unresolvable > 0) {
      const bad = freshEdges.filter(
        (e) => !titleSet.has(e.fromSkillTitle) || !titleSet.has(e.toSkillTitle),
      );
      console.log(`  Unresolvable edges (sample):`);
      for (const e of bad.slice(0, 5)) {
        const fromOk = titleSet.has(e.fromSkillTitle);
        const toOk = titleSet.has(e.toSkillTitle);
        console.log(`    [${e.kind}]`);
        if (!fromOk) console.log(`      FROM mismatch: "${e.fromSkillTitle}"`);
        if (!toOk) console.log(`      TO mismatch:   "${e.toSkillTitle}"`);
      }
    }
  }
}

// ── 8. Failure pattern checks ─────────────────────────────────────────────────

sep("8. FAILURE PATTERN CHECKS");

sub("8a. Title mismatch between progression refs and DB skill titles");
if (mismatchCount > 0) {
  console.log(`  ⚠️  ${mismatchCount} title mismatches between raw document keys and DB normalized titles.`);
  console.log(`     Root cause: extractLeafSkillTitles uses raw keys; normalizeCurriculumDocument uses cleanLabel().`);
} else {
  console.log(`  ✓ No title mismatch between raw keys and normalized DB titles (cleanLabel is idempotent for this curriculum).`);
}

sub("8b. Phases with zero valid skills");
if (canRunLive && parseResult?.kind === "success") {
  const titleSet = new Set(dbSkillTitles);
  for (const phase of parseResult.progression.phases) {
    const valid = phase.skillTitles.filter((t) => titleSet.has(t)).length;
    if (valid === 0) {
      console.log(`  ⚠️  Phase "${phase.title}" has 0 resolvable skills (${phase.skillTitles.length} refs, all bad)`);
    }
  }
  if (parseResult.progression.phases.every((p) =>
    p.skillTitles.filter((t) => titleSet.has(t)).length > 0,
  )) {
    console.log(`  ✓ All phases have at least one resolvable skill`);
  }
} else {
  console.log(`  (No live parse result to check)`);
}

sub("8c. Explicit edges present with zero phases");
if (explicitPrereqs.length > 0 && persistedPhases.length === 0) {
  console.log(`  ⚠️  Explicit edges exist (${explicitPrereqs.length}) but no phases — unphased explicit progression`);
} else if (explicitPrereqs.length === 0 && persistedPhases.length > 0) {
  console.log(`  ⚠️  Phases exist (${persistedPhases.length}) but no explicit edges`);
} else {
  console.log(`  ✓ Phases (${persistedPhases.length}) and explicit edges (${explicitPrereqs.length}) are consistent`);
}

sub("8d. Inferred fallback — was pass 2 ever used?");
if (hasInferredOnly) {
  console.log(`  ⚠️  Only inferred prerequisites exist.`);
  console.log(`     Either: pass 2 was never run, OR it ran and failed every attempt.`);
  console.log(`     The normalization explicitly logs when it falls back.`);
}

sub("8e. Provider / model check");
console.log(`  Provider: ${providerId}`);
console.log(`  Model:    ${selectedModel}`);
if (providerId === "mock") {
  console.log(`  ⚠️  Mock provider — the real curriculum.generate.progression was NEVER called.`);
  console.log(`     This is the most likely cause of empty/inferred-only progression.`);
}

// ── 9. Diagnosis summary ─────────────────────────────────────────────────────

sep("9. DIAGNOSIS SUMMARY");

const ranLive = canRunLive && rawResponse !== null;
const parsedOk = parseResult?.kind === "success";
const validatedOk = validationResult?.valid === true;
const persistedOk = hasExplicitPhases || hasExplicitEdges;

console.log(`  Did the second pass run?          ${ranLive ? "YES (this run)" : "NO (mock adapter active)"}`);
console.log(`  Did it parse?                     ${ranLive ? (parsedOk ? "YES" : "NO") : "N/A"}`);
console.log(`  Did it validate?                  ${ranLive ? (validatedOk ? "YES" : "NO") : "N/A"}`);
console.log(`  Are explicit phases in DB?        ${hasExplicitPhases ? "YES" : "NO"}`);
console.log(`  Are explicit edges in DB?         ${hasExplicitEdges ? "YES" : "NO"}`);
console.log(`  Only inferred fallback in DB?     ${hasInferredOnly ? "YES" : "NO"}`);
console.log(`  Title mismatch risk:              ${mismatchCount > 0 ? `YES (${mismatchCount} mismatches)` : "NO"}`);

console.log(`\n  IS THE GRAPH 'fallback' MESSAGE ACCURATE?`);
if (!hasExplicitPhases && !hasExplicitEdges) {
  console.log(`  → YES — the graph is correctly showing fallback/inferred state.`);
  console.log(`    No explicit progression was persisted.`);
} else if (hasExplicitPhases) {
  console.log(`  → NO — explicit phases ARE in the DB but the graph may be showing them incorrectly.`);
} else if (hasExplicitEdges && !hasExplicitPhases) {
  console.log(`  → PARTIALLY — explicit edges exist but no phases; graph may show partial state.`);
}

console.log(`\n  MOST LIKELY ROOT CAUSE:`);
if (!canRunLive) {
  console.log(`  1. Mock AI adapter — progression generation was NEVER attempted with real model.`);
  console.log(`     The ANTHROPIC_API_KEY is not set, so every curriculum generation used mock.`);
  console.log(`     Mock adapter returns stub output that is not valid progression JSON.`);
} else if (ranLive && parsedOk && validatedOk && !persistedOk) {
  console.log(`  3. Pass 2 produced valid progression but import/persistence dropped it.`);
  console.log(`     Check: does importNormalizedTree receive artifact.progression correctly?`);
} else if (ranLive && parsedOk && !validatedOk) {
  console.log(`  2. Pass 2 produced phases but semantic validation rejected them.`);
  console.log(`     Check: validation issues above for specific blocking problems.`);
} else if (ranLive && !parsedOk) {
  console.log(`  1. Pass 2 never produced usable phases — parse/schema failed.`);
} else if (mismatchCount > 0) {
  console.log(`  6. Title/ref mismatches: model receives raw titles, normalization maps cleaned titles.`);
  console.log(`     The skill refs in progression output cannot be resolved in normalization lookup.`);
} else {
  console.log(`  Unknown — inspect validation issues and raw response above.`);
}

console.log(`\n  RECOMMENDED NEXT FIX:`);
if (!canRunLive) {
  console.log(`  1. Set ANTHROPIC_API_KEY in .env.local and re-run curriculum generation.`);
  console.log(`     Without this, pass 2 uses mock output → always falls back to inferred ordering.`);
  console.log(`  2. Confirm the Inngest job that runs pass 2 has access to the API key in production.`);
} else if (ranLive && parsedOk && validatedOk && !persistedOk) {
  console.log(`  Trace importNormalizedTree call — verify artifact.progression is non-null at call time.`);
} else if (mismatchCount > 0) {
  console.log(`  Align extractLeafSkillTitles to use cleanLabel() for consistency with normalization.`);
} else {
  console.log(`  Inspect validation issues above and fix the specific blocking constraints.`);
}

await sql.end();
console.log(`\n${"═".repeat(70)}`);
console.log("  Done.");
console.log("═".repeat(70));
