type PlanningDaysJson = unknown;

/**
 * Returns the day offsets (0 = Monday … 6 = Sunday) that are enabled for
 * auto-scheduling, based on the raw `planningDays` JSON stored on
 * `learnerRouteProfiles.planningDays`.
 *
 * Storage formats supported:
 *   Array:  [true, true, true, true, true, false, false]  (index = day offset)
 *   Object: { "0": true, "1": true, … }
 *   null / undefined / empty → default Mon–Fri [0, 1, 2, 3, 4]
 */
export function getEnabledPlanningDayOffsets(planningDays: PlanningDaysJson): number[] {
  if (!planningDays) {
    return [0, 1, 2, 3, 4];
  }

  if (Array.isArray(planningDays)) {
    const offsets = planningDays
      .map((value, index) => ({ enabled: Boolean(value), index }))
      .filter(({ enabled }) => enabled)
      .map(({ index }) => index);
    return offsets.length > 0 ? offsets : [0, 1, 2, 3, 4];
  }

  if (typeof planningDays === "object" && planningDays !== null) {
    const offsets = Object.entries(planningDays as Record<string, unknown>)
      .filter(([, value]) => Boolean(value))
      .map(([key]) => Number(key))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
      .sort((a, b) => a - b);
    return offsets.length > 0 ? offsets : [0, 1, 2, 3, 4];
  }

  return [0, 1, 2, 3, 4];
}
