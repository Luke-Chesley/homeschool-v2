import type { CurriculumAiCapturedRequirements, CurriculumAiGeneratedArtifact } from "./ai-draft.ts";
import type { RequestedPacing, CurriculumGranularityProfile } from "./granularity.ts";
import { inferCurriculumGranularityProfile } from "./granularity.ts";

type LearnerLike = {
  firstName: string;
  displayName: string;
};

interface FallbackSkillBlueprint {
  title: string;
  description: string;
}

interface FallbackGoalGroupBlueprint {
  title: string;
  skills: FallbackSkillBlueprint[];
}

interface FallbackStrandBlueprint {
  title: string;
  goalGroups: FallbackGoalGroupBlueprint[];
}

function toRefSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

export function buildFallbackCurriculumArtifact(params: {
  learner: LearnerLike;
  topic: string;
  capturedRequirements: CurriculumAiCapturedRequirements;
  requestedPacing: RequestedPacing;
}): CurriculumAiGeneratedArtifact {
  const topic = cleanTopicLabel(params.topic || params.capturedRequirements.topic || "Custom Study");
  const granularity = inferCurriculumGranularityProfile({
    topic,
    requirements: params.capturedRequirements,
    pacing: params.requestedPacing,
  });
  const title = buildFallbackTitle(topic, granularity);
  const subjects = inferSubjects(
    [
      params.capturedRequirements.topic,
      params.capturedRequirements.goals,
      params.capturedRequirements.structurePreferences,
      topic,
    ].join(" "),
  );
  const gradeLevels = inferGradeLevels(
    [
      params.capturedRequirements.topic,
      params.capturedRequirements.goals,
      params.capturedRequirements.learnerProfile,
    ].join(" "),
  );
  const blueprints = buildFallbackStructureBlueprint(topic, params.capturedRequirements, granularity);
  const totalSessions = estimateFallbackTotalSessions(params.requestedPacing, granularity);
  const totalWeeks = estimateFallbackTotalWeeks(params.requestedPacing, totalSessions);
  const sessionMinutes = params.requestedPacing.sessionMinutes ?? estimateLessonMinutes(params.capturedRequirements.timeframe);
  const unitSessionBudgets = allocateAcrossUnits(totalSessions, blueprints.length);
  const unitWeekBudgets = allocateAcrossUnits(totalWeeks, blueprints.length);
  const document = buildFallbackDocument(title, blueprints);
  const units = blueprints.map((strand, strandIndex) => {
    const unitRef = `unit:${strandIndex + 1}:${toRefSlug(strand.title)}`;
    const skillRefs = strand.goalGroups.flatMap((goalGroup) =>
      goalGroup.skills.map((skill) =>
        `skill:${[title, strand.title, goalGroup.title, skill.title].map(toRefSlug).join("/")}`),
    );

    return {
      unitRef,
      title: strand.title,
      description: buildUnitDescription(strand, topic, granularity),
      estimatedWeeks: unitWeekBudgets[strandIndex] ?? 1,
      estimatedSessions: unitSessionBudgets[strandIndex] ?? skillRefs.length,
      skillRefs,
    };
  });

  return {
    source: {
      title,
      description: buildSourceDescription(params.learner.displayName, topic, params.capturedRequirements, granularity),
      subjects,
      gradeLevels,
      academicYear: undefined,
      summary: buildSourceSummary(params.learner.displayName, topic, granularity, params.capturedRequirements),
      teachingApproach: buildTeachingApproach(granularity),
      successSignals: buildSuccessSignals(topic, granularity),
      parentNotes: buildParentNotes(params.capturedRequirements, granularity),
      rationale: buildRationale(topic, granularity),
    },
    intakeSummary: buildIntakeSummary(params.capturedRequirements, topic, granularity),
    pacing: {
      totalWeeks,
      sessionsPerWeek: params.requestedPacing.sessionsPerWeek,
      sessionMinutes,
      totalSessions,
      coverageStrategy: buildCoverageStrategy(granularity, params.requestedPacing, topic),
      coverageNotes: buildCoverageNotes(topic, granularity),
    },
    document,
    units,
  };
}

function buildFallbackStructureBlueprint(
  topic: string,
  requirements: CurriculumAiCapturedRequirements,
  granularity: CurriculumGranularityProfile,
): FallbackStrandBlueprint[] {
  const skillBlueprints = buildSkillBlueprints(topic, requirements, granularity);
  const strandCount = Math.max(1, Math.min(granularity.preferredStrandCount, skillBlueprints.length));
  const groupCount = Math.max(1, granularity.preferredGoalGroupsPerStrand);
  const skillChunks = splitIntoGroups(skillBlueprints, strandCount);

  return skillChunks.map((skills, strandIndex) => {
    const strandTitle = buildStrandTitle(topic, granularity, strandIndex, strandCount);
    const goalGroupChunks = splitIntoGroups(skills, Math.min(groupCount, skills.length));

    return {
      title: strandTitle,
      goalGroups: goalGroupChunks.map((groupSkills, groupIndex) => ({
        title: buildGoalGroupTitle(topic, granularity, strandIndex, groupIndex, groupSkills),
        skills: groupSkills,
      })),
    };
  });
}

function buildSkillBlueprints(
  topic: string,
  requirements: CurriculumAiCapturedRequirements,
  granularity: CurriculumGranularityProfile,
) {
  const topicLower = topic.toLowerCase();
  const topicTitle = toTitleCase(topic);
  const pool = getSkillTemplatePool(topicLower, topicTitle, requirements, granularity);
  const desiredCount = Math.max(4, granularity.preferredSkillCount);
  const skills = pool.slice(0, desiredCount);

  while (skills.length < desiredCount) {
    const index = skills.length;
    skills.push(
      index % 2 === 0
        ? {
            title: `Review and apply ${topicLower} in a new example`,
            description: `Add one more focused step so the learner can keep using ${topicLower}.`,
          }
        : {
            title: `Extend ${topicLower} with a slightly richer task`,
            description: `Use the same idea in a slightly longer or more connected example.`,
          },
    );
  }

  return skills;
}

function getSkillTemplatePool(
  topicLower: string,
  topicTitle: string,
  requirements: CurriculumAiCapturedRequirements,
  granularity: CurriculumGranularityProfile,
): FallbackSkillBlueprint[] {
  const goalLabel = requirements.goals ? shorten(cleanTopicLabel(requirements.goals), 90) : topicTitle;

  const proceduralNarrow: FallbackSkillBlueprint[] = [
    { title: `Set up the ${topicLower} materials`, description: `Gather the pieces, tools, or prompts needed to begin ${topicLower}.` },
    { title: `Name the key parts of ${topicLower}`, description: `Recognize the core pieces, terms, or steps that show up every time.` },
    { title: `Follow a short ${topicLower} routine`, description: `Move through one supported routine from start to finish.` },
    { title: `Notice a common ${topicLower} mistake`, description: `Catch the error before it becomes a habit.` },
    { title: `Correct ${topicLower} work with a model`, description: `Use an example or cue to repair the work.` },
    { title: `Use ${topicLower} with guided prompts`, description: `Work through the task with light support and visible checkpoints.` },
    { title: `Explain the steps in ${topicLower}`, description: `Say what happened, in order, so the process stays observable.` },
    { title: `Complete a short independent ${topicLower} check`, description: `Try the routine with less prompting and show the result.` },
    { title: `Apply ${topicLower} in a new example`, description: `Use the same routine in a slightly different setting.` },
    { title: `Review and revise ${topicLower} work`, description: `Look back, spot what changed, and make one concrete fix.` },
    { title: `Handle a slightly longer ${topicLower} task`, description: `Sustain the routine across a bit more time or complexity.` },
    { title: `Transfer ${topicLower} to a fresh situation`, description: `Use the skill when the surface details change.` },
  ];

  const proceduralBroad: FallbackSkillBlueprint[] = [
    { title: `Set up and orient around ${topicLower}`, description: `Get ready, identify the pieces, and understand the basic structure.` },
    { title: `Carry out the core ${topicLower} routine`, description: `Do the main process with enough support to stay accurate.` },
    { title: `Check for common errors in ${topicLower}`, description: `Use a quick check to catch likely mistakes.` },
    { title: `Use ${topicLower} in guided work`, description: `Apply the routine while thinking aloud or following examples.` },
    { title: `Apply ${topicLower} in new examples`, description: `Use the process when the context changes a little.` },
    { title: `Explain choices while doing ${topicLower}`, description: `Make the reasoning visible as the work happens.` },
    { title: `Refine ${topicLower} work from feedback`, description: `Use feedback to make the next attempt stronger.` },
    { title: `Combine the steps into a complete ${topicLower} task`, description: `Work through the full process with fewer interruptions.` },
  ];

  const conceptualNarrow: FallbackSkillBlueprint[] = [
    { title: `Define the core ideas in ${topicLower}`, description: `Name the main concepts clearly and simply.` },
    { title: `Match examples and nonexamples`, description: `Tell what belongs and what does not.` },
    { title: `Compare similar cases`, description: `Notice what changes when the surface details shift.` },
    { title: `Explain why an answer makes sense`, description: `Give a short reason that connects back to the ideas.` },
    { title: `Use ${topicLower} in a guided problem`, description: `Apply the idea with support in a worked example.` },
    { title: `Apply ${topicLower} to a new case`, description: `Move beyond the worked example into a fresh case.` },
    { title: `Defend a choice with evidence`, description: `Point to the reason, not just the answer.` },
    { title: `Review and correct misunderstandings`, description: `Notice where the idea slipped and repair it.` },
    { title: `Connect ${topicLower} to prior learning`, description: `Link the current idea to something already known.` },
    { title: `Solve a short mixed example`, description: `Blend the idea with a second familiar demand.` },
  ];

  const conceptualBroad: FallbackSkillBlueprint[] = [
    { title: `Explain the core ideas in ${topicLower}`, description: `State the main concepts and how they fit together.` },
    { title: `Compare and connect examples`, description: `Relate multiple cases instead of treating them separately.` },
    { title: `Use ${topicLower} to reason through cases`, description: `Apply the ideas across a fuller problem or discussion.` },
    { title: `Apply ${topicLower} in a new context`, description: `Transfer the thinking into a slightly different setting.` },
    { title: `Justify decisions with evidence`, description: `Support the conclusion with visible reasons.` },
    { title: `Synthesize ${topicLower} with prior learning`, description: `Bring the new ideas together with older knowledge.` },
  ];

  const creativeNarrow: FallbackSkillBlueprint[] = [
    { title: `Plan a simple ${topicLower} piece`, description: `Choose the purpose, shape, or parts before starting.` },
    { title: `Draft a first version`, description: `Get the idea on the page or in motion.` },
    { title: `Add detail or structure`, description: `Strengthen one part at a time without overloading the draft.` },
    { title: `Revise one part at a time`, description: `Make a focused change and check the result.` },
    { title: `Try a different choice`, description: `Experiment with a second option and compare it.` },
    { title: `Share the work and reflect`, description: `Notice what worked and what needs another pass.` },
    { title: `Apply feedback in a new draft`, description: `Use the notes to improve the next version.` },
    { title: `Finish a polished short piece`, description: `Bring the work to a clean and presentable form.` },
  ];

  const creativeBroad: FallbackSkillBlueprint[] = [
    { title: `Plan ${topicLower} with a clear purpose`, description: `Set the aim and outline the main shape.` },
    { title: `Draft and shape the main idea`, description: `Get the core version working and readable.` },
    { title: `Revise for clarity and style`, description: `Improve the flow, voice, or structure in one pass.` },
    { title: `Strengthen detail and structure`, description: `Bring the rough draft into better focus.` },
    { title: `Present and reflect`, description: `Show the result and talk through the choices.` },
    { title: `Carry feedback into the next version`, description: `Use the response to guide the next revision.` },
  ];

  const mixedPool: FallbackSkillBlueprint[] = [
    { title: `Get oriented with ${topicLower}`, description: `Name the basic ideas and what the learner is doing.` },
    { title: `Practice ${topicLower} with support`, description: `Use the topic in short guided work.` },
    { title: `Use ${topicLower} in short tasks`, description: `Try the skill in a visible, bounded example.` },
    { title: `Check and refine ${topicLower} work`, description: `Look back, spot the issue, and make a targeted fix.` },
    { title: `Apply ${topicLower} independently`, description: `Use the learning with lighter prompting.` },
    { title: `Review and explain the result`, description: `Show the evidence and talk through the outcome.` },
    { title: `Stretch ${topicLower} into a new case`, description: `Try the skill when the context shifts.` },
  ];

  const advancedExtensions: FallbackSkillBlueprint[] = [
    { title: `Trace a deeper pattern in ${topicLower}`, description: `Look for the underlying structure instead of only the surface.` },
    { title: `Connect ${topicLower} to a related idea`, description: `Link the topic to something nearby in the learner's work.` },
    { title: `Use ${topicLower} to solve a fuller task`, description: `Carry the idea into a longer or richer example.` },
    { title: `Evaluate and adjust the approach`, description: `Decide what worked and what should change next.` },
  ];

  const poolMap: Record<string, FallbackSkillBlueprint[]> = {
    procedural_narrow: proceduralNarrow,
    procedural_broad: proceduralBroad,
    conceptual_narrow: conceptualNarrow,
    conceptual_broad: conceptualBroad,
    creative_narrow: creativeNarrow,
    creative_broad: creativeBroad,
    mixed_narrow: [...mixedPool, ...advancedExtensions],
    mixed_broad: [...mixedPool.slice(0, 5), ...advancedExtensions],
    mixed_balanced: [...mixedPool, ...advancedExtensions],
  };

  const key = `${granularity.domainMode}_${granularity.mode}`;
  const pool = poolMap[key] ?? mixedPool;
  const withGoalSupport = pool.map((skill) => ({
    ...skill,
    description: `${skill.description} This keeps the work aligned to ${goalLabel}.`,
  }));

  return uniqueByTitle(withGoalSupport);
}

function buildFallbackTitle(topic: string, granularity: CurriculumGranularityProfile) {
  const suffix =
    granularity.domainMode === "procedural"
      ? granularity.mode === "broad"
        ? "Practice Path"
        : "Practice Sequence"
      : granularity.domainMode === "conceptual"
        ? granularity.mode === "broad"
          ? "Study Sequence"
          : "Study Path"
        : granularity.domainMode === "creative"
          ? granularity.mode === "broad"
            ? "Workshop"
            : "Workshop Path"
          : granularity.mode === "broad"
            ? "Learning Path"
            : "Learning Sequence";

  return `${toTitleCase(topic)} ${suffix}`.trim();
}

function buildStrandTitle(
  topic: string,
  granularity: CurriculumGranularityProfile,
  strandIndex: number,
  strandCount: number,
) {
  const labels = getStrandLabels(topic, granularity);
  return labels[strandIndex] ?? `${toTitleCase(topic)} ${strandIndex + 1}`;
}

function buildGoalGroupTitle(
  topic: string,
  granularity: CurriculumGranularityProfile,
  strandIndex: number,
  groupIndex: number,
  skills: FallbackSkillBlueprint[],
) {
  const labels = getGoalGroupLabels(topic, granularity);
  const defaultLabel = `${titleCaseLeadingWord(skills[0]?.title ?? topic)} focus`;
  return labels[strandIndex * 2 + groupIndex] ?? defaultLabel;
}

function getStrandLabels(topic: string, granularity: CurriculumGranularityProfile) {
  const topicTitle = toTitleCase(topic);

  if (granularity.domainMode === "procedural") {
    return granularity.mode === "broad"
      ? [`Starting ${topicTitle}`, `Working with ${topicTitle}`, `Applying ${topicTitle}`]
      : [`Getting started with ${topicTitle}`, `Practicing ${topicTitle}`, `Using ${topicTitle} independently`, `Reviewing and extending ${topicTitle}`];
  }

  if (granularity.domainMode === "conceptual") {
    return granularity.mode === "broad"
      ? [`Core ideas in ${topicTitle}`, `Reasoning with ${topicTitle}`, `Applying ${topicTitle}`]
      : [`Core ideas in ${topicTitle}`, `Comparing and explaining ${topicTitle}`, `Applying ${topicTitle} in context`];
  }

  if (granularity.domainMode === "creative") {
    return granularity.mode === "broad"
      ? [`Planning ${topicTitle}`, `Drafting ${topicTitle}`, `Revising ${topicTitle}`]
      : [`Planning ${topicTitle}`, `Drafting ${topicTitle}`, `Revising and sharing ${topicTitle}`];
  }

  return granularity.mode === "broad"
    ? [`Getting oriented with ${topicTitle}`, `Working with ${topicTitle}`, `Applying ${topicTitle}`]
    : [`Getting oriented with ${topicTitle}`, `Practicing ${topicTitle}`, `Using ${topicTitle} independently`, `Reviewing ${topicTitle}`];
}

function getGoalGroupLabels(topic: string, granularity: CurriculumGranularityProfile) {
  const topicTitle = toTitleCase(topic);

  if (granularity.domainMode === "procedural") {
    return granularity.mode === "broad"
      ? [
          "Materials and setup",
          "First routine",
          "Checks and repairs",
          "Applied practice",
          "Transfer and review",
          "Independent use",
        ].map((label) => `${label} in ${topicTitle}`)
      : [
          "Materials and setup",
          "Short guided practice",
          "Common mistakes and fixes",
          "Independent checks",
          "Application and review",
          "Transfer",
          "Extension",
          "Wrap-up",
        ].map((label) => `${label} for ${topicTitle}`);
  }

  if (granularity.domainMode === "conceptual") {
    return granularity.mode === "broad"
      ? [
          "Key ideas and terms",
          "Compare and explain",
          "Evidence and reasoning",
          "Application and transfer",
          "Review and extension",
        ].map((label) => `${label} in ${topicTitle}`)
      : [
          "Core ideas and terms",
          "Examples and nonexamples",
          "Reasoning and evidence",
          "Application and check",
          "Review and connect",
          "Synthesis",
          "Extension",
          "Transfer",
        ].map((label) => `${label} for ${topicTitle}`);
  }

  if (granularity.domainMode === "creative") {
    return granularity.mode === "broad"
      ? [
          "Planning and shaping",
          "Drafting",
          "Revision",
          "Presentation",
        ].map((label) => `${label} in ${topicTitle}`)
      : [
          "Planning and outline",
          "Drafting",
          "Revision",
          "Sharing and reflection",
        ].map((label) => `${label} for ${topicTitle}`);
  }

  return granularity.mode === "broad"
    ? [
        "Getting oriented",
        "Guided practice",
        "Independent work",
        "Review and transfer",
        "Extension",
        "Application",
        "Wrap-up",
      ].map((label) => `${label} with ${topicTitle}`)
    : [
        "Getting oriented",
        "Guided practice",
        "Checks and correction",
        "Independent work",
        "Review and transfer",
        "Extension",
        "Application",
        "Wrap-up",
      ].map((label) => `${label} with ${topicTitle}`);
}

function buildFallbackDocument(title: string, strands: FallbackStrandBlueprint[]) {
  return {
    [title]: Object.fromEntries(
      strands.map((strand) => [
        strand.title,
        Object.fromEntries(
          strand.goalGroups.map((goalGroup) => [
            goalGroup.title,
            goalGroup.skills.map((skill) => skill.title),
          ]),
        ),
      ]),
    ),
  };
}

function buildLessonDescription(
  learnerFirstName: string,
  skill: FallbackSkillBlueprint,
  topic: string,
  granularity: CurriculumGranularityProfile,
) {
  const opener =
    granularity.mode === "narrow"
      ? `Keep this step small enough for ${learnerFirstName} to model, practice, and check in one short lesson.`
      : granularity.mode === "broad"
        ? `Use a fuller lesson rhythm with model, practice, and a visible check.`
        : `Use a steady lesson rhythm with model, practice, and a visible check.`;

  return `${opener} ${skill.description} This lesson stays focused on ${topic}.`;
}

function buildLessonObjectives(skillTitle: string, granularity: CurriculumGranularityProfile) {
  return [
    `Model or explain ${skillTitle.toLowerCase()}.`,
    granularity.mode === "broad"
      ? "Practice it in a fuller task and check the result."
      : "Practice it in a short task and check the result.",
  ];
}

function buildUnitDescription(
  strand: FallbackStrandBlueprint,
  topic: string,
  granularity: CurriculumGranularityProfile,
) {
  const firstGroup = strand.goalGroups[0]?.title ?? topic;
  const base =
    granularity.mode === "narrow"
      ? "Keep the unit tight, with frequent visible checks and light repetition."
      : granularity.mode === "broad"
        ? "Keep the unit integrated, with room for practice, review, and transfer."
        : "Keep the unit balanced, with practice, review, and application."

  return `${base} The main thread is ${firstGroup}.`;
}

function buildSourceDescription(
  learnerDisplayName: string,
  topic: string,
  requirements: CurriculumAiCapturedRequirements,
  granularity: CurriculumGranularityProfile,
) {
  const timeframe = requirements.timeframe ? `paced around ${requirements.timeframe}` : null;
  const goal = requirements.goals ? `aimed at ${shorten(cleanTopicLabel(requirements.goals), 110)}` : null;
  const parts = [
    `${learnerDisplayName} will work through ${topic.toLowerCase()}`,
    timeframe,
    goal,
  ].filter(Boolean);

  return `${parts.join(", ")}.`;
}

function buildSourceSummary(
  learnerDisplayName: string,
  topic: string,
  granularity: CurriculumGranularityProfile,
  requirements: CurriculumAiCapturedRequirements,
) {
  const readiness =
    granularity.mode === "narrow"
      ? "small, observable skills"
      : granularity.mode === "broad"
        ? "broader integrated skills"
        : "a moderate skill grain";

  return `${learnerDisplayName} will build ${topic.toLowerCase()} through ${readiness} with a sequence that matches the family's pace and support needs.${requirements.goals ? ` The work stays aligned to ${shorten(cleanTopicLabel(requirements.goals), 120)}.` : ""}`;
}

function buildTeachingApproach(granularity: CurriculumGranularityProfile) {
  return granularity.mode === "narrow"
    ? "Use short teach-model-practice-check cycles, with small observable skills and quick feedback."
    : granularity.mode === "broad"
      ? "Use integrated lessons that still preserve visible checks, practice, and review."
      : "Use a balanced teach-model-practice-check rhythm with enough granularity to stay teachable.";
}

function buildSuccessSignals(topic: string, granularity: CurriculumGranularityProfile) {
  return [
    `The learner can show the main ${topic.toLowerCase()} skill in a visible task.`,
    granularity.mode === "narrow"
      ? "The parent can see quick progress because each skill is small enough to observe directly."
      : "The parent can see progress through practice, review, and application artifacts.",
    "The sequence stays teachable within the stated pacing and support needs.",
  ];
}

function buildParentNotes(
  requirements: CurriculumAiCapturedRequirements,
  granularity: CurriculumGranularityProfile,
) {
  return uniqueNonEmpty([
    requirements.constraints
      ? `Keep the routine aligned to these constraints: ${shorten(cleanTopicLabel(requirements.constraints), 120)}.`
      : "Keep prep light and the weekly rhythm consistent.",
    requirements.learnerProfile
      ? `Differentiate to the learner's current readiness: ${shorten(cleanTopicLabel(requirements.learnerProfile), 120)}.`
      : "Use short feedback loops so confidence stays visible.",
    granularity.mode === "narrow"
      ? "Split broad ideas into smaller teachable steps instead of compressing them."
      : "Allow broader integrated work when the learner can still model, practice, and check it.",
  ]);
}

function buildRationale(topic: string, granularity: CurriculumGranularityProfile) {
  return uniqueNonEmpty([
    `The curriculum is organized as a teachable progression around ${topic.toLowerCase()}.`,
    granularity.rationale[0],
    granularity.rationale[1],
    "Units and lessons stay aligned so later lesson planning can build from the same structure.",
  ]);
}

function buildIntakeSummary(
  requirements: CurriculumAiCapturedRequirements,
  topic: string,
  granularity: CurriculumGranularityProfile,
) {
  const fragments = [
    topic,
    requirements.goals ? shorten(cleanTopicLabel(requirements.goals), 120) : null,
    requirements.timeframe ? shorten(cleanTopicLabel(requirements.timeframe), 80) : null,
    granularity.mode,
  ].filter(Boolean);

  return `Fallback curriculum for ${fragments.join(" / ")}.`;
}

function buildCoverageStrategy(
  granularity: CurriculumGranularityProfile,
  pacing: RequestedPacing,
  topic: string,
) {
  if (granularity.mode === "narrow") {
    return `Use short teach-model-practice-check loops and revisit ${topic.toLowerCase()} often so each skill stays visible within the requested rhythm.`;
  }

  if (granularity.mode === "broad") {
    return `Use larger integrated tasks with periodic review so ${topic.toLowerCase()} stays coherent without losing visible checkpoints.`;
  }

  return `Use a balanced rhythm of instruction, guided practice, review, and application so ${topic.toLowerCase()} stays teachable within the requested pacing.`;
}

function buildCoverageNotes(topic: string, granularity: CurriculumGranularityProfile) {
  return uniqueNonEmpty([
    `${topic} skills are split when they would otherwise bundle separate procedures or rules.`,
    granularity.mode === "narrow"
      ? "Small skills are repeated across lessons so the learner can model, practice, and check them quickly."
      : "Practice, review, and application are kept visible so the pacing does not collapse into a tiny outline.",
    granularity.mode === "broad"
      ? "Broader integration is allowed because the learner context supports it."
      : "Visible checks stay close to each new skill.",
  ]);
}

function estimateFallbackTotalSessions(
  pacing: RequestedPacing,
  granularity: CurriculumGranularityProfile,
) {
  if (typeof pacing.explicitlyRequestedTotalSessions === "number") {
    return pacing.explicitlyRequestedTotalSessions;
  }

  if (typeof pacing.totalSessionsLowerBound === "number") {
    return pacing.totalSessionsLowerBound;
  }

  if (typeof pacing.totalWeeks === "number" && typeof pacing.sessionsPerWeek === "number") {
    return Math.max(1, Math.round(pacing.totalWeeks * pacing.sessionsPerWeek));
  }

  return granularity.mode === "narrow" ? 18 : granularity.mode === "broad" ? 12 : 15;
}

function estimateFallbackTotalWeeks(pacing: RequestedPacing, totalSessions: number) {
  if (typeof pacing.totalWeeks === "number") {
    return pacing.totalWeeks;
  }

  const sessionsPerWeek = pacing.sessionsPerWeek ?? 4;
  return Math.max(1, Math.ceil(totalSessions / sessionsPerWeek));
}

function buildFallbackMaterials(
  topic: string,
  requirements: CurriculumAiCapturedRequirements,
  granularity: CurriculumGranularityProfile,
) {
  const materials: string[] = [];
  const constraints = requirements.constraints.toLowerCase();

  if (constraints.includes("book")) {
    materials.push("family-selected reference book");
  }

  if (constraints.includes("workbook")) {
    materials.push("workbook or printed practice page");
  }

  if (granularity.domainMode === "procedural") {
    materials.push("notebook", "simple practice materials");
  } else if (granularity.domainMode === "conceptual") {
    materials.push("notebook", "worked examples", "discussion prompts");
  } else if (granularity.domainMode === "creative") {
    materials.push("draft paper", "editing notes", "sample model");
  } else {
    materials.push("notebook", "reference sheet", "simple practice materials");
  }

  if (topic.toLowerCase().includes("math") || topic.toLowerCase().includes("number")) {
    materials.push("scratch paper", "pencil", "visual examples");
  }

  return uniqueNonEmpty(materials);
}

function inferSubjects(text: string) {
  const value = text.toLowerCase();
  const subjectMatches = [
    { keywords: ["math", "algebra", "geometry", "fractions", "number"], subject: "math" },
    { keywords: ["science", "biology", "chemistry", "physics"], subject: "science" },
    { keywords: ["history", "civics", "government"], subject: "history" },
    { keywords: ["writing", "reading", "literature", "grammar", "essay"], subject: "language arts" },
    { keywords: ["logic", "strategy", "problem solving"], subject: "critical thinking" },
    { keywords: ["art", "drawing", "painting"], subject: "art" },
    { keywords: ["nature", "outdoor", "habitat"], subject: "nature study" },
    { keywords: ["coding", "programming", "computer", "technology"], subject: "technology" },
  ];

  const subjects = subjectMatches
    .filter((entry) => entry.keywords.some((keyword) => value.includes(keyword)))
    .map((entry) => entry.subject);

  return subjects.length > 0 ? uniqueNonEmpty(subjects).slice(0, 4) : ["interdisciplinary"];
}

function inferGradeLevels(text: string) {
  const value = text.toLowerCase();
  const matches = new Set<string>();

  const gradeRegexes = [
    /\bgrade\s+(\d{1,2})\b/g,
    /\b(\d{1,2})(?:st|nd|rd|th)\s+grade\b/g,
  ];

  for (const regex of gradeRegexes) {
    for (const match of value.matchAll(regex)) {
      if (match[1]) {
        matches.add(match[1]);
      }
    }
  }

  if (value.includes("kindergarten")) matches.add("K");
  if (value.includes("middle school")) matches.add("6-8");
  if (value.includes("high school")) matches.add("9-12");

  return [...matches].slice(0, 4);
}

function allocateAcrossUnits(total: number, unitCount: number) {
  if (unitCount <= 0) {
    return [];
  }

  const base = Math.max(1, Math.floor(total / unitCount));
  const remainder = total % unitCount;
  return Array.from({ length: unitCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

function estimateLessonMinutes(timeframe: string) {
  const match = timeframe.match(/(\d+)\s*minute/i);
  return match?.[1] ? Number(match[1]) : 30;
}

function chunk<T>(items: T[], size: number) {
  const groups: T[][] = [];
  const chunkSize = Math.max(1, size);

  for (let index = 0; index < items.length; index += chunkSize) {
    groups.push(items.slice(index, index + chunkSize));
  }

  return groups.length > 0 ? groups : [items];
}

function splitIntoGroups<T>(items: T[], groupCount: number) {
  if (items.length === 0) {
    return [[]];
  }

  const count = Math.max(1, Math.min(groupCount, items.length));
  const groups: T[][] = Array.from({ length: count }, () => []);

  for (let index = 0; index < items.length; index += 1) {
    groups[index % count].push(items[index]);
  }

  return groups.filter((group) => group.length > 0);
}

function uniqueByTitle(items: FallbackSkillBlueprint[]) {
  const seen = new Set<string>();
  const unique: FallbackSkillBlueprint[] = [];

  for (const item of items) {
    const key = normalizeKey(item.title);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

function cleanTopicLabel(value: string) {
  return value
    .replace(/^\s*(?:i\s+want\s+to|we\s+want\s+to|i\s+want|we\s+want|help\s+me\s+to)\s+/i, "")
    .replace(/\b(for\s+my\s+child|for\s+the\s+learner|for\s+our\s+family)\b.*$/i, "")
    .replace(/[.?!]+$/, "")
    .trim();
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function titleCaseLeadingWord(value: string) {
  const first = value.trim().split(/\s+/)[0] ?? "Practice";
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function shorten(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function uniqueNonEmpty(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
