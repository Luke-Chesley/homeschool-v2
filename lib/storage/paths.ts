function sanitizePathSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/^[-/]+|[-/]+$/g, "");
}

export function buildOrganizationStoragePath(organizationId: string, ...segments: string[]) {
  const pathSegments = [organizationId, ...segments]
    .map(sanitizePathSegment)
    .filter(Boolean);

  return pathSegments.join("/");
}

export function buildLearnerStoragePath(
  organizationId: string,
  learnerId: string,
  ...segments: string[]
) {
  return buildOrganizationStoragePath(organizationId, "learners", learnerId, ...segments);
}

export function buildArtifactStoragePath(
  organizationId: string,
  lessonId: string,
  fileName: string,
) {
  return buildOrganizationStoragePath(organizationId, "artifacts", lessonId, fileName);
}
