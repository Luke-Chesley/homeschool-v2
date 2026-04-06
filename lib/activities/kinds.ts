/**
 * Activity kind taxonomy.
 *
 * ActivityKind describes learning intent — WHY the activity exists.
 * It is separate from component types, which describe HOW the learner interacts.
 * The same component types can be reused across multiple activity kinds.
 */

import { z } from "zod";

export const ActivityKindSchema = z.enum([
  /** Scaffold new skill through guided, step-by-step interaction */
  "guided_practice",
  /** Recall previously learned material (low-stakes retrieval) */
  "retrieval",
  /** Learner demonstrates mastery through a performance or product */
  "demonstration",
  /** Learner explores a scenario, experiment, or model */
  "simulation",
  /** Capture structured discussion or verbal exchange as evidence */
  "discussion_capture",
  /** Structured self-reflection on learning, process, or confidence */
  "reflection",
  /** Open-ended performance task with multi-part evidence */
  "performance_task",
  /** One phase in a longer project */
  "project_step",
  /** Teacher/supervisor observes a real-world activity */
  "observation",
  /** Light-weight mastery check before advancing */
  "assessment_check",
  /** Two or more learners collaborate on a shared task */
  "collaborative",
  /** Core learning happens offline; screen captures structured evidence only */
  "offline_real_world",
]);

export type ActivityKind = z.infer<typeof ActivityKindSchema>;

export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  guided_practice: "Guided Practice",
  retrieval: "Retrieval",
  demonstration: "Demonstration",
  simulation: "Simulation",
  discussion_capture: "Discussion",
  reflection: "Reflection",
  performance_task: "Performance Task",
  project_step: "Project Step",
  observation: "Observation",
  assessment_check: "Assessment Check",
  collaborative: "Collaborative",
  offline_real_world: "Offline / Real-World",
};
