import assert from "node:assert/strict";
import test from "node:test";

import { buildProgressionGraph } from "../lib/curriculum/progression-graph-model.ts";
import type { CurriculumTree, CurriculumTreeNode } from "../lib/curriculum/types.ts";
import type { CurriculumProgressionData } from "../lib/curriculum/service.ts";

// ── Test fixtures ─────────────────────────────────────────────────────────────

function makeSkillNode(
  id: string,
  title: string,
  opts: {
    domainId?: string;
    parentNodeId?: string;
    sequenceIndex?: number;
    canonicalOrder?: number;
  } = {},
): CurriculumTreeNode {
  return {
    id,
    sourceId: "src-1",
    parentNodeId: opts.parentNodeId ?? null,
    normalizedType: "skill",
    title,
    sequenceIndex: opts.sequenceIndex ?? 0,
    depth: 1,
    normalizedPath: `/${title}`,
    isActive: true,
    sourcePayload: {},
    metadata: { canonicalSequenceIndex: opts.canonicalOrder ?? opts.sequenceIndex ?? 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    children: [],
  };
}

function makeDomainNode(
  id: string,
  title: string,
  children: CurriculumTreeNode[],
  sequenceIndex = 0,
): CurriculumTreeNode {
  return {
    id,
    sourceId: "src-1",
    parentNodeId: null,
    normalizedType: "domain",
    title,
    sequenceIndex,
    depth: 0,
    normalizedPath: `/${title}`,
    isActive: true,
    sourcePayload: {},
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    children,
  };
}

function makeTree(rootNodes: CurriculumTreeNode[], skillIds: string[]): CurriculumTree {
  return {
    source: {
      id: "src-1",
      householdId: "hh-1",
      title: "Test Curriculum",
      kind: "ai_draft",
      status: "active",
      subjects: [],
      gradeLevels: [],
      importVersion: 1,
      indexingStatus: "not_applicable",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    rootNodes,
    nodeCount: rootNodes.length + skillIds.length,
    skillCount: skillIds.length,
    canonicalSkillNodeIds: skillIds,
  };
}

function makeProgression(opts: {
  phases?: Array<{ id: string; title: string; position: number; skillNodeIds: string[] }>;
  prerequisites?: Array<{ id: string; skillNodeId: string; prerequisiteSkillNodeId: string; kind: string }>;
}): CurriculumProgressionData {
  const phases = opts.phases ?? [];
  const prerequisites = opts.prerequisites ?? [];
  const hasExplicit = phases.length > 0;
  return {
    phases: phases.map((p) => ({
      ...p,
      description: undefined,
    })),
    prerequisites,
    diagnostics: {
      hasExplicitProgression: hasExplicit,
      usingInferredFallback: !hasExplicit,
      phaseCount: phases.length,
      acceptedEdgeCount: prerequisites.filter((p) => p.kind !== "inferred").length,
      droppedEdgeCount: 0,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

await test("buildProgressionGraph — no phases, no edges — fallback column with all skills", () => {
  const skill1 = makeSkillNode("s1", "Counting", { canonicalOrder: 0 });
  const skill2 = makeSkillNode("s2", "Addition", { canonicalOrder: 1 });
  const domain = makeDomainNode("d1", "Math", [skill1, skill2]);
  const tree = makeTree([domain], ["s1", "s2"]);
  const progression = makeProgression({});

  const graph = buildProgressionGraph(tree, progression);

  assert.equal(graph.nodes.length, 2, "should have 2 skill nodes");
  assert.equal(graph.edges.length, 0, "should have no edges");
  assert.equal(graph.columns.length, 1, "should have 1 fallback column");
  assert.equal(graph.columns[0].isFallback, true, "column should be marked as fallback");
  assert.equal(graph.diagnostics.hasExplicitProgression, false, "no explicit progression");
  assert.equal(graph.hasAnyNodes, true);
});

await test("buildProgressionGraph — explicit phases — nodes placed in correct columns", () => {
  const skill1 = makeSkillNode("s1", "Counting", { canonicalOrder: 0 });
  const skill2 = makeSkillNode("s2", "Addition", { canonicalOrder: 1 });
  const skill3 = makeSkillNode("s3", "Subtraction", { canonicalOrder: 2 });
  const domain = makeDomainNode("d1", "Math", [skill1, skill2, skill3]);
  const tree = makeTree([domain], ["s1", "s2", "s3"]);

  const progression = makeProgression({
    phases: [
      { id: "ph1", title: "Phase 1", position: 0, skillNodeIds: ["s1"] },
      { id: "ph2", title: "Phase 2", position: 1, skillNodeIds: ["s2", "s3"] },
    ],
  });

  const graph = buildProgressionGraph(tree, progression);

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  assert.equal(nodeMap.get("s1")!.columnIndex, 0, "s1 in phase 0");
  assert.equal(nodeMap.get("s2")!.columnIndex, 1, "s2 in phase 1");
  assert.equal(nodeMap.get("s3")!.columnIndex, 1, "s3 in phase 1");
  assert.equal(graph.diagnostics.hasExplicitProgression, true);
  assert.equal(graph.diagnostics.phaseCount, 2);
});

await test("buildProgressionGraph — unphased skills go to fallback column", () => {
  const skill1 = makeSkillNode("s1", "Counting", { canonicalOrder: 0 });
  const skill2 = makeSkillNode("s2", "Addition", { canonicalOrder: 1 });
  const domain = makeDomainNode("d1", "Math", [skill1, skill2]);
  const tree = makeTree([domain], ["s1", "s2"]);

  const progression = makeProgression({
    phases: [{ id: "ph1", title: "Phase 1", position: 0, skillNodeIds: ["s1"] }],
    // s2 is NOT in any phase
  });

  const graph = buildProgressionGraph(tree, progression);

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  assert.equal(nodeMap.get("s1")!.columnIndex, 0, "s1 in phase 0");
  assert.equal(nodeMap.get("s2")!.columnIndex, 1, "s2 in fallback column");
  assert.equal(nodeMap.get("s2")!.isExplicitlyPhased, false, "s2 is not explicitly phased");

  // Fallback column should exist
  const fallbackCol = graph.columns.find((c) => c.isFallback);
  assert.ok(fallbackCol, "fallback column exists");
  assert.ok(fallbackCol!.nodeIds.includes("s2"), "s2 is in fallback column");
});

await test("buildProgressionGraph — columns are left-to-right by phase position", () => {
  const skill1 = makeSkillNode("s1", "A", { canonicalOrder: 0 });
  const skill2 = makeSkillNode("s2", "B", { canonicalOrder: 1 });
  const skill3 = makeSkillNode("s3", "C", { canonicalOrder: 2 });
  const domain = makeDomainNode("d1", "Domain", [skill1, skill2, skill3]);
  const tree = makeTree([domain], ["s1", "s2", "s3"]);

  // Phases given out-of-order intentionally
  const progression = makeProgression({
    phases: [
      { id: "ph2", title: "Later", position: 2, skillNodeIds: ["s3"] },
      { id: "ph0", title: "First", position: 0, skillNodeIds: ["s1"] },
      { id: "ph1", title: "Middle", position: 1, skillNodeIds: ["s2"] },
    ],
  });

  const graph = buildProgressionGraph(tree, progression);

  // Columns should be sorted by phase position
  assert.equal(graph.columns[0].title, "First");
  assert.equal(graph.columns[1].title, "Middle");
  assert.equal(graph.columns[2].title, "Later");
});

await test("buildProgressionGraph — edge kinds are preserved", () => {
  const skill1 = makeSkillNode("s1", "A", { canonicalOrder: 0 });
  const skill2 = makeSkillNode("s2", "B", { canonicalOrder: 1 });
  const skill3 = makeSkillNode("s3", "C", { canonicalOrder: 2 });
  const domain = makeDomainNode("d1", "Domain", [skill1, skill2, skill3]);
  const tree = makeTree([domain], ["s1", "s2", "s3"]);

  const progression = makeProgression({
    prerequisites: [
      { id: "e1", skillNodeId: "s2", prerequisiteSkillNodeId: "s1", kind: "hardPrerequisite" },
      { id: "e2", skillNodeId: "s3", prerequisiteSkillNodeId: "s2", kind: "recommendedBefore" },
    ],
  });

  const graph = buildProgressionGraph(tree, progression);

  assert.equal(graph.edges.length, 2);
  const edge1 = graph.edges.find((e) => e.fromId === "s1" && e.toId === "s2");
  assert.ok(edge1, "hardPrerequisite edge s1→s2 exists");
  assert.equal(edge1!.kind, "hardPrerequisite");
  assert.equal(edge1!.isExplicit, true);

  const edge2 = graph.edges.find((e) => e.fromId === "s2" && e.toId === "s3");
  assert.ok(edge2, "recommendedBefore edge s2→s3 exists");
  assert.equal(edge2!.kind, "recommendedBefore");
});

await test("buildProgressionGraph — inferred edges marked as not explicit", () => {
  const skill1 = makeSkillNode("s1", "A", { canonicalOrder: 0 });
  const skill2 = makeSkillNode("s2", "B", { canonicalOrder: 1 });
  const domain = makeDomainNode("d1", "Domain", [skill1, skill2]);
  const tree = makeTree([domain], ["s1", "s2"]);

  const progression = makeProgression({
    prerequisites: [
      { id: "e1", skillNodeId: "s2", prerequisiteSkillNodeId: "s1", kind: "inferred" },
    ],
  });

  const graph = buildProgressionGraph(tree, progression);

  const edge = graph.edges[0];
  assert.ok(edge, "inferred edge exists");
  assert.equal(edge.kind, "inferred");
  assert.equal(edge.isExplicit, false, "inferred edge is not explicit");
  assert.equal(graph.diagnostics.usingInferredFallback, true);
});

await test("buildProgressionGraph — domain grouping metadata is correct", () => {
  const skill1 = makeSkillNode("s1", "Counting", { canonicalOrder: 0 });
  const skill2 = makeSkillNode("s2", "Addition", { canonicalOrder: 1 });
  const skill3 = makeSkillNode("s3", "Reading", { canonicalOrder: 2 });
  const mathDomain = makeDomainNode("d1", "Math", [skill1, skill2], 0);
  const readingDomain = makeDomainNode("d2", "Reading", [skill3], 1);
  const tree = makeTree([mathDomain, readingDomain], ["s1", "s2", "s3"]);
  const progression = makeProgression({});

  const graph = buildProgressionGraph(tree, progression);

  assert.equal(graph.groups.length, 2, "two domain groups");

  const mathGroup = graph.groups.find((g) => g.domainId === "d1");
  const readingGroup = graph.groups.find((g) => g.domainId === "d2");

  assert.ok(mathGroup, "math group exists");
  assert.ok(readingGroup, "reading group exists");
  assert.equal(mathGroup!.domainTitle, "Math");
  assert.ok(mathGroup!.nodeIds.includes("s1"), "s1 in math group");
  assert.ok(mathGroup!.nodeIds.includes("s2"), "s2 in math group");
  assert.ok(readingGroup!.nodeIds.includes("s3"), "s3 in reading group");
});

await test("buildProgressionGraph — nodes carry domain/strand/goal-group ancestry", () => {
  const skill = makeSkillNode("s1", "Skill A", { canonicalOrder: 0 });
  // Build nested hierarchy: domain > strand > goal_group > skill
  const goalGroup: CurriculumTreeNode = {
    id: "gg1",
    sourceId: "src-1",
    parentNodeId: "str1",
    normalizedType: "goal_group",
    title: "Goal Group Alpha",
    sequenceIndex: 0,
    depth: 2,
    normalizedPath: "/d/s/gg",
    isActive: true,
    sourcePayload: {},
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    children: [skill],
  };
  const strand: CurriculumTreeNode = {
    id: "str1",
    sourceId: "src-1",
    parentNodeId: "d1",
    normalizedType: "strand",
    title: "Strand Beta",
    sequenceIndex: 0,
    depth: 1,
    normalizedPath: "/d/s",
    isActive: true,
    sourcePayload: {},
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    children: [goalGroup],
  };
  const domain = makeDomainNode("d1", "Domain Alpha", [strand], 0);
  const tree = makeTree([domain], ["s1"]);
  const progression = makeProgression({});

  const graph = buildProgressionGraph(tree, progression);

  const node = graph.nodes.find((n) => n.id === "s1");
  assert.ok(node, "skill node exists");
  assert.equal(node!.domainTitle, "Domain Alpha");
  assert.equal(node!.strandTitle, "Strand Beta");
  assert.equal(node!.goalGroupTitle, "Goal Group Alpha");
});

await test("buildProgressionGraph — edges referencing unknown skill IDs are dropped", () => {
  const skill1 = makeSkillNode("s1", "A", { canonicalOrder: 0 });
  const domain = makeDomainNode("d1", "Domain", [skill1]);
  const tree = makeTree([domain], ["s1"]);

  const progression = makeProgression({
    prerequisites: [
      // s2 doesn't exist in the tree
      { id: "e1", skillNodeId: "s2", prerequisiteSkillNodeId: "s1", kind: "hardPrerequisite" },
    ],
  });

  const graph = buildProgressionGraph(tree, progression);

  assert.equal(graph.edges.length, 0, "edge referencing missing node is dropped");
});

await test("buildProgressionGraph — empty tree produces valid empty graph", () => {
  const tree = makeTree([], []);
  const progression = makeProgression({});

  const graph = buildProgressionGraph(tree, progression);

  assert.equal(graph.nodes.length, 0);
  assert.equal(graph.edges.length, 0);
  assert.equal(graph.hasAnyNodes, false);
  assert.ok(graph.columns.length >= 1, "at least one column even when empty");
});

await test("buildProgressionGraph — diagnostics reflect explicit progression correctly", () => {
  const skill1 = makeSkillNode("s1", "A", { canonicalOrder: 0 });
  const domain = makeDomainNode("d1", "Domain", [skill1]);
  const tree = makeTree([domain], ["s1"]);

  const progression: CurriculumProgressionData = {
    phases: [{ id: "ph1", title: "Phase 1", position: 0, skillNodeIds: ["s1"] }],
    prerequisites: [],
    diagnostics: {
      hasExplicitProgression: true,
      usingInferredFallback: false,
      phaseCount: 1,
      acceptedEdgeCount: 0,
      droppedEdgeCount: 2,
    },
  };

  const graph = buildProgressionGraph(tree, progression);

  assert.equal(graph.diagnostics.hasExplicitProgression, true);
  assert.equal(graph.diagnostics.usingInferredFallback, false);
  assert.equal(graph.diagnostics.droppedEdgeCount, 2, "dropped edge count preserved from diagnostics");
});
