import type {
  DailyWorkspace,
  DayLoad,
  PlanDay,
  PlanItem,
  PlanItemOrigin,
  RecoveryOption,
  RecoveryPreview,
  ScheduleConstraint,
  WeeklyRouteItem,
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

const seedPlanItems: PlanItem[] = [
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

const DEMO_WEEKLY_ROUTE_ID = "wroute-demo-2026-03-30";
const DEMO_CURRICULUM_SOURCE_ID = "csource-demo-math-4a";

const seedWeeklyRouteItems: WeeklyRouteItem[] = [
  {
    id: "wrouteitem-1",
    weeklyRouteId: DEMO_WEEKLY_ROUTE_ID,
    sourceId: DEMO_CURRICULUM_SOURCE_ID,
    skillNodeId: "cnode-skill-fractions-number-line",
    skillTitle: "Fractions on a Number Line",
    skillDescription: "Place benchmark fractions and justify the intervals between them.",
    subject: "Math",
    estimatedMinutes: 70,
    recommendedPosition: 1,
    currentPosition: 1,
    scheduledDate: "2026-03-30",
    manualOverrideKind: "none",
    state: "scheduled",
  },
  {
    id: "wrouteitem-2",
    weeklyRouteId: DEMO_WEEKLY_ROUTE_ID,
    sourceId: DEMO_CURRICULUM_SOURCE_ID,
    skillNodeId: "cnode-skill-long-division-area-model",
    skillTitle: "Long Division Practice Set",
    skillDescription: "Apply the area model before moving to the standard algorithm.",
    subject: "Math",
    estimatedMinutes: 65,
    recommendedPosition: 2,
    currentPosition: 2,
    scheduledDate: "2026-03-31",
    manualOverrideKind: "none",
    state: "scheduled",
  },
  {
    id: "wrouteitem-3",
    weeklyRouteId: DEMO_WEEKLY_ROUTE_ID,
    sourceId: DEMO_CURRICULUM_SOURCE_ID,
    skillNodeId: "cnode-skill-biome-classification",
    skillTitle: "Biome Card Sort",
    skillDescription: "Sort plants and animals into biome families using evidence.",
    subject: "Science",
    estimatedMinutes: 55,
    recommendedPosition: 3,
    currentPosition: 3,
    scheduledDate: "2026-03-31",
    manualOverrideKind: "none",
    state: "scheduled",
  },
  {
    id: "wrouteitem-4",
    weeklyRouteId: DEMO_WEEKLY_ROUTE_ID,
    sourceId: DEMO_CURRICULUM_SOURCE_ID,
    skillNodeId: "cnode-skill-fraction-recipe-application",
    skillTitle: "Fractions Recipe Lab",
    skillDescription: "Double and halve ingredient amounts while explaining each change.",
    subject: "Math",
    estimatedMinutes: 80,
    recommendedPosition: 4,
    currentPosition: 4,
    scheduledDate: "2026-04-01",
    manualOverrideKind: "none",
    state: "scheduled",
  },
  {
    id: "wrouteitem-5",
    weeklyRouteId: DEMO_WEEKLY_ROUTE_ID,
    sourceId: DEMO_CURRICULUM_SOURCE_ID,
    skillNodeId: "cnode-skill-geometry-pattern-warmup",
    skillTitle: "Geometry Pattern Warmup",
    skillDescription: "Identify rotational and reflective patterns in tiled figures.",
    subject: "Math",
    estimatedMinutes: 30,
    recommendedPosition: 5,
    currentPosition: 5,
    scheduledDate: "2026-03-31",
    manualOverrideKind: "none",
    state: "queued",
  },
  {
    id: "wrouteitem-6",
    weeklyRouteId: DEMO_WEEKLY_ROUTE_ID,
    sourceId: DEMO_CURRICULUM_SOURCE_ID,
    skillNodeId: "cnode-skill-biome-reflection",
    skillTitle: "Biome Reflection Writeup",
    skillDescription: "Explain one placement decision from the card sort with evidence.",
    subject: "Science",
    estimatedMinutes: 25,
    recommendedPosition: 6,
    currentPosition: 6,
    scheduledDate: "2026-03-31",
    manualOverrideKind: "none",
    state: "queued",
  },
  {
    id: "wrouteitem-7",
    weeklyRouteId: DEMO_WEEKLY_ROUTE_ID,
    sourceId: DEMO_CURRICULUM_SOURCE_ID,
    skillNodeId: "cnode-skill-reading-conference",
    skillTitle: "Independent Reading Conference",
    skillDescription: "Discuss character motivation with evidence from the text.",
    subject: "Reading",
    estimatedMinutes: 35,
    recommendedPosition: 7,
    currentPosition: 7,
    scheduledDate: "2026-04-01",
    manualOverrideKind: "none",
    state: "queued",
  },
  {
    id: "wrouteitem-8",
    weeklyRouteId: DEMO_WEEKLY_ROUTE_ID,
    sourceId: DEMO_CURRICULUM_SOURCE_ID,
    skillNodeId: "cnode-skill-mapmaking-routes",
    skillTitle: "Mapmaking Studio",
    skillDescription: "Label trade routes and key terrain features from recall first.",
    subject: "Geography",
    estimatedMinutes: 60,
    recommendedPosition: 8,
    currentPosition: 8,
    scheduledDate: "2026-04-01",
    manualOverrideKind: "none",
    state: "queued",
  },
];

const seedPlanItemCurriculumLinks = [
  {
    planItemId: "plan-1",
    sourceId: DEMO_CURRICULUM_SOURCE_ID,
    skillNodeId: "cnode-skill-fractions-number-line",
    weeklyRouteItemId: "wrouteitem-1",
    origin: "curriculum_route" as const,
  },
  {
    planItemId: "plan-5",
    sourceId: DEMO_CURRICULUM_SOURCE_ID,
    skillNodeId: "cnode-skill-long-division-area-model",
    weeklyRouteItemId: "wrouteitem-2",
    origin: "curriculum_route" as const,
  },
  {
    planItemId: "plan-7",
    sourceId: DEMO_CURRICULUM_SOURCE_ID,
    skillNodeId: "cnode-skill-biome-classification",
    weeklyRouteItemId: "wrouteitem-3",
    origin: "curriculum_route" as const,
  },
  {
    planItemId: "plan-8",
    sourceId: DEMO_CURRICULUM_SOURCE_ID,
    skillNodeId: "cnode-skill-fraction-recipe-application",
    weeklyRouteItemId: "wrouteitem-4",
    origin: "curriculum_route" as const,
  },
];

type RouteOverrideEventType =
  | "reorder"
  | "pin"
  | "defer"
  | "skip_acknowledged"
  | "repair_applied"
  | "remove_from_week";

interface RouteOverrideEvent {
  id: string;
  weeklyRouteItemId: string;
  eventType: RouteOverrideEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface PlanningStore {
  planItems: PlanItem[];
  weeklyRouteItems: WeeklyRouteItem[];
  routeOverrideEvents: RouteOverrideEvent[];
}

declare global {
  var __planningStore: PlanningStore | undefined;
}

function clonePlanItem(item: PlanItem): PlanItem {
  return {
    ...item,
    standards: [...item.standards],
    goals: [...item.goals],
    materials: [...item.materials],
    artifactSlots: [...item.artifactSlots],
    copilotPrompts: [...item.copilotPrompts],
    curriculum: item.curriculum ? { ...item.curriculum } : undefined,
  };
}

function initializePlanningStore(): PlanningStore {
  const curriculumLinksByPlanItemId = new Map(
    seedPlanItemCurriculumLinks.map((link) => [link.planItemId, link]),
  );

  return {
    planItems: seedPlanItems.map((item) => {
      const link = curriculumLinksByPlanItemId.get(item.id);
      const planOrigin: PlanItemOrigin = link ? link.origin : "manual";
      return {
        ...clonePlanItem(item),
        planOrigin,
        curriculum: link
          ? {
              sourceId: link.sourceId,
              skillNodeId: link.skillNodeId,
              weeklyRouteItemId: link.weeklyRouteItemId,
              origin: link.origin,
            }
          : undefined,
      };
    }),
    weeklyRouteItems: seedWeeklyRouteItems.map((item) => ({ ...item })),
    routeOverrideEvents: [],
  };
}

function getPlanningStore(): PlanningStore {
  globalThis.__planningStore ??= initializePlanningStore();
  return globalThis.__planningStore;
}

function getConstraint(date: string) {
  const constraint = constraints.find((item) => item.date === date);

  if (!constraint) {
    throw new Error(`Missing planning constraint for ${date}`);
  }

  return constraint;
}

function getItemsForDate(date: string) {
  return getPlanningStore()
    .planItems
    .filter((item) => item.date === date)
    .sort((left, right) => {
      if (left.startTime && right.startTime) {
        return left.startTime.localeCompare(right.startTime);
      }
      if (left.startTime) {
        return -1;
      }
      if (right.startTime) {
        return 1;
      }
      return left.title.localeCompare(right.title);
    });
}

function getRouteItemById(routeItemId: string) {
  return getPlanningStore().weeklyRouteItems.find((item) => item.id === routeItemId);
}

function getLinkedPlanItemByRouteItemId(routeItemId: string) {
  return getPlanningStore().planItems.find(
    (item) => item.curriculum?.weeklyRouteItemId === routeItemId,
  );
}

function getSelectableRouteItemsForDate(date: string) {
  return getPlanningStore()
    .weeklyRouteItems
    .filter((item) => {
      if (item.state === "done" || item.state === "removed") {
        return false;
      }
      if (item.scheduledDate !== date) {
        return false;
      }
      return !getLinkedPlanItemByRouteItemId(item.id);
    })
    .sort((left, right) => left.currentPosition - right.currentPosition);
}

function hasCurriculumDuplicateForDate(date: string, skillNodeId: string, excludedPlanItemId?: string) {
  return getPlanningStore().planItems.some((item) => {
    if (item.id === excludedPlanItemId) {
      return false;
    }
    if (item.date !== date) {
      return false;
    }
    return item.curriculum?.skillNodeId === skillNodeId;
  });
}

function shiftDate(date: string, days: number) {
  const source = new Date(`${date}T12:00:00`);
  source.setDate(source.getDate() + days);
  return source.toISOString().slice(0, 10);
}

function createPlanItemFromRouteItem(routeItem: WeeklyRouteItem, date: string): PlanItem {
  const routePlanItemId = `plan-${routeItem.id}`;
  return {
    id: routePlanItemId,
    date,
    title: routeItem.skillTitle,
    subject: routeItem.subject,
    kind: "lesson",
    objective:
      routeItem.skillDescription ??
      "Progress the next guided curriculum skill with clear completion evidence.",
    estimatedMinutes: routeItem.estimatedMinutes,
    status: "ready",
    standards: [],
    goals: [],
    materials: ["Curriculum resource packet"],
    artifactSlots: ["work sample"],
    copilotPrompts: ["Generate one reteach prompt and one extension prompt"],
    sourceLabel: "Guided curriculum route",
    lessonLabel: `Route item ${routeItem.currentPosition}`,
    planOrigin: "curriculum_route",
    curriculum: {
      sourceId: routeItem.sourceId,
      skillNodeId: routeItem.skillNodeId,
      weeklyRouteItemId: routeItem.id,
      origin: "curriculum_route",
    },
  };
}

function getAlternatesForPlanItem(planItem: PlanItem) {
  if (!planItem.curriculum) {
    return [];
  }

  return getPlanningStore()
    .weeklyRouteItems
    .filter((routeItem) => {
      if (routeItem.sourceId !== planItem.curriculum!.sourceId) {
        return false;
      }
      if (routeItem.id === planItem.curriculum!.weeklyRouteItemId) {
        return false;
      }
      if (routeItem.state === "done" || routeItem.state === "removed") {
        return false;
      }
      if (routeItem.scheduledDate !== planItem.date) {
        return false;
      }
      return !getLinkedPlanItemByRouteItemId(routeItem.id);
    })
    .sort((left, right) => left.currentPosition - right.currentPosition);
}

function appendRouteEvent(
  weeklyRouteItemId: string,
  eventType: RouteOverrideEventType,
  payload: Record<string, unknown>,
) {
  const eventId = `routeevent-${getPlanningStore().routeOverrideEvents.length + 1}`;
  getPlanningStore().routeOverrideEvents.push({
    id: eventId,
    weeklyRouteItemId,
    eventType,
    payload,
    createdAt: new Date().toISOString(),
  });
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
  const selectableRouteItems = getSelectableRouteItemsForDate(date);
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
    selectableRouteItems,
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

  const alternatesByPlanItemId = Object.fromEntries(
    day.items.map((item) => [item.id, getAlternatesForPlanItem(item)]),
  );

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
    alternatesByPlanItemId,
  };
}

function selectRouteItemForDay(date: string, weeklyRouteItemId: string) {
  const routeItem = getRouteItemById(weeklyRouteItemId);
  if (!routeItem) {
    throw new Error(`Weekly route item not found: ${weeklyRouteItemId}`);
  }

  if (routeItem.state === "done" || routeItem.state === "removed") {
    throw new Error(`Weekly route item is not schedulable: ${weeklyRouteItemId}`);
  }

  const existing = getLinkedPlanItemByRouteItemId(weeklyRouteItemId);
  if (existing) {
    if (existing.date !== date) {
      if (hasCurriculumDuplicateForDate(date, routeItem.skillNodeId, existing.id)) {
        throw new Error("Cannot move item: target date already has the same curriculum skill scheduled.");
      }
      existing.date = date;
      existing.status = "carried_over";
      existing.planOrigin = "recovery";
      if (existing.curriculum) {
        existing.curriculum.origin = "recovery";
      }
      routeItem.manualOverrideKind = "deferred";
      appendRouteEvent(weeklyRouteItemId, "defer", {
        fromDate: routeItem.scheduledDate ?? null,
        toDate: date,
        planItemId: existing.id,
      });
    }
    routeItem.scheduledDate = date;
    routeItem.state = "scheduled";
    return existing;
  }

  if (hasCurriculumDuplicateForDate(date, routeItem.skillNodeId)) {
    throw new Error("Cannot schedule duplicate curriculum skill for the same day.");
  }

  const planItem = createPlanItemFromRouteItem(routeItem, date);
  getPlanningStore().planItems.push(planItem);
  routeItem.scheduledDate = date;
  routeItem.state = "scheduled";
  routeItem.manualOverrideKind = "none";
  return planItem;
}

function pushPlanItemToNextDay(planItemId: string) {
  const item = getPlanningStore().planItems.find((candidate) => candidate.id === planItemId);
  if (!item) {
    throw new Error(`Plan item not found: ${planItemId}`);
  }

  const nextDate = shiftDate(item.date, 1);
  if (!weekDates.includes(nextDate)) {
    throw new Error(`Cannot push item beyond the active planning week: ${item.date}`);
  }

  if (item.curriculum && hasCurriculumDuplicateForDate(nextDate, item.curriculum.skillNodeId, item.id)) {
    throw new Error("Cannot defer: target date already has this curriculum skill.");
  }

  const previousDate = item.date;
  item.date = nextDate;
  item.status = "carried_over";
  item.note = `Deferred from ${previousDate} to ${nextDate}.`;

  if (item.curriculum) {
    item.planOrigin = "recovery";
    item.curriculum.origin = "recovery";
    const routeItem = getRouteItemById(item.curriculum.weeklyRouteItemId);
    if (routeItem) {
      routeItem.scheduledDate = nextDate;
      routeItem.state = "scheduled";
      routeItem.manualOverrideKind = "deferred";
      appendRouteEvent(routeItem.id, "defer", {
        fromDate: previousDate,
        toDate: nextDate,
        planItemId: item.id,
      });
    }
  }

  return item;
}

function markPlanItemComplete(planItemId: string) {
  const item = getPlanningStore().planItems.find((candidate) => candidate.id === planItemId);
  if (!item) {
    throw new Error(`Plan item not found: ${planItemId}`);
  }

  item.status = "completed";
  if (item.curriculum) {
    const routeItem = getRouteItemById(item.curriculum.weeklyRouteItemId);
    if (routeItem) {
      routeItem.state = "done";
    }
  }

  return item;
}

function removePlanItemFromDay(planItemId: string) {
  const itemIndex = getPlanningStore().planItems.findIndex((item) => item.id === planItemId);
  if (itemIndex < 0) {
    throw new Error(`Plan item not found: ${planItemId}`);
  }

  const [removed] = getPlanningStore().planItems.splice(itemIndex, 1);
  if (removed.curriculum) {
    const routeItem = getRouteItemById(removed.curriculum.weeklyRouteItemId);
    if (routeItem) {
      routeItem.state = "queued";
      routeItem.scheduledDate = undefined;
      routeItem.manualOverrideKind = "deferred";
      appendRouteEvent(routeItem.id, "remove_from_week", {
        planItemId: removed.id,
        date: removed.date,
      });
    }
  }
}

function swapPlanItemWithAlternate(planItemId: string, alternateWeeklyRouteItemId: string) {
  const item = getPlanningStore().planItems.find((candidate) => candidate.id === planItemId);
  if (!item) {
    throw new Error(`Plan item not found: ${planItemId}`);
  }
  if (!item.curriculum) {
    throw new Error("Only curriculum-backed plan items can be swapped with alternates.");
  }

  const alternate = getRouteItemById(alternateWeeklyRouteItemId);
  if (!alternate) {
    throw new Error(`Alternate weekly route item not found: ${alternateWeeklyRouteItemId}`);
  }
  if (alternate.state === "done" || alternate.state === "removed") {
    throw new Error("Alternate weekly route item is not schedulable.");
  }
  if (getLinkedPlanItemByRouteItemId(alternate.id)) {
    throw new Error("Alternate weekly route item is already linked to another plan item.");
  }
  if (hasCurriculumDuplicateForDate(item.date, alternate.skillNodeId, item.id)) {
    throw new Error("Cannot swap: target day already includes the alternate curriculum skill.");
  }

  const previousRouteItem = getRouteItemById(item.curriculum.weeklyRouteItemId);
  const previousSkillNodeId = item.curriculum.skillNodeId;
  const previousRouteItemId = item.curriculum.weeklyRouteItemId;

  if (previousRouteItem) {
    previousRouteItem.state = "queued";
    previousRouteItem.scheduledDate = item.date;
    previousRouteItem.manualOverrideKind = "deferred";
  }

  alternate.state = "scheduled";
  alternate.scheduledDate = item.date;
  alternate.manualOverrideKind = "reordered";

  item.title = alternate.skillTitle;
  item.subject = alternate.subject;
  item.objective =
    alternate.skillDescription ??
    "Progress the next guided curriculum skill with clear completion evidence.";
  item.estimatedMinutes = alternate.estimatedMinutes;
  item.lessonLabel = `Route item ${alternate.currentPosition}`;
  item.planOrigin = "curriculum_route";
  item.curriculum = {
    sourceId: alternate.sourceId,
    skillNodeId: alternate.skillNodeId,
    weeklyRouteItemId: alternate.id,
    origin: "curriculum_route",
  };
  item.note = `Swapped from ${previousRouteItemId} (${previousSkillNodeId}) to ${alternate.id}.`;

  appendRouteEvent(alternate.id, "repair_applied", {
    planItemId: item.id,
    swappedFromWeeklyRouteItemId: previousRouteItemId,
    swappedToWeeklyRouteItemId: alternate.id,
  });

  return item;
}

export interface PlanningRepository {
  getWeeklyPlan(): WeeklyPlan;
  getPlanningDay(date: string): PlanDay | null;
  getRecoveryPreview(): RecoveryPreview;
  getDailyWorkspace(date: string): DailyWorkspace | null;
  selectRouteItemForDay(date: string, weeklyRouteItemId: string): PlanItem;
  pushPlanItemToNextDay(planItemId: string): PlanItem;
  markPlanItemComplete(planItemId: string): PlanItem;
  removePlanItemFromDay(planItemId: string): void;
  swapPlanItemWithAlternate(planItemId: string, alternateWeeklyRouteItemId: string): PlanItem;
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

  selectRouteItemForDay(date: string, weeklyRouteItemId: string) {
    if (!weekDates.includes(date)) {
      throw new Error(`Cannot select route item for unknown planning date: ${date}`);
    }
    return selectRouteItemForDay(date, weeklyRouteItemId);
  }

  pushPlanItemToNextDay(planItemId: string) {
    return pushPlanItemToNextDay(planItemId);
  }

  markPlanItemComplete(planItemId: string) {
    return markPlanItemComplete(planItemId);
  }

  removePlanItemFromDay(planItemId: string) {
    return removePlanItemFromDay(planItemId);
  }

  swapPlanItemWithAlternate(planItemId: string, alternateWeeklyRouteItemId: string) {
    return swapPlanItemWithAlternate(planItemId, alternateWeeklyRouteItemId);
  }
}

const repository = new MockPlanningRepository();

export function getPlanningRepository() {
  return repository;
}
