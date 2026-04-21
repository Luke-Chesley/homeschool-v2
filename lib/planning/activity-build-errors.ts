import { z } from "zod";

export type ActivityBuildErrorKind =
  | "artifact_media"
  | "artifact_validation"
  | "transport"
  | "unknown";

export interface ActivityBuildErrorSummary {
  kind: ActivityBuildErrorKind;
  rawMessage: string;
  userMessage: string;
}

function formatZodIssue(issue: z.ZodIssue) {
  const path = issue.path.join(".");
  return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
}

function getRawErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues.map(formatZodIssue).join("; ");
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }

  return "Activity generation failed.";
}

function isMediaValidationError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid url") &&
    (normalized.includes(".src") ||
      normalized.includes("imageurl") ||
      normalized.includes('"src"') ||
      normalized.includes('"imageurl"'))
  );
}

function isArtifactValidationError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("activityspec") ||
    normalized.includes("invalid activityspec") ||
    normalized.includes("artifact.components") ||
    normalized.includes("learning-core returned an invalid")
  );
}

function isTransportError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("fetch failed") ||
    normalized.includes("network") ||
    normalized.includes("socket hang up") ||
    normalized.includes("econnrefused") ||
    normalized.includes("etimedout") ||
    normalized.includes("enotfound")
  );
}

export function summarizeActivityBuildError(error: unknown): ActivityBuildErrorSummary {
  const rawMessage = getRawErrorMessage(error);

  if (isMediaValidationError(rawMessage)) {
    return {
      kind: "artifact_media",
      rawMessage,
      userMessage:
        "We couldn't finish building the learner activity because one generated image or media item was invalid. Retry to rebuild it. The lesson draft is still ready to teach from.",
    };
  }

  if (isArtifactValidationError(rawMessage)) {
    return {
      kind: "artifact_validation",
      rawMessage,
      userMessage:
        "We couldn't finish building the learner activity because the generated activity did not pass validation. Retry to rebuild it. The lesson draft is still ready to teach from.",
    };
  }

  if (isTransportError(rawMessage)) {
    return {
      kind: "transport",
      rawMessage,
      userMessage:
        "We couldn't reach the activity generation service just now. Retry to rebuild it in a moment. The lesson draft is still ready to teach from.",
    };
  }

  return {
    kind: "unknown",
    rawMessage,
    userMessage:
      "We couldn't finish building the learner activity. Retry to rebuild it. The lesson draft is still ready to teach from.",
  };
}
