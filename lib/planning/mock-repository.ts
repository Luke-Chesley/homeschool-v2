import type {
  DailyWorkspace,
  DayLoad,
  PlanDay,
  PlanItem,
  RecoveryOption,
  RecoveryPreview,
  ScheduleConstraint,
  WeeklyPlan,
} from "@/lib/planning/types";

const learner = {
  id: "learner-demo-1",
  name: "Hazel",
  gradeLabel: "4th grade",
  pacingPreference: "Four focused blocks with recovery margin",
  currentSeason: "Spring rhythm with two lighter afternoons",
} as const;

const constraints: ScheduleConstraint[] = [
  {
    date: "2026-03-30",
    availableMinutes: 220,
    hardStop: "3:00 PM",
    energy: "high",
    notes: "Normal Monday. Protect the last 25 minutes for read-aloud or spillover.",
    flags: ["home day", "strong math energy"],
  },
  {
    date: "2026-03-31",
    availableMinutes: 165,
    hardStop: "1:30 PM",
    energy: "low",
    notes: "Dentist appointment after lunch. Keep transitions short.",
    flags: ["appointment day"],
  },
  {
    date: "2026-04-01",
    availableMinutes: 240,
    hardStop: "3:45 PM",
    energy: "steady",
    notes: "Wide-open day for deep work and project spillover.",
    flags: ["project window"],
  },
  {
    date: "2026-04-02",
    availableMinutes: 185,
    hardStop: "2:15 PM",
    energy: "steady",
    notes: "Co-op in the afternoon. Keep science portable.",
    flags: ["co-op day"],
  },
  {
    date: "2026-04-03",
    availableMinutes: 210,
    hardStop: "2:45 PM",
    energy: "high",
    notes: "Good day for assessment, catch-up, and weekly wrap.",
    flags: ["review day"],
  },
];

const planItems: PlanItem[] = [
  {
    id: "plan-1",
    date: "2026-03-30",
    startTime: "9:00",
    title: "Fractions on a Number Line",
    subject: "Math",
    kind: "lesson",
    objective: "Place benchmark fractions and justify the intervals between them.",
    estimatedMinutes: 70,
    status: "ready",
    standards: ["CCSS.MATH.CONTENT.3.NF.A.2"],
    goals: ["Confidence with visual fraction models"],
    materials: ["Singapore Math 4A p. 83-88", "fraction strips", "whiteboard"],
    artifactSlots: ["worked example set", "reteach prompt"],
    copilotPrompts: ["Generate three extension questions", "Draft a simpler explanation for thirds and sixths"],
    sourceLabel: "Singapore Math 4A",
    lessonLabel: "Unit 5 · Lesson 3",
  },
  {
    id: "plan-2",
    date: "2026-03-30",
    startTime: "10:25",
    title: "Essay Revision Conference",
    subject: "Writing",
    kind: "lesson",
    objective: "Strengthen topic sentences and transitions in the personal narrative draft.",
    estimatedMinutes: 45,
    status: "ready",
    standards: ["CCSS.ELA-LITERACY.W.4.4"],
    goals: ["Independent revision language"],
    materials: ["draft notebook", "yellow revision sheet"],
    artifactSlots: ["conference summary", "mini-lesson notes"],
    copilotPrompts: ["Turn notes into a revision checklist"],
    sourceLabel: "Family Writing Workshop",
    lessonLabel: "Narrative Unit · Conference 2",
  },
  {
    id: "plan-3",
    date: "2026-03-30",
    startTime: "11:20",
    title: "Moon Journal Catch-up",
    subject: "Science",
    kind: "review",
    objective: "Record the weekend moon phase and compare it with last Thursday's sketch.",
    estimatedMinutes: 25,
    status: "carried_over",
    standards: ["NGSS-5-ESS1-2"],
    goals: ["Consistent observation habits"],
    materials: ["science journal", "moon phase wheel"],
    artifactSlots: ["observation log"],
    copilotPrompts: ["Summarize the last three observations"],
    sourceLabel: "Mystery Science Add-on",
    lessonLabel: "Sky Journal",
    note: "Moved from Friday after a shortened day.",
  },
  {
    id: "plan-4",
    date: "2026-03-30",
    startTime: "11:55",
    title: "Read-Aloud and Oral Narration",
    subject: "History",
    kind: "review",
    objective: "Retell key events from the Silk Road chapter in sequence.",
    estimatedMinutes: 35,
    status: "ready",
    standards: ["CCSS.ELA-LITERACY.SL.4.4"],
    goals: ["Stronger oral summaries"],
    materials: ["Story of the World ch. 28"],
    artifactSlots: ["narration audio placeholder"],
    copilotPrompts: ["Draft three narration follow-up questions"],
    sourceLabel: "Story of the World",
    lessonLabel: "Middle Ages Thread",
  },
  {
    id: "plan-5",
    date: "2026-03-31",
    startTime: "9:00",
    title: "Long Division Practice Set",
    subject: "Math",
    kind: "practice",
    objective: "Apply the area model before moving to the standard algorithm.",
    estimatedMinutes: 65,
    status: "ready",
    standards: ["CCSS.MATH.CONTENT.4.NBT.B.6"],
    goals: ["Fluency without rushing"],
    materials: ["practice sheet A", "base ten blocks"],
    artifactSlots: ["practice snapshot"],
    copilotPrompts: ["Create an easier warm-up set"],
    sourceLabel: "Singapore Math 4A",
    lessonLabel: "Unit 6 · Practice A",
  },
  {
    id: "plan-6",
    date: "2026-03-31",
    startTime: "10:20",
    title: "Poetry Copywork",
    subject: "Language Arts",
    kind: "review",
    objective: "Copy a short poem carefully and mark one line worth memorizing.",
    estimatedMinutes: 20,
    status: "completed",
    standards: ["CCSS.ELA-LITERACY.L.4.2"],
    goals: ["Careful handwriting"],
    materials: ["poetry journal"],
    artifactSlots: ["copywork scan"],
    copilotPrompts: ["Suggest a two-minute recall game"],
    sourceLabel: "Morning Basket",
    lessonLabel: "Week 27",
  },
  {
    id: "plan-7",
    date: "2026-03-31",
    startTime: "10:50",
    title: "Biome Card Sort",
    subject: "Science",
    kind: "project",
    objective: "Sort plants and animals into the correct biome families.",
    estimatedMinutes: 55,
    status: "ready",
    standards: ["NGSS-3-LS4-3"],
    goals: ["Faster category reasoning"],
    materials: ["laminated cards", "glue book"],
    artifactSlots: ["sorted board photo"],
    copilotPrompts: ["Generate a five-question exit ticket"],
    sourceLabel: "Build Your Library",
    lessonLabel: "Biomes Week 2",
  },
  {
    id: "plan-8",
    date: "2026-04-01",
    startTime: "9:00",
    title: "Fractions Recipe Lab",
    subject: "Math",
    kind: "project",
    objective: "Double and halve ingredient amounts while explaining each change.",
    estimatedMinutes: 80,
    status: "ready",
    standards: ["CCSS.MATH.CONTENT.4.NF.B.3"],
    goals: ["Applied fraction language"],
    materials: ["recipe card", "measuring cups"],
    artifactSlots: ["recipe notes", "photo set"],
    copilotPrompts: ["Generate a printable kitchen math reflection"],
    sourceLabel: "Kitchen Math Fridays",
    lessonLabel: "Recipe Lab 1",
  },
  {
    id: "plan-9",
    date: "2026-04-01",
    startTime: "10:40",
    title: "Independent Reading Conference",
    subject: "Reading",
    kind: "lesson",
    objective: "Discuss character motivation with evidence from the text.",
    estimatedMinutes: 35,
    status: "ready",
    standards: ["CCSS.ELA-LITERACY.RL.4.3"],
    goals: ["Citing textual evidence naturally"],
    materials: ["novel", "reading journal"],
    artifactSlots: ["conference note"],
    copilotPrompts: ["Draft three discussion stems"],
    sourceLabel: "Reader's Workshop",
    lessonLabel: "Conference Block",
  },
  {
    id: "plan-10",
    date: "2026-04-01",
    startTime: "11:30",
    title: "Mapmaking Studio",
    subject: "Geography",
    kind: "project",
    objective: "Label trade routes and key terrain features from memory first, atlas second.",
    estimatedMinutes: 60,
    status: "ready",
    standards: ["NCSS D2.Geo.2.3-5"],
    goals: ["Spatial recall"],
    materials: ["blank map", "colored pencils", "atlas"],
    artifactSlots: ["map draft"],
    copilotPrompts: ["Turn the map into a short oral quiz"],
    sourceLabel: "Curiosity Chronicles",
    lessonLabel: "Routes and Regions",
  },
  {
    id: "plan-11",
    date: "2026-04-02",
    startTime: "9:00",
    title: "Grammar Mini-Lesson",
    subject: "Language Arts",
    kind: "lesson",
    objective: "Identify complete subjects and predicates in short passages.",
    estimatedMinutes: 30,
    status: "ready",
    standards: ["CCSS.ELA-LITERACY.L.4.1"],
    goals: ["Faster sentence parsing"],
    materials: ["Fix It Grammar p. 54"],
    artifactSlots: ["practice sample"],
    copilotPrompts: ["Generate three extra examples"],
    sourceLabel: "Fix It Grammar",
    lessonLabel: "Week 27",
  },
  {
    id: "plan-12",
    date: "2026-04-02",
    startTime: "9:45",
    title: "Nature Walk Sketch Notes",
    subject: "Science",
    kind: "project",
    objective: "Capture three observations with labels before co-op starts.",
    estimatedMinutes: 50,
    status: "ready",
    standards: ["NGSS-3-LS3-2"],
    goals: ["More precise observation language"],
    materials: ["field journal", "colored pencils"],
    artifactSlots: ["sketch page"],
    copilotPrompts: ["Turn observations into a review page"],
    sourceLabel: "Nature Study",
    lessonLabel: "Spring Week 4",
  },
  {
    id: "plan-13",
    date: "2026-04-02",
    startTime: "10:55",
    title: "Memory Work and Recitation",
    subject: "Morning Basket",
    kind: "review",
    objective: "Recite the poem and the states-song verse without prompting.",
    estimatedMinutes: 20,
    status: "ready",
    standards: [],
    goals: ["Confident recall"],
    materials: ["memory cards"],
    artifactSlots: ["recitation note"],
    copilotPrompts: ["Draft a recall ladder for tomorrow"],
    sourceLabel: "Morning Basket",
    lessonLabel: "Week 27",
  },
  {
    id: "plan-14",
    date: "2026-04-03",
    startTime: "9:00",
    title: "Weekly Math Checkpoint",
    subject: "Math",
    kind: "review",
    objective: "Show which fraction models are solid and which still need support.",
    estimatedMinutes: 45,
    status: "ready",
    standards: ["CCSS.MATH.CONTENT.4.NF.A.1"],
    goals: ["Clear mastery signal"],
    materials: ["checkpoint sheet", "fraction strips"],
    artifactSlots: ["checkpoint results"],
    copilotPrompts: ["Summarize strengths and gaps for next week"],
    sourceLabel: "Family Assessment Block",
    lessonLabel: "Friday Review",
  },
  {
    id: "plan-15",
    date: "2026-04-03",
    startTime: "10:00",
    title: "Portfolio Reflection",
    subject: "Reflection",
    kind: "review",
    objective: "Choose one proud moment and one task to revisit next week.",
    estimatedMinutes: 30,
    status: "ready",
    standards: [],
    goals: ["Self-reflection"],
    materials: ["portfolio binder"],
    artifactSlots: ["reflection note"],
    copilotPrompts: ["Draft a one-paragraph weekly summary"],
    sourceLabel: "Weekly Wrap",
    lessonLabel: "Friday Reflection",
  },
];

function getConstraint(date: string) {
  const constraint = constraints.find((item) => item.date === date);

  if (!constraint) {
    throw new Error(`Missing planning constraint for ${date}`);
  }

  return constraint;
}

function getItemsForDate(date: string) {
  return planItems.filter((item) => item.date === date);
}

function getScheduledMinutes(items: PlanItem[]) {
  return items.reduce((total, item) => total + item.estimatedMinutes, 0);
}

function getLoad(bufferMinutes: number): DayLoad {
  if (bufferMinutes >= 45) {
    return "light";
  }

  if (bufferMinutes >= 10) {
    return "balanced";
  }

  return "packed";
}

function getAlerts(
  items: PlanItem[],
  bufferMinutes: number,
  constraint: ScheduleConstraint
) {
  const alerts: string[] = [];

  if (items.some((item) => item.status === "carried_over")) {
    alerts.push("Carryover is already in the day. Protect margin before adding extras.");
  }

  if (constraint.energy === "low") {
    alerts.push("Energy is forecast low. Front-load the highest-friction lesson.");
  }

  if (bufferMinutes < 0) {
    alerts.push("The day is overscheduled. A reschedule or compression pass is needed.");
  }

  return alerts;
}

function buildRecoveryOptions(
  date: string,
  items: PlanItem[],
  constraint: ScheduleConstraint,
  bufferMinutes: number
) {
  const options: RecoveryOption[] = [];
  const carryoverItems = items.filter((item) => item.status === "carried_over");
  const lastFlexibleItem = [...items]
    .reverse()
    .find((item) => item.kind !== "lesson" && item.status !== "completed");

  if (carryoverItems.length > 0) {
    options.push({
      id: `${date}-recover-carryover`,
      title: "Anchor the carried-over science block before lunch",
      rationale:
        "A small unfinished review task is easier to lose twice. Placing it early closes the loop without crowding the afternoon.",
      impact: "Recovers 25 minutes of prior work without changing the rest of the week.",
      actionLabel: "Keep carryover on this day",
      action: {
        type: "recover",
        itemIds: carryoverItems.map((item) => item.id),
      },
    });
  }

  if (bufferMinutes < 20 && lastFlexibleItem) {
    options.push({
      id: `${date}-compress-flex`,
      title: `Compress ${lastFlexibleItem.title}`,
      rationale:
        "A shorter review or project block can give the day breathing room while preserving the core lesson sequence.",
      impact: `Recovers about ${Math.min(20, lastFlexibleItem.estimatedMinutes - 15)} minutes of margin.`,
      actionLabel: "Create a compressed version",
      action: {
        type: "compress",
        itemIds: [lastFlexibleItem.id],
        minutesDelta: -Math.min(20, lastFlexibleItem.estimatedMinutes - 15),
      },
    });
  }

  if (constraint.energy === "low") {
    const firstLongItem = items.find((item) => item.estimatedMinutes >= 50);

    if (firstLongItem) {
      options.push({
        id: `${date}-reschedule-long`,
        title: `Move ${firstLongItem.title} to a deeper-work day`,
        rationale:
          "Low-energy days are better for maintenance blocks than concept-heavy practice.",
        impact: "Opens a lighter appointment day and shifts demanding work to Wednesday.",
        actionLabel: "Reschedule to Wednesday",
        action: {
          type: "reschedule",
          itemIds: [firstLongItem.id],
          targetDate: "2026-04-01",
        },
      });
    }
  }

  if (bufferMinutes >= 35) {
    const leadLesson = items.find((item) => item.kind === "lesson");

    if (leadLesson) {
      options.push({
        id: `${date}-expand-lead`,
        title: `Hold extra discussion space for ${leadLesson.title}`,
        rationale:
          "This day has real margin, so the strongest option may be to slow down instead of filling every minute.",
        impact: "Creates a 10-minute reflection add-on without threatening the schedule.",
        actionLabel: "Expand the lead lesson",
        action: {
          type: "expand",
          itemIds: [leadLesson.id],
          minutesDelta: 10,
        },
      });
    }
  }

  return options;
}

function buildDay(date: string): PlanDay {
  const constraint = getConstraint(date);
  const items = getItemsForDate(date);
  const scheduledMinutes = getScheduledMinutes(items);
  const bufferMinutes = constraint.availableMinutes - scheduledMinutes;

  return {
    date,
    label: new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    }).format(new Date(`${date}T12:00:00`)),
    focus:
      items[0]?.subject === "Math"
        ? "Math depth first, then protect room for writing and narration."
        : "Use the highest-energy block for the hardest concept work.",
    availableMinutes: constraint.availableMinutes,
    scheduledMinutes,
    bufferMinutes,
    load: getLoad(bufferMinutes),
    constraint,
    items,
    carryoverItems: items.filter((item) => item.status === "carried_over"),
    recoveryOptions: buildRecoveryOptions(date, items, constraint, bufferMinutes),
    alerts: getAlerts(items, bufferMinutes, constraint),
  };
}

const weekDates = constraints.map((constraint) => constraint.date);

function buildWeeklyPlan() {
  const days = weekDates.map(buildDay);
  const scheduledMinutes = days.reduce((total, day) => total + day.scheduledMinutes, 0);
  const availableMinutes = days.reduce((total, day) => total + day.availableMinutes, 0);
  const bufferMinutes = availableMinutes - scheduledMinutes;
  const standardsFocus = [...new Set(days.flatMap((day) => day.items.flatMap((item) => item.standards)).filter(Boolean))];
  const goalsFocus = [...new Set(days.flatMap((day) => day.items.flatMap((item) => item.goals)).filter(Boolean))];

  return {
    weekOf: weekDates[0],
    weekLabel: "Week of March 30",
    learner,
    days,
    standardsFocus,
    goalsFocus,
    summary: {
      scheduledMinutes,
      availableMinutes,
      bufferMinutes,
      carryoverCount: days.reduce((total, day) => total + day.carryoverItems.length, 0),
      recoveryCount: days.reduce((total, day) => total + day.recoveryOptions.length, 0),
    },
  } satisfies WeeklyPlan;
}

function buildRecoveryPreview(week: WeeklyPlan): RecoveryPreview {
  const options = week.days.flatMap((day) => day.recoveryOptions);

  return {
    openCount: options.length,
    nextBestMove:
      week.days[1]?.constraint.energy === "low"
        ? "Use Wednesday as the overflow valve for Tuesday's appointment day."
        : "Preserve Monday's buffer so carryover does not spread across the week.",
    options,
  };
}

function buildDailyWorkspace(date: string): DailyWorkspace {
  const day = buildDay(date);
  const leadItem = day.items[0];

  if (!leadItem) {
    throw new Error(`No plan items found for ${date}`);
  }

  return {
    date,
    headline: "Run the day with enough structure to adapt in real time.",
    learner,
    leadItem,
    items: day.items,
    prepChecklist: [
      "Lay out math manipulatives and the writing conference notebook before the first block.",
      "Pull the carried-over science journal so it does not disappear behind fresh work.",
      "Hold a two-minute check-in before lunch to decide whether compression is needed.",
    ],
    sessionTargets: [
      "Finish the lead math lesson with written evidence worth saving.",
      "Capture one concrete revision decision during writing.",
      "Close the carried-over science note so the weekly record stays trustworthy.",
    ],
    artifactSlots: [
      {
        label: "Lesson artifacts",
        status: "open",
        description: "Reserved space for generated explanations, worksheets, and teacher notes once the artifact pipeline lands.",
      },
      {
        label: "Copilot follow-ups",
        status: "waiting",
        description: "Planning and reteach prompts can drop here after the copilot surface is merged.",
      },
      {
        label: "Tracking handoff",
        status: "suggested",
        description: "Completion, mastery, and notes should flow from this workspace into the reporting layer.",
      },
    ],
    copilotInsertions: [
      "Simplify today's fraction explanation if Hazel stalls on the visual jump from thirds to sixths.",
      "Convert the writing conference notes into a clean revision checklist.",
      "Draft a short end-of-day summary for tomorrow's planning board.",
    ],
    completionPrompts: [
      "What was fully completed as planned?",
      "Where did pacing slip, and was that because of difficulty or attention?",
      "What needs to carry forward with context intact?",
    ],
    familyNotes: [
      "Afternoons have felt better when lunch stays unhurried.",
      "If math runs long, move read-aloud to the couch instead of dropping it.",
    ],
    recoveryOptions: day.recoveryOptions,
  };
}

export interface PlanningRepository {
  getWeeklyPlan(): WeeklyPlan;
  getPlanningDay(date: string): PlanDay | null;
  getRecoveryPreview(): RecoveryPreview;
  getDailyWorkspace(date: string): DailyWorkspace | null;
}

class MockPlanningRepository implements PlanningRepository {
  getWeeklyPlan() {
    return buildWeeklyPlan();
  }

  getPlanningDay(date: string) {
    if (!weekDates.includes(date)) {
      return null;
    }

    return buildDay(date);
  }

  getRecoveryPreview() {
    return buildRecoveryPreview(buildWeeklyPlan());
  }

  getDailyWorkspace(date: string) {
    if (!weekDates.includes(date)) {
      return null;
    }

    return buildDailyWorkspace(date);
  }
}

const repository = new MockPlanningRepository();

export function getPlanningRepository() {
  return repository;
}
