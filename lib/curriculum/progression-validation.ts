import type { CurriculumAiProgression } from "./ai-draft.ts";
import type { ProgressionGenerationBasis } from "./progression-basis.ts";

export interface ProgressionValidationIssue {
  code: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface ProgressionValidationStats {
  expectedSkillCount: number;
  assignedSkillCount: number;
  phaseCount: number;
  emptyPhaseCount: number;
  phaseBudgetRange: {
    min?: number;
    max?: number;
  };
  missingSkillRefs: string[];
  duplicateSkillRefs: string[];
  inventedSkillRefs: string[];
  unresolvedSkillNodeMappings: string[];
  acceptedEdgeCount: number;
  droppedEdgeCount: number;
  edgeCount: number;
  duplicateEdgeCount: number;
  backwardHardPrerequisiteCount: number;
  backwardRecommendedBeforeCount: number;
  hardPrerequisiteCycleNodeCount: number;
  blankPhaseDescriptionCount: number;
  phaseSizeMin: number;
  phaseSizeMax: number;
  unitFragmentation: {
    fragmentedUnitCount: number;
    maxPhasesPerUnit: number;
    averagePhasesPerUnit: number;
  };
  exactCanonicalResolution: boolean;
}

export interface ProgressionValidationResult {
  fatalIssues: ProgressionValidationIssue[];
  warnings: ProgressionValidationIssue[];
  stats: ProgressionValidationStats;
}

function detectHardPrerequisiteCycle(edges: Array<{ from: string; to: string }>): string[] {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const outgoing = adjacency.get(edge.from) ?? [];
    outgoing.push(edge.to);
    adjacency.set(edge.from, outgoing);
    if (!adjacency.has(edge.to)) {
      adjacency.set(edge.to, []);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const visit = (node: string): string[] | null => {
    if (visiting.has(node)) {
      const cycleStart = stack.indexOf(node);
      return cycleStart >= 0 ? [...stack.slice(cycleStart), node] : [node];
    }
    if (visited.has(node)) {
      return null;
    }

    visiting.add(node);
    stack.push(node);
    for (const neighbor of adjacency.get(node) ?? []) {
      const cycle = visit(neighbor);
      if (cycle) {
        return cycle;
      }
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  };

  for (const node of adjacency.keys()) {
    const cycle = visit(node);
    if (cycle) {
      return cycle;
    }
  }

  return [];
}

export function validateGeneratedProgression(params: {
  progression: CurriculumAiProgression;
  basis: ProgressionGenerationBasis;
}): ProgressionValidationResult {
  const { progression, basis } = params;
  const fatalIssues: ProgressionValidationIssue[] = [];
  const warnings: ProgressionValidationIssue[] = [];
  const skillRefs = basis.skillCatalog.map((entry) => entry.skillRef);
  const skillSet = new Set(skillRefs);
  const assignedPhaseIndexBySkillRef = new Map<string, number>();
  const assignedPhaseTitlesBySkillRef = new Map<string, string[]>();
  const inventedSkillRefs = new Set<string>();
  const unresolvedSkillNodeMappings = new Set<string>();
  const phaseSizes = progression.phases.map((phase) => phase.skillRefs.length);
  const emptyPhases = progression.phases.filter((phase) => phase.skillRefs.length === 0);
  const blankDescriptionPhases = progression.phases.filter(
    (phase) => typeof phase.description !== "string" || phase.description.trim().length === 0,
  );

  const addFatal = (code: string, message: string, context?: Record<string, unknown>) => {
    fatalIssues.push({ code, message, context });
  };
  const addWarning = (code: string, message: string, context?: Record<string, unknown>) => {
    warnings.push({ code, message, context });
  };

  if (progression.phases.length === 0) {
    addFatal("zero_phases", "Generated progression contains zero phases.");
  }

  for (const phase of emptyPhases) {
    addFatal("empty_phase", `Phase "${phase.title}" is empty.`, { phaseTitle: phase.title });
  }

  for (const phase of blankDescriptionPhases) {
    addFatal(
      "blank_phase_description",
      `Phase "${phase.title}" is missing a meaningful description.`,
      { phaseTitle: phase.title },
    );
  }

  progression.phases.forEach((phase, phaseIndex) => {
    for (const skillRef of phase.skillRefs) {
      if (!skillSet.has(skillRef)) {
        inventedSkillRefs.add(skillRef);
        addFatal(
          "invented_skill_ref",
          `Phase "${phase.title}" references invented skillRef "${skillRef}".`,
          { phaseTitle: phase.title, skillRef },
        );
        continue;
      }

      if (!basis.skillNodeIdByRef.has(skillRef)) {
        unresolvedSkillNodeMappings.add(skillRef);
        addFatal(
          "unresolved_skill_node_mapping",
          `Canonical skillRef "${skillRef}" has no persisted node mapping.`,
          { phaseTitle: phase.title, skillRef },
        );
      }

      const seen = assignedPhaseTitlesBySkillRef.get(skillRef) ?? [];
      seen.push(phase.title);
      assignedPhaseTitlesBySkillRef.set(skillRef, seen);
      if (!assignedPhaseIndexBySkillRef.has(skillRef)) {
        assignedPhaseIndexBySkillRef.set(skillRef, phaseIndex);
      }
    }
  });

  const duplicateSkillRefs = [...assignedPhaseTitlesBySkillRef.entries()]
    .filter(([, phaseTitles]) => phaseTitles.length > 1)
    .map(([skillRef]) => skillRef);
  for (const skillRef of duplicateSkillRefs) {
    addFatal(
      "duplicate_skill_ref",
      `SkillRef "${skillRef}" appears in multiple phases.`,
      { skillRef, phases: assignedPhaseTitlesBySkillRef.get(skillRef) },
    );
  }

  const missingSkillRefs = skillRefs.filter((skillRef) => !assignedPhaseTitlesBySkillRef.has(skillRef));
  for (const skillRef of missingSkillRefs) {
    addFatal("missing_skill_ref", `Required skillRef "${skillRef}" is missing from all phases.`, {
      skillRef,
    });
  }

  const edgeKeys = new Set<string>();
  let acceptedEdgeCount = 0;
  let droppedEdgeCount = 0;
  let duplicateEdgeCount = 0;
  let backwardHardPrerequisiteCount = 0;
  let backwardRecommendedBeforeCount = 0;
  const hardEdges: Array<{ from: string; to: string }> = [];

  for (const edge of progression.edges) {
    const edgeKey = `${edge.fromSkillRef}→${edge.toSkillRef}::${edge.kind}`;
    if (edgeKeys.has(edgeKey)) {
      duplicateEdgeCount += 1;
      droppedEdgeCount += 1;
      addFatal("duplicate_edge", "Generated progression contains a duplicate edge.", {
        fromSkillRef: edge.fromSkillRef,
        toSkillRef: edge.toSkillRef,
        kind: edge.kind,
      });
      continue;
    }
    edgeKeys.add(edgeKey);

    const missingRefs: string[] = [];
    for (const skillRef of [edge.fromSkillRef, edge.toSkillRef]) {
      if (!skillSet.has(skillRef)) {
        inventedSkillRefs.add(skillRef);
        missingRefs.push(skillRef);
      } else if (!basis.skillNodeIdByRef.has(skillRef)) {
        unresolvedSkillNodeMappings.add(skillRef);
        missingRefs.push(skillRef);
      }
    }
    if (missingRefs.length > 0) {
      droppedEdgeCount += 1;
      addFatal("invented_skill_ref", "Generated edge references an invented or unresolved skillRef.", {
        fromSkillRef: edge.fromSkillRef,
        toSkillRef: edge.toSkillRef,
        kind: edge.kind,
        unresolvedSkillRefs: missingRefs,
      });
      continue;
    }

    if (edge.fromSkillRef === edge.toSkillRef) {
      droppedEdgeCount += 1;
      addFatal("self_loop_edge", "Generated progression contains a self-loop edge.", {
        fromSkillRef: edge.fromSkillRef,
        toSkillRef: edge.toSkillRef,
        kind: edge.kind,
      });
      continue;
    }

    const fromPhaseIndex = assignedPhaseIndexBySkillRef.get(edge.fromSkillRef);
    const toPhaseIndex = assignedPhaseIndexBySkillRef.get(edge.toSkillRef);
    if (typeof fromPhaseIndex === "number" && typeof toPhaseIndex === "number") {
      if (edge.kind === "hardPrerequisite" && fromPhaseIndex > toPhaseIndex) {
        backwardHardPrerequisiteCount += 1;
        droppedEdgeCount += 1;
        addFatal(
          "backward_hard_prerequisite",
          "hardPrerequisite edge points from a later phase to an earlier phase.",
          {
            fromSkillRef: edge.fromSkillRef,
            toSkillRef: edge.toSkillRef,
            fromPhaseIndex,
            toPhaseIndex,
          },
        );
        continue;
      }

      if (edge.kind === "recommendedBefore" && fromPhaseIndex > toPhaseIndex) {
        backwardRecommendedBeforeCount += 1;
        droppedEdgeCount += 1;
        addFatal(
          "backward_recommended_before",
          "recommendedBefore edge points from a later phase to an earlier phase.",
          {
            fromSkillRef: edge.fromSkillRef,
            toSkillRef: edge.toSkillRef,
            fromPhaseIndex,
            toPhaseIndex,
          },
        );
        continue;
      }
    }

    acceptedEdgeCount += 1;
    if (edge.kind === "hardPrerequisite") {
      hardEdges.push({ from: edge.fromSkillRef, to: edge.toSkillRef });
    }
  }

  const hardCycle = detectHardPrerequisiteCycle(hardEdges);
  if (hardCycle.length > 0) {
    addFatal(
      "hard_prerequisite_cycle",
      "hardPrerequisite edges contain a cycle.",
      { cycleNodes: hardCycle },
    );
  }

  const fragmentedUnits = basis.unitAnchors.map((unitAnchor) => {
    const phasesTouched = new Set<number>();
    for (const skillRef of unitAnchor.skillRefs) {
      const phaseIndex = assignedPhaseIndexBySkillRef.get(skillRef);
      if (typeof phaseIndex === "number") {
        phasesTouched.add(phaseIndex);
      }
    }
    return {
      unitRef: unitAnchor.unitRef,
      phaseCount: phasesTouched.size,
    };
  });

  const fragmentedUnitCount = fragmentedUnits.filter((unit) => unit.phaseCount > 1).length;
  const maxPhasesPerUnit = fragmentedUnits.reduce((max, unit) => Math.max(max, unit.phaseCount), 0);
  const averagePhasesPerUnit =
    fragmentedUnits.length > 0
      ? fragmentedUnits.reduce((sum, unit) => sum + unit.phaseCount, 0) / fragmentedUnits.length
      : 0;

  const nonZeroPhaseSizes = phaseSizes.filter((size) => size > 0);
  const phaseSizeMin = nonZeroPhaseSizes.length > 0 ? Math.min(...nonZeroPhaseSizes) : 0;
  const phaseSizeMax = nonZeroPhaseSizes.length > 0 ? Math.max(...nonZeroPhaseSizes) : 0;

  if (
    typeof basis.suggestedPhaseCountMin === "number"
    && typeof basis.suggestedPhaseCountMax === "number"
    && (
      progression.phases.length < basis.suggestedPhaseCountMin
      || progression.phases.length > basis.suggestedPhaseCountMax
    )
  ) {
    addWarning(
      "phase_budget_outside_range",
      "Phase count falls outside the suggested phase-budget range.",
      {
        phaseCount: progression.phases.length,
        suggestedPhaseCountMin: basis.suggestedPhaseCountMin,
        suggestedPhaseCountMax: basis.suggestedPhaseCountMax,
      },
    );
  }

  if (phaseSizeMin > 0 && phaseSizeMax >= phaseSizeMin * 3 && phaseSizeMax - phaseSizeMin >= 3) {
    addWarning("phase_size_imbalance", "Phase sizes are substantially imbalanced.", {
      phaseSizeMin,
      phaseSizeMax,
      phaseSizes,
    });
  }

  if (
    basis.unitAnchors.length > 0
    && fragmentedUnitCount > 0
    && (averagePhasesPerUnit >= 1.2 || maxPhasesPerUnit >= 2)
  ) {
    addWarning("unit_fragmentation", "Progression phases fragment unit arcs more than expected.", {
      fragmentedUnitCount,
      maxPhasesPerUnit,
      averagePhasesPerUnit,
    });
  }

  if (skillRefs.length > 0 && acceptedEdgeCount > Math.ceil(skillRefs.length * 1.5)) {
    addWarning("dense_edge_graph", "Progression graph is unusually dense.", {
      acceptedEdgeCount,
      expectedSkillCount: skillRefs.length,
    });
  }

  return {
    fatalIssues,
    warnings,
    stats: {
      expectedSkillCount: skillRefs.length,
      assignedSkillCount: assignedPhaseTitlesBySkillRef.size,
      phaseCount: progression.phases.length,
      emptyPhaseCount: emptyPhases.length,
      phaseBudgetRange: {
        min: basis.suggestedPhaseCountMin,
        max: basis.suggestedPhaseCountMax,
      },
      missingSkillRefs,
      duplicateSkillRefs,
      inventedSkillRefs: [...inventedSkillRefs],
      unresolvedSkillNodeMappings: [...unresolvedSkillNodeMappings],
      acceptedEdgeCount,
      droppedEdgeCount,
      edgeCount: progression.edges.length,
      duplicateEdgeCount,
      backwardHardPrerequisiteCount,
      backwardRecommendedBeforeCount,
      hardPrerequisiteCycleNodeCount: hardCycle.length,
      blankPhaseDescriptionCount: blankDescriptionPhases.length,
      phaseSizeMin,
      phaseSizeMax,
      unitFragmentation: {
        fragmentedUnitCount,
        maxPhasesPerUnit,
        averagePhasesPerUnit,
      },
      exactCanonicalResolution: inventedSkillRefs.size === 0 && unresolvedSkillNodeMappings.size === 0,
    },
  };
}
