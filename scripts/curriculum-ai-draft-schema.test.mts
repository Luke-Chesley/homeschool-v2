import test from "node:test";
import assert from "node:assert/strict";

import { CurriculumAiGeneratedArtifactSchema } from "@/lib/curriculum/ai-draft";

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
    document: {
      Chess: {
        Fundamentals: {
          "Board Skills": ["Board setup", "Piece movement"],
        },
      },
    },
    units: [
      {
        unitRef: "unit-1",
        title: "Unit 1",
        description: "Start with movement and basic play.",
        estimatedWeeks: 1,
        estimatedSessions: 5,
        skillRefs: Array.from({ length: 10 }, (_, index) => `skill-${index + 1}`),
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
  assert.equal(parsed.units[0]?.skillRefs.length, 8);
});

test("CurriculumAiGeneratedArtifactSchema accepts long progression refs so unresolved progression can fall back later", () => {
  const longRef = "Virginia History / ".repeat(14);
  const trimmedLongRef = longRef.trim();

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
    document: {
      History: {
        "Virginia in the 1800s": {
          Foundations: ["Early 1800s life in Virginia", "Transportation and industry"],
        },
      },
    },
    units: [
      {
        unitRef: "unit-1",
        title: "Unit 1",
        description: "Start with daily life and structural change in early 19th-century Virginia.",
        estimatedWeeks: 2,
        estimatedSessions: 8,
        skillRefs: [longRef, `${longRef} / slavery and reform`],
      },
    ],
  });
  assert.equal(parsed.units[0]?.skillRefs[0], trimmedLongRef);
});
