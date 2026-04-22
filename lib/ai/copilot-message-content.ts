function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSerializedArtifactAnswer(value: unknown): string | null {
  if (!isRecord(value) || typeof value.answer !== "string") {
    return null;
  }

  if ("actions" in value && !Array.isArray(value.actions)) {
    return null;
  }

  const answer = value.answer.trim();
  return answer.length > 0 ? answer : null;
}

function tryParseSerializedArtifact(candidate: string): string | null {
  try {
    return readSerializedArtifactAnswer(JSON.parse(candidate));
  } catch {
    return null;
  }
}

function findSerializedArtifactStart(content: string): number {
  const pattern = /(^|\n)\s*\{\s*"answer"\s*:/g;
  let start = -1;
  let match: RegExpExecArray | null = null;

  while ((match = pattern.exec(content)) !== null) {
    let candidateStart = match.index + match[1].length;
    while (candidateStart < content.length && /\s/.test(content[candidateStart] ?? "")) {
      candidateStart += 1;
    }
    start = candidateStart;
  }

  return start;
}

export function getRenderableCopilotContent(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) {
    return "";
  }

  const serializedOnlyAnswer = tryParseSerializedArtifact(trimmed);
  if (serializedOnlyAnswer) {
    return serializedOnlyAnswer;
  }

  const serializedArtifactStart = findSerializedArtifactStart(content);
  if (serializedArtifactStart < 0) {
    return trimmed;
  }

  const prefix = content.slice(0, serializedArtifactStart).trim();
  const serializedSuffix = content.slice(serializedArtifactStart).trim();
  const serializedSuffixAnswer = tryParseSerializedArtifact(serializedSuffix);

  if (serializedSuffixAnswer) {
    if (!prefix) {
      return serializedSuffixAnswer;
    }

    return prefix.length >= Math.max(24, Math.floor(serializedSuffixAnswer.length * 0.75))
      ? prefix
      : serializedSuffixAnswer;
  }

  return prefix || trimmed;
}
