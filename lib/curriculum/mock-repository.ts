/**
 * Mock implementation of CurriculumRepository.
 *
 * Uses in-memory data seeded with realistic fixtures so the UI can be
 * developed and demoed without a live database.
 *
 * Integration point: replace `getCurriculumRepository()` return value with a
 * Drizzle-backed implementation once plan 02 is merged.
 */

import { randomUUID } from "crypto";
import { DEMO_HOUSEHOLD_ID } from "./constants";
import type { CurriculumRepository } from "./repository";
import type {
  CurriculumSource,
  CurriculumUnit,
  CurriculumLesson,
  CurriculumObjective,
  CurriculumTree,
  CreateCurriculumSourceInput,
  CreateCurriculumUnitInput,
  CreateCurriculumLessonInput,
  CreateCurriculumObjectiveInput,
} from "./types";

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const now = new Date().toISOString();

const SEED_SOURCE_ID = "00000000-0000-0000-0000-000000000001";
const SEED_UNIT_1_ID = "00000000-0000-0000-0000-000000000010";
const SEED_UNIT_2_ID = "00000000-0000-0000-0000-000000000011";
const SEED_LESSON_1_ID = "00000000-0000-0000-0000-000000000020";
const SEED_LESSON_2_ID = "00000000-0000-0000-0000-000000000021";
const SEED_LESSON_3_ID = "00000000-0000-0000-0000-000000000022";

const seedSources: CurriculumSource[] = [
  {
    id: SEED_SOURCE_ID,
    householdId: DEMO_HOUSEHOLD_ID,
    title: "Singapore Math 4A",
    description: "Primary Mathematics 4A — place value through fractions.",
    kind: "manual",
    status: "active",
    academicYear: "2025-2026",
    subjects: ["math"],
    gradeLevels: ["4"],
    indexingStatus: "not_applicable",
    importVersion: 1,
    createdAt: now,
    updatedAt: now,
  },
];

const seedUnits: CurriculumUnit[] = [
  {
    id: SEED_UNIT_1_ID,
    sourceId: SEED_SOURCE_ID,
    title: "Unit 1 — Whole Numbers to 100,000",
    sequence: 0,
    estimatedWeeks: 3,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: SEED_UNIT_2_ID,
    sourceId: SEED_SOURCE_ID,
    title: "Unit 2 — Multiplication and Division",
    sequence: 1,
    estimatedWeeks: 4,
    createdAt: now,
    updatedAt: now,
  },
];

const seedLessons: CurriculumLesson[] = [
  {
    id: SEED_LESSON_1_ID,
    unitId: SEED_UNIT_1_ID,
    title: "Lesson 1 — Numbers to 10,000",
    subject: "math",
    sequence: 0,
    estimatedMinutes: 45,
    materials: ["textbook p.1-6", "place value chart"],
    objectives: ["Read, write, and represent whole numbers to 10,000."],
    linkedSkillTitles: ["Read and write whole numbers to 10,000"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: SEED_LESSON_2_ID,
    unitId: SEED_UNIT_1_ID,
    title: "Lesson 2 — Numbers to 100,000",
    subject: "math",
    sequence: 1,
    estimatedMinutes: 45,
    materials: ["textbook p.7-12"],
    objectives: ["Understand place value in numbers up to 100,000."],
    linkedSkillTitles: ["Understand place value to 100,000"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: SEED_LESSON_3_ID,
    unitId: SEED_UNIT_2_ID,
    title: "Lesson 1 — Multiplying by 1-Digit Numbers",
    subject: "math",
    sequence: 0,
    estimatedMinutes: 60,
    materials: ["textbook p.40-48", "multiplication chart"],
    objectives: ["Multiply larger numbers by 1-digit factors using place value understanding."],
    linkedSkillTitles: ["Multiply by 1-digit numbers"],
    createdAt: now,
    updatedAt: now,
  },
];

const seedObjectives: CurriculumObjective[] = [
  {
    id: "00000000-0000-0000-0000-000000000030",
    lessonId: SEED_LESSON_1_ID,
    description: "Read, write, and represent whole numbers up to 10,000 in various forms.",
    standardIds: ["CCSS.MATH.CONTENT.4.NBT.A.2"],
    customGoalIds: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "00000000-0000-0000-0000-000000000031",
    lessonId: SEED_LESSON_2_ID,
    description: "Understand the place value of each digit in numbers up to 100,000.",
    standardIds: ["CCSS.MATH.CONTENT.4.NBT.A.1"],
    customGoalIds: [],
    createdAt: now,
    updatedAt: now,
  },
];

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

interface CurriculumStore {
  sources: Map<string, CurriculumSource>;
  units: Map<string, CurriculumUnit>;
  lessons: Map<string, CurriculumLesson>;
  objectives: Map<string, CurriculumObjective>;
}

declare global {
  var __curriculumStore: CurriculumStore | undefined;
}

function getCurriculumStore(): CurriculumStore {
  globalThis.__curriculumStore ??= {
    sources: new Map<string, CurriculumSource>(seedSources.map((s) => [s.id, s])),
    units: new Map<string, CurriculumUnit>(seedUnits.map((u) => [u.id, u])),
    lessons: new Map<string, CurriculumLesson>(seedLessons.map((l) => [l.id, l])),
    objectives: new Map<string, CurriculumObjective>(seedObjectives.map((o) => [o.id, o])),
  };

  return globalThis.__curriculumStore;
}

class InMemoryCurriculumRepository implements CurriculumRepository {
  private store = getCurriculumStore();

  private ts() {
    return new Date().toISOString();
  }

  // --- Sources ---

  async listSources(householdId: string): Promise<CurriculumSource[]> {
    return [...this.store.sources.values()].filter((s) => s.householdId === householdId);
  }

  async getSource(id: string): Promise<CurriculumSource | null> {
    return this.store.sources.get(id) ?? null;
  }

  async createSource(input: CreateCurriculumSourceInput): Promise<CurriculumSource> {
    const record: CurriculumSource = {
      ...input,
      id: randomUUID(),
      status: "draft",
      indexingStatus: "not_applicable",
      importVersion: 1,
      createdAt: this.ts(),
      updatedAt: this.ts(),
    };
    this.store.sources.set(record.id, record);
    return record;
  }

  async updateSource(id: string, patch: Partial<CreateCurriculumSourceInput>): Promise<CurriculumSource> {
    const existing = this.store.sources.get(id);
    if (!existing) throw new Error(`CurriculumSource not found: ${id}`);
    const updated = { ...existing, ...patch, updatedAt: this.ts() };
    this.store.sources.set(id, updated);
    return updated;
  }

  async deleteSource(id: string): Promise<void> {
    this.store.sources.delete(id);
  }

  // --- Units ---

  async listUnits(sourceId: string): Promise<CurriculumUnit[]> {
    return [...this.store.units.values()]
      .filter((u) => u.sourceId === sourceId)
      .sort((a, b) => a.sequence - b.sequence);
  }

  async createUnit(input: CreateCurriculumUnitInput): Promise<CurriculumUnit> {
    const record: CurriculumUnit = {
      ...input,
      id: randomUUID(),
      createdAt: this.ts(),
      updatedAt: this.ts(),
    };
    this.store.units.set(record.id, record);
    return record;
  }

  async updateUnit(id: string, patch: Partial<CreateCurriculumUnitInput>): Promise<CurriculumUnit> {
    const existing = this.store.units.get(id);
    if (!existing) throw new Error(`CurriculumUnit not found: ${id}`);
    const updated = { ...existing, ...patch, updatedAt: this.ts() };
    this.store.units.set(id, updated);
    return updated;
  }

  async deleteUnit(id: string): Promise<void> {
    this.store.units.delete(id);
  }

  // --- Lessons ---

  async listLessons(unitId: string): Promise<CurriculumLesson[]> {
    return [...this.store.lessons.values()]
      .filter((l) => l.unitId === unitId)
      .sort((a, b) => a.sequence - b.sequence);
  }

  async createLesson(input: CreateCurriculumLessonInput): Promise<CurriculumLesson> {
    const record: CurriculumLesson = {
      ...input,
      subject: input.subject,
      objectives: input.objectives ?? [],
      linkedSkillTitles: input.linkedSkillTitles ?? [],
      id: randomUUID(),
      createdAt: this.ts(),
      updatedAt: this.ts(),
    };
    this.store.lessons.set(record.id, record);
    return record;
  }

  async updateLesson(id: string, patch: Partial<CreateCurriculumLessonInput>): Promise<CurriculumLesson> {
    const existing = this.store.lessons.get(id);
    if (!existing) throw new Error(`CurriculumLesson not found: ${id}`);
    const updated = {
      ...existing,
      ...patch,
      objectives: patch.objectives ?? existing.objectives,
      linkedSkillTitles: patch.linkedSkillTitles ?? existing.linkedSkillTitles,
      updatedAt: this.ts(),
    };
    this.store.lessons.set(id, updated);
    return updated;
  }

  async deleteLesson(id: string): Promise<void> {
    this.store.lessons.delete(id);
  }

  // --- Objectives ---

  async listObjectives(params: { lessonId?: string; unitId?: string }): Promise<CurriculumObjective[]> {
    return [...this.store.objectives.values()].filter((o) => {
      if (params.lessonId && o.lessonId === params.lessonId) return true;
      if (params.unitId && o.unitId === params.unitId) return true;
      return false;
    });
  }

  async createObjective(input: CreateCurriculumObjectiveInput): Promise<CurriculumObjective> {
    const record: CurriculumObjective = {
      ...input,
      id: randomUUID(),
      createdAt: this.ts(),
      updatedAt: this.ts(),
    };
    this.store.objectives.set(record.id, record);
    return record;
  }

  async updateObjective(id: string, patch: Partial<CreateCurriculumObjectiveInput>): Promise<CurriculumObjective> {
    const existing = this.store.objectives.get(id);
    if (!existing) throw new Error(`CurriculumObjective not found: ${id}`);
    const updated = { ...existing, ...patch, updatedAt: this.ts() };
    this.store.objectives.set(id, updated);
    return updated;
  }

  async deleteObjective(id: string): Promise<void> {
    this.store.objectives.delete(id);
  }

  // --- Tree ---

  async getTree(sourceId: string): Promise<CurriculumTree | null> {
    const source = this.store.sources.get(sourceId);
    if (!source) return null;

    return {
      source,
      rootNodes: [],
      nodeCount: 0,
      skillCount: 0,
      canonicalSkillNodeIds: [],
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton accessor (integration point)
// ---------------------------------------------------------------------------

let _repo: CurriculumRepository | null = null;

/**
 * Returns the active curriculum repository.
 *
 * Integration point: swap the mock for a real Drizzle implementation here.
 */
export function getCurriculumRepository(): CurriculumRepository {
  if (!_repo) {
    _repo = new InMemoryCurriculumRepository();
  }
  return _repo;
}
