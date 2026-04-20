import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { validateGeneratedProgression } from "../lib/curriculum/progression-validation.ts";
import type { ProgressionGenerationBasis } from "../lib/curriculum/progression-basis.ts";

interface FixtureBasis {
  gradeLevels: string[];
  learnerPriorKnowledge: ProgressionGenerationBasis["learnerPriorKnowledge"];
  totalWeeks?: number;
  sessionsPerWeek?: number;
  sessionMinutes?: number;
  totalSessions?: number;
  suggestedPhaseCountMin?: number;
  suggestedPhaseCountMax?: number;
  skillCatalog: ProgressionGenerationBasis["skillCatalog"];
  unitAnchors: ProgressionGenerationBasis["unitAnchors"];
  skillNodeIdByRef: Record<string, string>;
}

interface FixtureFile {
  id: string;
  title: string;
  basis: FixtureBasis;
  goodProgression: any;
  badProgressions: Array<{ label: string; progression: any }>;
}

function toBasis(fixture: FixtureFile): ProgressionGenerationBasis {
  const source = {
    id: fixture.id,
    householdId: "eval",
    title: fixture.title,
    kind: "ai_draft",
    status: "active",
    subjects: [],
    gradeLevels: fixture.basis.gradeLevels,
    indexingStatus: "not_applicable",
    importVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as const;

  return {
    source,
    tree: {
      source,
      rootNodes: [],
      nodeCount: fixture.basis.skillCatalog.length,
      skillCount: fixture.basis.skillCatalog.length,
      canonicalSkillNodeIds: Object.values(fixture.basis.skillNodeIdByRef),
    },
    units: [],
    skillCatalog: fixture.basis.skillCatalog,
    unitAnchors: fixture.basis.unitAnchors,
    skillNodeIdByRef: new Map(Object.entries(fixture.basis.skillNodeIdByRef)),
    gradeLevels: fixture.basis.gradeLevels,
    learnerPriorKnowledge: fixture.basis.learnerPriorKnowledge,
    totalWeeks: fixture.basis.totalWeeks,
    sessionsPerWeek: fixture.basis.sessionsPerWeek,
    sessionMinutes: fixture.basis.sessionMinutes,
    totalSessions: fixture.basis.totalSessions,
    suggestedPhaseCountMin: fixture.basis.suggestedPhaseCountMin,
    suggestedPhaseCountMax: fixture.basis.suggestedPhaseCountMax,
  };
}

async function main() {
  const fixtureDir = path.join(process.cwd(), "scripts/fixtures/progression");
  const fixtureFiles = (await readdir(fixtureDir)).filter((file) => file.endsWith(".json")).sort();
  let failures = 0;

  for (const fileName of fixtureFiles) {
    const raw = await readFile(path.join(fixtureDir, fileName), "utf8");
    const fixture = JSON.parse(raw) as FixtureFile;
    const basis = toBasis(fixture);

    const goodResult = validateGeneratedProgression({
      basis,
      progression: fixture.goodProgression,
    });
    const goodPassed = goodResult.fatalIssues.length === 0;
    console.log(`${fixture.id}: good progression ${goodPassed ? "PASS" : "FAIL"}`);
    if (!goodPassed) {
      failures += 1;
      console.log(JSON.stringify(goodResult.fatalIssues, null, 2));
    }

    for (const bad of fixture.badProgressions) {
      const badResult = validateGeneratedProgression({
        basis,
        progression: bad.progression,
      });
      const expectedWarningOnly = bad.label.includes("over-fragmented");
      const observed = expectedWarningOnly
        ? badResult.warnings.length > 0
        : badResult.fatalIssues.length > 0;
      console.log(`  - ${bad.label}: ${observed ? (expectedWarningOnly ? "warned" : "rejected") : "NOT FLAGGED"}`);
      if (!observed) {
        failures += 1;
        console.log(JSON.stringify({ fatalIssues: badResult.fatalIssues, warnings: badResult.warnings, stats: badResult.stats }, null, 2));
      }
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
