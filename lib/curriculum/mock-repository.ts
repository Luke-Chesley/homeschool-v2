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
    householdId: "household-demo",
    title: "Singapore Math 4A",
    description: "Primary Mathematics 4A — place value through fractions.",
    kind: "manual",
    academicYear: "2025-2026",
    subjects: ["math"],
    gradeLevels: ["4"],
    indexingStatus: "not_applicable",
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
    sequence: 0,
    estimatedMinutes: 45,
    materials: ["textbook p.1-6", "place value chart"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: SEED_LESSON_2_ID,
    unitId: SEED_UNIT_1_ID,
    title: "Lesson 2 — Numbers to 100,000",
    sequence: 1,
    estimatedMinutes: 45,
    materials: ["textbook p.7-12"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: SEED_LESSON_3_ID,
    unitId: SEED_UNIT_2_ID,
    title: "Lesson 1 — Multiplying by 1-Digit Numbers",
    sequence: 0,
    estimatedMinutes: 60,
    materials: ["textbook p.40-48", "multiplication chart"],
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

class InMemoryCurriculumRepository implements CurriculumRepository {
  private sources = new Map<string, CurriculumSource>(
    seedSources.map((s) => [s.id, s])
  );
  private units = new Map<string, CurriculumUnit>(
    seedUnits.map((u) => [u.id, u])
  );
  private lessons = new Map<string, CurriculumLesson>(
    seedLessons.map((l) => [l.id, l])
  );
  private objectives = new Map<string, CurriculumObjective>(
    seedObjectives.map((o) => [o.id, o])
  );

  private ts() {
    return new Date().toISOString();
  }

  // --- Sources ---

  async listSources(householdId: string): Promise<CurriculumSource[]> {
    return [...this.sources.values()].filter((s) => s.householdId === householdId);
  }

  async getSource(id: string): Promise<CurriculumSource | null> {
    return this.sources.get(id) ?? null;
  }

  async createSource(input: CreateCurriculumSourceInput): Promise<CurriculumSource> {
    const record: CurriculumSource = {
      ...input,
      id: randomUUID(),
      indexingStatus: "not_applicable",
      createdAt: this.ts(),
      updatedAt: this.ts(),
    };
    this.sources.set(record.id, record);
    return record;
  }

  async updateSource(id: string, patch: Partial<CreateCurriculumSourceInput>): Promise<CurriculumSource> {
    const existing = this.sources.get(id);
    if (!existing) throw new Error(`CurriculumSource not found: ${id}`);
    const updated = { ...existing, ...patch, updatedAt: this.ts() };
    this.sources.set(id, updated);
    return updated;
  }

  async deleteSource(id: string): Promise<void> {
    this.sources.delete(id);
  }

  // --- Units ---

  async listUnits(sourceId: string): Promise<CurriculumUnit[]> {
    return [...this.units.values()]
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
    this.units.set(record.id, record);
    return record;
  }

  async updateUnit(id: string, patch: Partial<CreateCurriculumUnitInput>): Promise<CurriculumUnit> {
    const existing = this.units.get(id);
    if (!existing) throw new Error(`CurriculumUnit not found: ${id}`);
    const updated = { ...existing, ...patch, updatedAt: this.ts() };
    this.units.set(id, updated);
    return updated;
  }

  async deleteUnit(id: string): Promise<void> {
    this.units.delete(id);
  }

  // --- Lessons ---

  async listLessons(unitId: string): Promise<CurriculumLesson[]> {
    return [...this.lessons.values()]
      .filter((l) => l.unitId === unitId)
      .sort((a, b) => a.sequence - b.sequence);
  }

  async createLesson(input: CreateCurriculumLessonInput): Promise<CurriculumLesson> {
    const record: CurriculumLesson = {
      ...input,
      id: randomUUID(),
      createdAt: this.ts(),
      updatedAt: this.ts(),
    };
    this.lessons.set(record.id, record);
    return record;
  }

  async updateLesson(id: string, patch: Partial<CreateCurriculumLessonInput>): Promise<CurriculumLesson> {
    const existing = this.lessons.get(id);
    if (!existing) throw new Error(`CurriculumLesson not found: ${id}`);
    const updated = { ...existing, ...patch, updatedAt: this.ts() };
    this.lessons.set(id, updated);
    return updated;
  }

  async deleteLesson(id: string): Promise<void> {
    this.lessons.delete(id);
  }

  // --- Objectives ---

  async listObjectives(params: { lessonId?: string; unitId?: string }): Promise<CurriculumObjective[]> {
    return [...this.objectives.values()].filter((o) => {
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
    this.objectives.set(record.id, record);
    return record;
  }

  async updateObjective(id: string, patch: Partial<CreateCurriculumObjectiveInput>): Promise<CurriculumObjective> {
    const existing = this.objectives.get(id);
    if (!existing) throw new Error(`CurriculumObjective not found: ${id}`);
    const updated = { ...existing, ...patch, updatedAt: this.ts() };
    this.objectives.set(id, updated);
    return updated;
  }

  async deleteObjective(id: string): Promise<void> {
    this.objectives.delete(id);
  }

  // --- Tree ---

  async getTree(sourceId: string): Promise<CurriculumTree | null> {
    const source = this.sources.get(sourceId);
    if (!source) return null;

    const units = await this.listUnits(sourceId);

    const treeUnits = await Promise.all(
      units.map(async (unit) => {
        const lessons = await this.listLessons(unit.id);
        const unitObjectives = await this.listObjectives({ unitId: unit.id });

        const lessonsWithObjectives = await Promise.all(
          lessons.map(async (lesson) => ({
            lesson,
            objectives: await this.listObjectives({ lessonId: lesson.id }),
          }))
        );

        return {
          unit,
          lessons: lessonsWithObjectives,
          objectives: unitObjectives,
        };
      })
    );

    return { source, units: treeUnits };
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
