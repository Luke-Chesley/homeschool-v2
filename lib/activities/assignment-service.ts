import "server-only";

import { createRepositories } from "@/lib/db";
import { getDb } from "@/lib/db/server";
import { getTodayWorkspace } from "@/lib/planning/today-service";
import type { PlanItem } from "@/lib/planning/types";

function buildGuidedPracticeDefinition(planItem: PlanItem) {
  return {
    kind: "guided_practice" as const,
    title: `${planItem.title} practice`,
    instructions: `Work through ${planItem.title} and capture what you can explain clearly.`,
    workedExample: {
      text: `Goal: ${planItem.objective}`,
    },
    steps: [
      {
        id: `${planItem.id}-focus`,
        instruction: {
          text: `In your own words, explain the focus for this ${planItem.subject.toLowerCase()} session.`,
        },
        hint: planItem.objective,
      },
      {
        id: `${planItem.id}-core`,
        instruction: {
          text: `Complete the core work for "${planItem.title}" and record the key step or answer you reached.`,
        },
        hint: planItem.materials.join(" · "),
      },
      {
        id: `${planItem.id}-reflect`,
        instruction: {
          text: "What felt clear, and what needs another pass before you move on?",
        },
      },
    ],
  };
}

function buildReflectionDefinition(planItem: PlanItem) {
  return {
    kind: "reflection" as const,
    title: `${planItem.title} reflection`,
    instructions: `Capture what happened in this ${planItem.subject.toLowerCase()} session.`,
    prompts: [
      {
        id: `${planItem.id}-summary`,
        prompt: { text: `What happened during ${planItem.title}?` },
        responseKind: "text" as const,
      },
      {
        id: `${planItem.id}-confidence`,
        prompt: { text: "How confident do you feel about this work now?" },
        responseKind: "rating" as const,
        ratingLabels: ["Not yet", "Strong"],
      },
      {
        id: `${planItem.id}-next`,
        prompt: { text: "What should happen next?" },
        responseKind: "text" as const,
      },
    ],
  };
}

function buildChecklistDefinition(planItem: PlanItem) {
  return {
    kind: "checklist" as const,
    title: `${planItem.title} checklist`,
    instructions: `Work through ${planItem.title} and confirm each required step before you submit.`,
    allowPartialSubmit: false,
    items: [
      {
        id: `${planItem.id}-ready`,
        label: "Review the objective",
        description: planItem.objective,
      },
      {
        id: `${planItem.id}-complete`,
        label: "Finish the assigned work",
        description: planItem.materials.join(" · "),
      },
      {
        id: `${planItem.id}-reflect`,
        label: "Record what still needs attention",
        description: "Use the session notes or reflection prompt before you submit.",
      },
    ],
  };
}

function buildRubricResponseDefinition(planItem: PlanItem) {
  return {
    kind: "rubric_response" as const,
    title: `${planItem.title} rubric check`,
    instructions: `Score the work against the rubric and capture a short justification.`,
    prompt: {
      text: `Use this response to record how ${planItem.title} went and what should happen next.`,
    },
    criteria: [
      {
        id: `${planItem.id}-clarity`,
        label: "Clarity",
        description: "How clearly did the learner explain or demonstrate the target?",
      },
      {
        id: `${planItem.id}-accuracy`,
        label: "Accuracy",
        description: "How accurate was the work sample or explanation?",
      },
      {
        id: `${planItem.id}-independence`,
        label: "Independence",
        description: "How much support was needed to finish the session?",
      },
    ],
    levels: [
      { value: 1, label: "Needs support", description: "Another pass is needed before moving on." },
      { value: 2, label: "Developing", description: "The target is partly secure but still needs reinforcement." },
      { value: 3, label: "Ready", description: "The learner is ready for the next planned step." },
    ],
    notePrompt: "Evidence and next-step notes",
  };
}

function buildFileSubmissionDefinition(planItem: PlanItem) {
  return {
    kind: "file_submission" as const,
    title: `${planItem.title} submission`,
    instructions: "Capture the completed work sample and add any handoff notes before submitting.",
    prompt: {
      text: `Upload or describe the artifact for ${planItem.title}, then note anything a reviewer should look for.`,
    },
    accept: [".pdf", ".doc", ".docx", ".jpg", ".png"],
    maxFiles: 3,
    notePrompt: "Submission notes",
  };
}

function buildSupervisorSignOffDefinition(planItem: PlanItem) {
  return {
    kind: "supervisor_sign_off" as const,
    title: `${planItem.title} sign-off`,
    instructions: "Prepare the work for another adult to review and sign off.",
    prompt: {
      text: `Confirm that ${planItem.title} is ready for review, then leave a short note for the reviewer.`,
    },
    items: [
      {
        id: `${planItem.id}-artifact`,
        label: "Work sample is attached or described",
      },
      {
        id: `${planItem.id}-notes`,
        label: "Context and blockers are recorded",
      },
    ],
    notePrompt: "Notes for the reviewer",
    acknowledgmentLabel: "I am ready for another adult to review this session.",
  };
}

function buildActivityBlueprint(planItem: PlanItem, workflowMode: string) {
  if (planItem.kind === "review" || planItem.subject.toLowerCase() === "reflection") {
    if (workflowMode === "manager_led" || workflowMode === "cohort_based") {
      return {
        activityType:
          workflowMode === "manager_led" ? ("supervisor_sign_off" as const) : ("rubric_response" as const),
        definition:
          workflowMode === "manager_led"
            ? buildSupervisorSignOffDefinition(planItem)
            : buildRubricResponseDefinition(planItem),
      };
    }

    return {
      activityType: "reflection" as const,
      definition: buildReflectionDefinition(planItem),
    };
  }

  switch (workflowMode) {
    case "self_guided":
      return {
        activityType: "checklist" as const,
        definition: buildChecklistDefinition(planItem),
      };
    case "cohort_based":
      return {
        activityType: "rubric_response" as const,
        definition: buildRubricResponseDefinition(planItem),
      };
    case "manager_led":
      return {
        activityType: "file_submission" as const,
        definition: buildFileSubmissionDefinition(planItem),
      };
    default:
      return {
        activityType: "guided_practice" as const,
        definition: buildGuidedPracticeDefinition(planItem),
      };
  }
}

export async function ensurePublishedActivitiesForLearner(params: {
  organizationId: string;
  learnerId: string;
  learnerName: string;
  sourceId?: string;
  date?: string;
}) {
  const repos = createRepositories(getDb());
  const platformSettings = await repos.organizations.findPlatformSettings(params.organizationId);
  const workflowMode = platformSettings?.workflowMode ?? "family_guided";
  const date = params.date ?? new Date().toISOString().slice(0, 10);
  const workspaceResult = await getTodayWorkspace({
    organizationId: params.organizationId,
    learnerId: params.learnerId,
    learnerName: params.learnerName,
    date,
    sourceId: params.sourceId,
  });

  if (!workspaceResult) {
    return [];
  }

  for (const planItem of workspaceResult.workspace.items) {
    const durablePlanItemId = planItem.planRecordId ?? planItem.workflow?.planItemId;
    const durableSessionId = planItem.sessionRecordId ?? planItem.workflow?.lessonSessionId;

    if (!durablePlanItemId || !durableSessionId) {
      continue;
    }

    const existingActivities = await repos.activities.listActivitiesForPlanItem(durablePlanItemId);
    const publishedActivity = existingActivities.find((activity) => activity.status === "published");
    if (publishedActivity) {
      continue;
    }

    const activityBlueprint = buildActivityBlueprint(planItem, workflowMode);

    await repos.activities.createActivity({
      organizationId: params.organizationId,
      learnerId: params.learnerId,
      planItemId: durablePlanItemId,
      lessonSessionId: durableSessionId,
      artifactId: null,
      activityType: activityBlueprint.activityType,
      status: "published",
      title: `${planItem.title} activity`,
      schemaVersion: "1",
      definition: activityBlueprint.definition,
      masteryRubric: {
        objective: planItem.objective,
        workflowMode,
      },
      metadata: {
        sessionId: durableSessionId,
        weeklyRouteItemId: planItem.id,
        sourceLabel: planItem.sourceLabel,
        lessonLabel: planItem.lessonLabel,
        standardIds: planItem.standards,
      },
    });
  }

  return repos.activities.listPublishedActivitiesForLearner(params.learnerId);
}
