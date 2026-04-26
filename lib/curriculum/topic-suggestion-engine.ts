import { curriculumDomainOptions, type CurriculumIdeaOption } from "./idea-builder-options";

const topicModifiers = [
  "intro to",
  "beginner",
  "hands-on",
  "project-based",
  "real-world",
  "visual",
  "practical",
  "ancient",
  "medieval",
  "modern",
  "Renaissance",
  "early American",
  "European",
  "world",
  "local",
  "backyard",
  "kitchen",
  "outdoor",
];

const broadSubjectTokens = new Set([
  "art",
  "coding",
  "geography",
  "history",
  "language",
  "math",
  "music",
  "reading",
  "science",
  "skills",
  "study",
  "writing",
]);

const regionAndEraTopics = [
  "European history",
  "ancient European history",
  "medieval European history",
  "modern European history",
  "Renaissance Europe",
  "World War II in Europe",
  "Ancient Rome",
  "Ancient Greece",
  "Ancient Egypt",
  "medieval castles",
  "Vikings",
  "the Silk Road",
  "the American Revolution",
  "the Civil War",
  "westward expansion",
  "world religions",
  "African kingdoms",
  "Latin American geography",
  "Asian geography",
  "European geography",
  "state geography",
  "local government",
];

const creativeTopicSeeds = [
  "insect life cycles",
  "backyard entomology",
  "pollinators",
  "forest ecosystems",
  "pond ecology",
  "weather observation",
  "moon phases",
  "constellations",
  "rocket science basics",
  "kitchen chemistry",
  "simple machines",
  "bridge engineering",
  "map reading",
  "story structure",
  "comic book writing",
  "nature journaling",
  "science fair projects",
  "family budgeting",
  "starting a small business",
  "meal planning math",
  "music composition",
  "watercolor landscapes",
  "stop motion animation",
  "robot design",
  "chess openings",
  "chess tactics",
];

function unique(values: string[]) {
  const seen = new Set<string>();
  const nextValues: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    const key = normalizeForSearch(normalized);
    if (!normalized || seen.has(key)) {
      continue;
    }
    seen.add(key);
    nextValues.push(normalized);
  }
  return nextValues;
}

function normalizeForSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function editDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }
    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function tokenScore(query: string, candidate: string) {
  const queryTokens = query.split(" ").filter(Boolean);
  const candidateTokens = candidate.split(" ").filter(Boolean);
  if (queryTokens.length === 0 || candidateTokens.length === 0) {
    return 0;
  }

  let score = 0;
  for (const queryToken of queryTokens) {
    let best = 0;
    for (const candidateToken of candidateTokens) {
      if (candidateToken.startsWith(queryToken)) {
        best = Math.max(best, 14 + queryToken.length);
        continue;
      }
      if (candidateToken.includes(queryToken)) {
        best = Math.max(best, 9 + queryToken.length);
        continue;
      }
      const distance = editDistance(queryToken, candidateToken);
      const allowedDistance = queryToken.length <= 5 ? 0 : 2;
      if (distance <= allowedDistance) {
        best = Math.max(best, 7 - distance);
      }
    }
    score += best;
  }
  return score;
}

function tokenMatches(queryToken: string, candidateToken: string) {
  if (candidateToken.startsWith(queryToken) || candidateToken.includes(queryToken)) {
    return true;
  }
  const distance = editDistance(queryToken, candidateToken);
  const allowedDistance = queryToken.length <= 5 ? 0 : 2;
  return distance <= allowedDistance;
}

function hasSpecificTokenMatch(query: string, candidate: string) {
  const queryTokens = query.split(" ").filter((token) => token && !broadSubjectTokens.has(token));
  if (queryTokens.length === 0) {
    return true;
  }
  const candidateTokens = candidate.split(" ").filter(Boolean);
  return queryTokens.some((queryToken) =>
    candidateTokens.some((candidateToken) => tokenMatches(queryToken, candidateToken)),
  );
}

function buildCandidateTopics(baseTopics: CurriculumIdeaOption[]) {
  const baseValues = baseTopics.map((option) => option.value);
  const generatedValues = baseValues.flatMap((topic) => {
    if (topic.split(/\s+/).length > 3) {
      return [];
    }
    return topicModifiers
      .filter((modifier) => {
        if (topic.includes("history") && topic !== "history") {
          return !["ancient", "medieval", "modern", "Renaissance", "early American", "European", "world", "local"].includes(modifier);
        }
        if (topic.includes("geography") && topic !== "geography") {
          return !["European", "world", "local"].includes(modifier);
        }
        return true;
      })
      .map((modifier) => `${modifier} ${topic}`);
  });
  return unique([...baseValues, ...regionAndEraTopics, ...creativeTopicSeeds, ...generatedValues]);
}

export type TopicSuggestionResult = {
  value: string;
  label: string;
  score: number;
};

export function getLocalTopicSuggestions(
  query: string,
  options: CurriculumIdeaOption[] = curriculumDomainOptions,
  limit = 12,
): TopicSuggestionResult[] {
  const normalizedQuery = normalizeForSearch(query);
  const candidates = buildCandidateTopics(options);

  if (!normalizedQuery) {
    return candidates.slice(0, limit).map((value, index) => ({
      value,
      label: value,
      score: limit - index,
    }));
  }

  return candidates
    .map((value) => {
      const normalizedValue = normalizeForSearch(value);
      if (!hasSpecificTokenMatch(normalizedQuery, normalizedValue)) {
        return { value, label: value, score: 0 };
      }
      let score = tokenScore(normalizedQuery, normalizedValue);
      if (normalizedValue === normalizedQuery) {
        score += 80;
      } else if (normalizedValue.startsWith(normalizedQuery)) {
        score += 45;
      } else if (normalizedValue.includes(normalizedQuery)) {
        score += 28;
      } else {
        const distance = editDistance(normalizedQuery, normalizedValue);
        if (distance <= Math.max(2, Math.ceil(normalizedQuery.length * 0.22))) {
          score += 18 - distance;
        }
      }
      return { value, label: value, score };
    })
    .filter((suggestion) => suggestion.score >= 6)
    .sort((a, b) => b.score - a.score || a.value.localeCompare(b.value))
    .slice(0, limit);
}

export function hasStrongLocalTopicSuggestions(query: string, suggestions: TopicSuggestionResult[]) {
  const normalizedQuery = normalizeForSearch(query);
  if (normalizedQuery.length < 3 || suggestions.length < 5) {
    return false;
  }
  return suggestions.slice(0, 5).some((suggestion) => {
    const normalizedValue = normalizeForSearch(suggestion.value);
    return normalizedValue.startsWith(normalizedQuery) || suggestion.score >= 42;
  });
}

export function normalizeTopicSuggestion(value: string) {
  return value.replace(/\s+/g, " ").trim().replace(/[.。]+$/u, "");
}
