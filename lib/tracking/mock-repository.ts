import type {
  EvaluationEntry,
  EvidenceRecord,
  GoalProgressRow,
  ObservationEntry,
  StandardCoverageRow,
  TrackingDashboard,
  TrackingLearnerSummary,
  TrackingOutcome,
} from "@/lib/tracking/types";

const learner: TrackingLearnerSummary = {
  id: "learner-demo-1",
  name: "Hazel",
  gradeLabel: "4th grade",
  reportingWindow: "Week of March 30",
};

const outcomes: TrackingOutcome[] = [
  {
    id: "outcome-1",
    date: "2026-03-30",
    title: "Fractions on a Number Line",
    subject: "Math",
    plannedMinutes: 70,
    actualMinutes: 62,
    status: "completed",
    mastery: "developing",
    standards: ["CCSS.MATH.CONTENT.3.NF.A.2"],
    goals: ["Confidence with visual fraction models"],
    deviationNote: "Finished core practice but stopped before the extension set.",
    evidenceCount: 2,
  },
  {
    id: "outcome-2",
    date: "2026-03-30",
    title: "Essay Revision Conference",
    subject: "Writing",
    plannedMinutes: 45,
    actualMinutes: 41,
    status: "completed",
    mastery: "secure",
    standards: ["CCSS.ELA-LITERACY.W.4.4"],
    goals: ["Independent revision language"],
    evidenceCount: 2,
  },
  {
    id: "outcome-3",
    date: "2026-03-30",
    title: "Moon Journal Catch-up",
    subject: "Science",
    plannedMinutes: 25,
    actualMinutes: 12,
    status: "partial",
    mastery: "emerging",
    standards: ["NGSS-5-ESS1-2"],
    goals: ["Consistent observation habits"],
    deviationNote: "Observation was logged, but comparison notes were deferred.",
    evidenceCount: 1,
  },
  {
    id: "outcome-4",
    date: "2026-03-31",
    title: "Long Division Practice Set",
    subject: "Math",
    plannedMinutes: 65,
    actualMinutes: 0,
    status: "skipped",
    mastery: "needs_review",
    standards: ["CCSS.MATH.CONTENT.4.NBT.B.6"],
    goals: ["Fluency without rushing"],
    deviationNote: "Skipped after the dentist appointment ran long.",
    evidenceCount: 0,
  },
  {
    id: "outcome-5",
    date: "2026-03-31",
    title: "Biome Card Sort",
    subject: "Science",
    plannedMinutes: 55,
    actualMinutes: 49,
    status: "completed",
    mastery: "secure",
    standards: ["NGSS-3-LS4-3"],
    goals: ["Faster category reasoning"],
    evidenceCount: 3,
  },
];

const observations: ObservationEntry[] = [
  {
    id: "obs-1",
    date: "2026-03-30",
    title: "Math pacing note",
    tone: "adjustment",
    body: "Hazel understood benchmark fractions once she talked through them aloud. Visual models still matter more than written prompts here.",
    linkedOutcomeId: "outcome-1",
  },
  {
    id: "obs-2",
    date: "2026-03-30",
    title: "Writing bright spot",
    tone: "bright_spot",
    body: "Revision language came without prompting today. She independently replaced two weak topic sentences.",
    linkedOutcomeId: "outcome-2",
  },
  {
    id: "obs-3",
    date: "2026-03-31",
    title: "Science follow-up",
    tone: "watch",
    body: "Biome sorting was strong, but written explanations stayed short. Add one more oral rehearsal before written summaries.",
    linkedOutcomeId: "outcome-5",
  },
];

const evaluations: EvaluationEntry[] = [];

const evidence: EvidenceRecord[] = [
  {
    id: "evidence-1",
    title: "Fraction strip work sample",
    kind: "worksheet",
    linkedTo: "Fractions on a Number Line",
    capturedAt: "2026-03-30 10:18",
    note: "Shows correct placement for halves, fourths, and eighths.",
  },
  {
    id: "evidence-2",
    title: "Revision checklist",
    kind: "note",
    linkedTo: "Essay Revision Conference",
    capturedAt: "2026-03-30 11:04",
    note: "Parent notes from conference plus next revision steps.",
  },
  {
    id: "evidence-3",
    title: "Biome sort board photo",
    kind: "photo",
    linkedTo: "Biome Card Sort",
    capturedAt: "2026-03-31 11:42",
    note: "Final sort with labels before cleanup.",
  },
  {
    id: "evidence-4",
    title: "Biome exit ticket",
    kind: "activity",
    linkedTo: "Biome Card Sort",
    capturedAt: "2026-03-31 11:49",
    note: "4/5 correct with one habitat mismatch.",
  },
];

const standards: StandardCoverageRow[] = [
  {
    id: "standard-1",
    code: "CCSS.MATH.CONTENT.3.NF.A.2",
    label: "Represent fractions on a number line diagram.",
    subject: "Math",
    status: "in_progress",
    evidenceCount: 2,
    latestEvidence: "Fraction strip work sample",
  },
  {
    id: "standard-2",
    code: "CCSS.ELA-LITERACY.W.4.4",
    label: "Produce clear and coherent writing appropriate to task and audience.",
    subject: "Writing",
    status: "covered",
    evidenceCount: 2,
    latestEvidence: "Revision checklist",
  },
  {
    id: "standard-3",
    code: "NGSS-5-ESS1-2",
    label: "Represent data in graphical displays to reveal patterns of daily changes.",
    subject: "Science",
    status: "gap",
    evidenceCount: 1,
    latestEvidence: "Moon phase observation note",
  },
  {
    id: "standard-4",
    code: "NGSS-3-LS4-3",
    label: "Construct an argument with evidence that habitats can support different organisms.",
    subject: "Science",
    status: "covered",
    evidenceCount: 3,
    latestEvidence: "Biome exit ticket",
  },
];

const goals: GoalProgressRow[] = [
  {
    id: "goal-1",
    title: "Confidence with visual fraction models",
    subject: "Math",
    progressLabel: "Moving from guided success to independent explanation",
    nextMove: "Repeat the number line model with two shorter warm-ups before long division resumes.",
    linkedStandards: ["CCSS.MATH.CONTENT.3.NF.A.2"],
  },
  {
    id: "goal-2",
    title: "Independent revision language",
    subject: "Writing",
    progressLabel: "Strong this week",
    nextMove: "Capture one more conference note and shift to self-check prompts.",
    linkedStandards: ["CCSS.ELA-LITERACY.W.4.4"],
  },
  {
    id: "goal-3",
    title: "Consistent observation habits",
    subject: "Science",
    progressLabel: "Needs a lighter completion path",
    nextMove: "Reduce the moon journal expectation to one sketch plus one sentence on low-energy days.",
    linkedStandards: ["NGSS-5-ESS1-2"],
  },
];

export function getTrackingRepository() {
  return {
    getDashboard(): TrackingDashboard {
      const plannedMinutes = outcomes.reduce((total, item) => total + item.plannedMinutes, 0);
      const actualMinutes = outcomes.reduce((total, item) => total + item.actualMinutes, 0);
      const completedCount = outcomes.filter((item) => item.status === "completed").length;
      const secureCount = outcomes.filter((item) => item.mastery === "secure").length;
      const needsAttentionCount = outcomes.filter((item) =>
        item.mastery === "needs_review" || item.status !== "completed",
      ).length;

      return {
        learner,
        curriculum: null,
        summary: {
          plannedMinutes,
          actualMinutes,
          completionRate: Math.round((completedCount / outcomes.length) * 100),
          secureCount,
          needsAttentionCount,
        },
        outcomes,
        observations,
        evaluations,
        evidence,
        standards,
        goals,
        reviewQueue: [],
        recommendations: [],
      };
    },
  };
}
