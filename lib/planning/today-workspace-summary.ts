import type { DailyWorkspace, PlanItem } from "@/lib/planning/types";

export interface TodayWorkspaceDaySkill {
  item: PlanItem;
  slotId: string | null;
  slotIndex: number | null;
  slotTitle: string | null;
}

export interface TodayWorkspaceDaySummary {
  lessonSlotCount: number;
  skillCount: number;
  totalMinutes: number;
  skills: TodayWorkspaceDaySkill[];
}

export interface TodayWorkspaceSlotSummaryDetail {
  slotId: string;
  slotIndex: number;
  slotTitle: string;
  skillCount: number;
  totalMinutes: number;
}

export function buildTodayWorkspaceDaySummary(
  workspace: DailyWorkspace,
): TodayWorkspaceDaySummary {
  const skills: TodayWorkspaceDaySkill[] = [];
  const seenItemIds = new Set<string>();

  for (const slot of workspace.slots) {
    for (const item of slot.items) {
      if (seenItemIds.has(item.id)) {
        continue;
      }

      seenItemIds.add(item.id);
      skills.push({
        item,
        slotId: slot.id,
        slotIndex: slot.slotIndex,
        slotTitle: slot.title,
      });
    }
  }

  for (const item of workspace.items) {
    if (seenItemIds.has(item.id)) {
      continue;
    }

    seenItemIds.add(item.id);
    skills.push({
      item,
      slotId: item.planDaySlotId ?? null,
      slotIndex: item.planDaySlotIndex ?? null,
      slotTitle: null,
    });
  }

  const slotIds = new Set(workspace.slots.map((slot) => slot.id));
  for (const skill of skills) {
    if (skill.slotId) {
      slotIds.add(skill.slotId);
    }
  }

  return {
    lessonSlotCount:
      slotIds.size > 0 ? slotIds.size : skills.length > 0 ? 1 : 0,
    skillCount: skills.length,
    totalMinutes: skills.reduce((sum, skill) => sum + skill.item.estimatedMinutes, 0),
    skills,
  };
}

export function resolveTodayWorkspaceSlotSummaryDetail(
  workspace: DailyWorkspace,
  slotId?: string | null,
): TodayWorkspaceSlotSummaryDetail | null {
  const resolvedSlot =
    (slotId ? workspace.slots.find((slot) => slot.id === slotId) : null) ??
    (workspace.leadItem.planDaySlotId
      ? workspace.slots.find((slot) => slot.id === workspace.leadItem.planDaySlotId)
      : null) ??
    workspace.slots[0] ??
    null;

  if (!resolvedSlot) {
    return null;
  }

  return {
    slotId: resolvedSlot.id,
    slotIndex: resolvedSlot.slotIndex,
    slotTitle: resolvedSlot.title,
    skillCount: resolvedSlot.items.length,
    totalMinutes: resolvedSlot.items.reduce((sum, item) => sum + item.estimatedMinutes, 0),
  };
}
