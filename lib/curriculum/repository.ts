/**
 * Curriculum repository interface.
 *
 * This is the abstraction boundary between the curriculum domain and the data
 * layer. Concrete implementations (Drizzle/Supabase) will be provided once
 * plan 02 lands. Until then, MockCurriculumRepository is used.
 */

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
// Interface
// ---------------------------------------------------------------------------

export interface CurriculumRepository {
  // Sources
  listSources(householdId: string): Promise<CurriculumSource[]>;
  getSource(id: string): Promise<CurriculumSource | null>;
  createSource(input: CreateCurriculumSourceInput): Promise<CurriculumSource>;
  updateSource(id: string, patch: Partial<CreateCurriculumSourceInput>): Promise<CurriculumSource>;
  deleteSource(id: string): Promise<void>;

  // Units
  listUnits(sourceId: string): Promise<CurriculumUnit[]>;
  createUnit(input: CreateCurriculumUnitInput): Promise<CurriculumUnit>;
  updateUnit(id: string, patch: Partial<CreateCurriculumUnitInput>): Promise<CurriculumUnit>;
  deleteUnit(id: string): Promise<void>;

  // Lessons
  listLessons(unitId: string): Promise<CurriculumLesson[]>;
  createLesson(input: CreateCurriculumLessonInput): Promise<CurriculumLesson>;
  updateLesson(id: string, patch: Partial<CreateCurriculumLessonInput>): Promise<CurriculumLesson>;
  deleteLesson(id: string): Promise<void>;

  // Objectives
  listObjectives(params: { lessonId?: string; unitId?: string }): Promise<CurriculumObjective[]>;
  createObjective(input: CreateCurriculumObjectiveInput): Promise<CurriculumObjective>;
  updateObjective(id: string, patch: Partial<CreateCurriculumObjectiveInput>): Promise<CurriculumObjective>;
  deleteObjective(id: string): Promise<void>;

  // Tree
  getTree(sourceId: string): Promise<CurriculumTree | null>;
}
