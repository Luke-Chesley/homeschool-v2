export const DEFAULT_TARGET_ITEMS_PER_DAY = 1;

export function normalizeTargetItemsPerDay(value: number | null | undefined) {
  const normalized =
    typeof value === "number" && Number.isFinite(value)
      ? Math.floor(value)
      : DEFAULT_TARGET_ITEMS_PER_DAY;

  return Math.max(1, normalized);
}
