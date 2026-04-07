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
import { eq, sql } from "drizzle-orm";

async function main() {
  const { values } = parseArgs({
    options: {
      "source-id": { type: "string" },
    },
  });

  const sourceId = values["source-id"];
  if (!sourceId) {
    console.error("Missing --source-id");
    process.exit(1);
  }

  const db = getDb();

  console.log(`\n=== Progression DB State Inspection ===`);
  console.log(`Source ID: ${sourceId}`);

  // 1. Progression State
  const [progState] = await db
    .select()
    .from(curriculumProgressionState)
    .where(eq(curriculumProgressionState.sourceId, sourceId));

  if (!progState) {
    console.log("\n[Progression State] NONE FOUND");
  } else {
    console.log("\n[Progression State]");
    console.log(`- Status: ${progState.status}`);
    console.log(`- Last Failure Category: ${progState.lastFailureCategory}`);
    console.log(`- Last Failure Reason: ${progState.lastFailureReason}`);
    console.log(`- Using Inferred Fallback: ${progState.usingInferredFallback}`);
    console.log(`- Attempt Count: ${progState.attemptCount}`);
    console.log(`- Last Accepted Phase Count: ${progState.lastAcceptedPhaseCount}`);
    console.log(`- Last Accepted Edge Count: ${progState.lastAcceptedEdgeCount}`);
    console.log(`- Provenance: ${progState.provenance}`);
  }

  // 2. Phases and Membership
  const phases = await db
    .select({
      id: curriculumPhases.id,
      title: curriculumPhases.title,
      position: curriculumPhases.position,
      nodeCount: sql<number>`count(${curriculumPhaseNodes.curriculumNodeId})`,
    })
    .from(curriculumPhases)
    .leftJoin(curriculumPhaseNodes, eq(curriculumPhases.id, curriculumPhaseNodes.phaseId))
    .where(eq(curriculumPhases.sourceId, sourceId))
    .groupBy(curriculumPhases.id)
    .orderBy(curriculumPhases.position);

  console.log("\n[Phases]");
  if (phases.length === 0) {
    console.log("No phases found.");
  } else {
    for (const phase of phases) {
      console.log(`- [${phase.position}] ${phase.title} (${phase.nodeCount} nodes)`);
    }
  }

  // 3. Prerequisites
  const prereqs = await db
    .select()
    .from(curriculumSkillPrerequisites)
    .where(eq(curriculumSkillPrerequisites.sourceId, sourceId));

  const explicit = prereqs.filter((p: any) => p.metadata?.derivedFrom === "explicit_progression_graph");
  const inferred = prereqs.filter((p: any) => p.metadata?.derivedFrom !== "explicit_progression_graph");

  console.log("\n[Prerequisites]");
  console.log(`Total: ${prereqs.length}`);
  console.log(`- Explicit: ${explicit.length}`);
  console.log(`- Inferred: ${inferred.length}`);

  if (explicit.length > 0) {
    console.log("\n[Explicit Edge Breakdown]");
    const kindCounts: Record<string, number> = {};
    for (const p of explicit) {
      kindCounts[p.kind] = (kindCounts[p.kind] || 0) + 1;
    }
    for (const [kind, count] of Object.entries(kindCounts)) {
      console.log(`- ${kind}: ${count}`);
    }
  }

  // 4. Route Board View Treatment
  console.log("\n[Route Board Treatment]");
  const isExplicitReady = progState?.status === "explicit_ready" && !progState?.usingInferredFallback;
  const hasPhases = phases.length > 0;
  
  if (isExplicitReady && hasPhases) {
    console.log("Status: explicit_ready");
  } else if (progState?.usingInferredFallback) {
    console.log("Status: fallback_only (using inferred)");
  } else {
    console.log("Status: unusable explicit progression / unknown");
  }
}

main().catch(console.error);
