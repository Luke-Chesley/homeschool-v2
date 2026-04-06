export function normalizeCurriculumLabel(value: string) {
  return value
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/^[\s\-–—•*]*\d+(?:[.)]\s*)?/g, "")
    .replace(/^(?:goal|skill|strand|domain|unit|lesson|topic)\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .replace(/[.?!]+$/g, "")
    .trim();
}

export function extractRequestedSubjectLabel(value: string) {
  const normalized = normalizeCurriculumLabel(value);
  if (!normalized) {
    return null;
  }

  const firstClause = splitTopicCandidates(normalized)[0] ?? normalized;
  const cleaned = normalizeCurriculumLabel(
    firstClause
      .replace(
        /^(?:i|we)\s+(?:want|need|hope|would like|want to|need to|hope to)\s+(?:build|create|design|make|plan|study|learn|explore|teach|work on|focus on|cover|practice)\s+/i,
        "",
      )
      .replace(
        /^(?:help me|please help me|help us|please help us)\s+(?:to\s+)?(?:build|create|design|make|plan|study|learn|explore|teach|work on|focus on|cover|practice)\s+/i,
        "",
      )
      .replace(
        /^(?:build|create|design|make|plan|study|learn|explore|teach|work on|focus on|cover|practice)\s+(?:a|an|the)?\s*/i,
        "",
      )
      .replace(
        /^(?:a|an|the)?\s*(?:curriculum|plan|sequence|path|journey|study plan|learning plan|skill path|lesson plan|project)\s+(?:for|about|on)?\s*/i,
        "",
      )
      .replace(
        /\bfor\s+(?:my|the|our)\s+(?:child|learner|student|teen|kid|kids|son|daughter|fourth grader|fifth grader|grader|beginner|student)\b.*$/i,
        "",
      )
      .replace(
        /\b(?:for|with|using|about|around|on|in|through)\s+(?:short|long|weekly|daily|gentle|supported|focused|hands-on|hands on)\b.*$/i,
        "",
      ),
  );

  const studyTargetMatch = cleaned.match(
    /\b(?:to\s+)?(?:study|learn|explore|focus on|cover|practice|work on|teach)\s+(.+?)(?:\s+(?:with|using|through|in|for|during|while|before|after|so|because)\b|$)/i,
  );
  const studyTarget = studyTargetMatch?.[1]?.trim();
  const curriculumTargetMatch = cleaned.match(
    /^(.*?)(?:\s+(?:curriculum|plan|sequence|path|journey|study plan|learning plan|skill path|lesson plan|project)\b.*)$/i,
  );
  const curriculumTarget = curriculumTargetMatch?.[1]?.trim();
  const candidate = studyTarget
    ? normalizeCurriculumLabel(studyTarget)
    : curriculumTarget
      ? normalizeCurriculumLabel(curriculumTarget)
      : cleaned;

  if (!isLikelySubjectLabel(candidate)) {
    return null;
  }

  return candidate;
}

export function normalizeForComparison(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(curriculum|plan|study|learn|build|create|make|design|for|my|our|child|learner|student|please|help|me|us)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isLikelySentenceLabel(value: string) {
  const label = value.trim();
  if (!label) {
    return true;
  }

  if (/[.?!]/.test(label)) {
    return true;
  }

  if (countWords(label) > 10) {
    return true;
  }

  return /\b(i|we|you|they|want|need|hope|please|should|could|would|because|so that|to be able to|will|can)\b/i.test(
    label,
  );
}

export function hasWrapperLabelSignals(value: string) {
  return /\b(curriculum|study sequence|learning plan|learning path|skill path|lesson plan|pathway|journey|framework|overview|foundations|practice|core ideas?|general|miscellaneous|all of|everything about)\b/i.test(
    value,
  );
}

export function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function labelTokenOverlapScore(a: string, b: string) {
  const aTokens = normalizeForComparison(a).split(" ").filter(Boolean);
  const bTokens = normalizeForComparison(b).split(" ").filter(Boolean);

  if (aTokens.length === 0 || bTokens.length === 0) {
    return 0;
  }

  const bSet = new Set(bTokens);
  const overlap = aTokens.filter((token) => bSet.has(token));
  return overlap.length / Math.max(aTokens.length, bTokens.length);
}

export function shortenLabel(value: string, maxLength: number) {
  const normalized = normalizeCurriculumLabel(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

function splitTopicCandidates(value: string) {
  return value
    .split(/(?<=[.!?])\s+|[;:]\s+|,\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isLikelySubjectLabel(value: string) {
  const label = normalizeCurriculumLabel(value);
  if (!label) {
    return false;
  }

  if (isLikelySentenceLabel(label)) {
    return false;
  }

  if (countWords(label) > 8) {
    return false;
  }

  if (hasWrapperLabelSignals(label) && countWords(label) <= 4) {
    return false;
  }

  if (/\b(and|or|then|because|while|when|where|if)\b/i.test(label) && countWords(label) > 4) {
    return false;
  }

  if (/^(welcome|hello|hi|hey|thanks|thank you|greetings|howdy|sure|okay|ok|yes|no|great|alright|cool)$/i.test(label)) {
    return false;
  }

  return true;
}
