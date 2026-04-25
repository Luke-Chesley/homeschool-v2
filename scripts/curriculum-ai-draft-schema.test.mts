import test from "node:test";
import assert from "node:assert/strict";

import { CurriculumAiGeneratedArtifactSchema } from "@/lib/curriculum/ai-draft";
import { canonicalizeCurriculumArtifact } from "@/lib/curriculum/canonical-artifact";

function buildMinimalArtifact(overrides: Record<string, unknown> = {}) {
  const { source: sourceOverrides, ...rootOverrides } = overrides;
  return {
    source: {
      title: "Chess in a Month",
      description: "A short beginner curriculum.",
      subjects: ["Chess"],
      gradeLevels: ["4th"],
      summary: "Teach a beginner to play confident full games in one month.",
      teachingApproach: "Short lessons, puzzles, guided play, and review.",
      successSignals: ["Learner can finish a full game."],
      parentNotes: ["Keep games short."],
      rationale: ["A compact sequence is appropriate."],
      ...(sourceOverrides as Record<string, unknown> | undefined),
    },
    intakeSummary: "A focused month-long chess curriculum.",
    pacing: {
      totalWeeks: 4,
      sessionsPerWeek: 5,
      sessionMinutes: 35,
      totalSessions: 20,
      coverageStrategy: "Spiral through core ideas with guided play and review.",
      coverageNotes: ["Use puzzles and short games."],
    },
    skills: [
      {
        skillId: "skill-1",
        domainTitle: "Chess",
        strandTitle: "Fundamentals",
        goalGroupTitle: "Board Skills",
        title: "Name the pieces",
      },
    ],
    units: [
      {
        unitRef: "unit-1",
        title: "Unit 1",
        description: "Start with movement and basic play.",
        estimatedWeeks: 1,
        estimatedSessions: 5,
        skillIds: ["skill-1"],
      },
    ],
    ...rootOverrides,
  };
}

test("CurriculumAiGeneratedArtifactSchema truncates overflowing summary arrays", () => {
  const parsed = CurriculumAiGeneratedArtifactSchema.parse({
    source: {
      title: "Chess in a Month",
      description: "A short beginner curriculum.",
      subjects: ["Chess", "Logic", "Strategy", "Games", "Math", "Problem Solving", "Overflow"],
      gradeLevels: ["4th", "5th", "6th", "7th", "Overflow"],
      summary: "Teach a beginner to play confident full games in one month.",
      teachingApproach: "Short lessons, puzzles, guided play, and review.",
      successSignals: Array.from({ length: 7 }, (_, index) => `Signal ${index + 1}`),
      parentNotes: Array.from({ length: 7 }, (_, index) => `Parent note ${index + 1}`),
      rationale: Array.from({ length: 7 }, (_, index) => `Rationale ${index + 1}`),
    },
    intakeSummary: "A focused month-long chess curriculum.",
    pacing: {
      totalWeeks: 4,
      sessionsPerWeek: 5,
      sessionMinutes: 35,
      totalSessions: 20,
      coverageStrategy: "Spiral through core ideas with guided play and review.",
      coverageNotes: Array.from({ length: 10 }, (_, index) => `Coverage note ${index + 1}`),
    },
    skills: Array.from({ length: 260 }, (_, index) => ({
      skillId: `skill-${index + 1}`,
      domainTitle: "Chess",
      strandTitle: "Fundamentals",
      goalGroupTitle: "Board Skills",
      title: `Skill ${index + 1}`,
    })),
    units: [
      {
        unitRef: "unit-1",
        title: "Unit 1",
        description: "Start with movement and basic play.",
        estimatedWeeks: 1,
        estimatedSessions: 5,
        skillIds: Array.from({ length: 60 }, (_, index) => `skill-${index + 1}`),
      },
    ],
  });

  assert.equal(parsed.source.subjects.length, 6);
  assert.deepEqual(parsed.source.subjects.at(-1), "Problem Solving");
  assert.equal(parsed.source.gradeLevels.length, 4);
  assert.equal(parsed.source.successSignals.length, 6);
  assert.equal(parsed.source.parentNotes.length, 6);
  assert.equal(parsed.source.rationale.length, 6);
  assert.equal(parsed.pacing.coverageNotes.length, 8);
  assert.equal(parsed.skills.length, 240);
  assert.equal(parsed.units[0]?.skillIds.length, 48);
});

test("CurriculumAiGeneratedArtifactSchema trims surrounding whitespace from skill ids", () => {
  const paddedSkillId = `  ${"virginia-history-".repeat(6)}  `;
  const trimmedSkillId = paddedSkillId.trim();
  const parsed = CurriculumAiGeneratedArtifactSchema.parse({
    source: {
      title: "Virginia History in the 1800s",
      description: "A middle-school history curriculum.",
      subjects: ["Virginia History", "US History", "Civics"],
      gradeLevels: ["Middle School"],
      summary: "Study Virginia's 19th century through primary sources and writing.",
      teachingApproach: "Story-first, map work, primary sources, discussion, writing.",
      successSignals: ["Learner can narrate major changes across the century."],
      parentNotes: ["Keep a running timeline and map notebook."],
      rationale: ["Ground state history in chronology, people, and place."],
    },
    intakeSummary: "Virginia history across the 1800s with weekly discussion and writing.",
    pacing: {
      totalWeeks: 10,
      sessionsPerWeek: 4,
      sessionMinutes: 35,
      totalSessions: 40,
      coverageStrategy: "Chronological survey with recurring map and source analysis.",
      coverageNotes: ["Use biographies, maps, timelines, and short writing responses."],
    },
    skills: [
      {
        skillId: paddedSkillId,
        domainTitle: "History",
        strandTitle: "Virginia in the 1800s",
        goalGroupTitle: "Foundations",
        title: "Early 1800s life in Virginia",
      },
      {
        skillId: "skill-2",
        domainTitle: "History",
        strandTitle: "Virginia in the 1800s",
        goalGroupTitle: "Foundations",
        title: "Transportation and industry",
      },
    ],
    units: [
      {
        unitRef: "unit-1",
        title: "Unit 1",
        description: "Start with daily life and structural change in early 19th-century Virginia.",
        estimatedWeeks: 2,
        estimatedSessions: 8,
        skillIds: [paddedSkillId, "skill-2"],
      },
    ],
  });
  assert.equal(parsed.skills[0]?.skillId, trimmedSkillId);
  assert.equal(parsed.units[0]?.skillIds[0], trimmedSkillId);
});

test("CurriculumAiGeneratedArtifactSchema accepts week-scale skills without hierarchy labels", () => {
  const parsed = CurriculumAiGeneratedArtifactSchema.parse(
    buildMinimalArtifact({
      source: {
        title: "Clouds This Week",
        subjects: ["Weather"],
        summary: "Observe and classify clouds during one week.",
      },
      intakeSummary: "A one-week cloud observation curriculum.",
      pacing: {
        totalWeeks: 1,
        sessionsPerWeek: 4,
        totalSessions: 4,
        coverageStrategy: "Observe and classify common cloud types this week.",
        coverageNotes: ["Keep observations concrete."],
      },
      curriculumScale: "week",
      skills: [
        {
          skillId: "skill-1",
          title: "Observe cloud shape and height",
        },
        {
          skillId: "skill-2",
          title: "Match cloud observations to likely weather",
        },
      ],
      units: [
        {
          unitRef: "unit:1:clouds-week",
          title: "Cloud observations",
          description: "A compact week of cloud observation.",
          estimatedWeeks: 1,
          estimatedSessions: 4,
          skillIds: ["skill-1", "skill-2"],
        },
      ],
    }),
  );

  const canonical = canonicalizeCurriculumArtifact(parsed);

  assert.equal(parsed.curriculumScale, "week");
  assert.equal(canonical.skillCatalog[0]?.domainTitle, "Weather");
  assert.equal(canonical.skillCatalog[0]?.strandTitle, "Cloud observations");
  assert.equal(canonical.skillCatalog[0]?.goalGroupTitle, "Focus Skills");
  assert.equal(
    canonical.units[0]?.skillRefs[0],
    "skill:weather/cloud-observations/focus-skills/observe-cloud-shape-and-height",
  );
});

test("CurriculumAiGeneratedArtifactSchema allows teaching approach up to 1000 characters", () => {
  const parsed = CurriculumAiGeneratedArtifactSchema.parse(
    buildMinimalArtifact({
      source: {
        teachingApproach: "A".repeat(1000),
      },
    }),
  );

  assert.equal(parsed.source.teachingApproach.length, 1000);
});
