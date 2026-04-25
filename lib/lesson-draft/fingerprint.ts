/**
 * Lesson draft fingerprinting.
 *
 * A lesson draft fingerprint is a stable, deterministic identifier derived
 * from the content of a StructuredLessonDraft. It changes when the draft
 * changes materially — different title, objectives, blocks, or adaptations.
 *
 * The fingerprint is used to:
 *   - Identify which lesson draft version produced an activity
 *   - Detect when an activity is stale (draft changed after generation)
 *   - Prevent activity reuse across materially different lesson drafts
 *
 * Fingerprint stability:
 *   - Same content → same fingerprint (deterministic)
 *   - Different content → different fingerprint
 *   - Does NOT depend on: savedAt, promptVersion, sourceId, or routeFingerprint
 */

import { createHash } from "node:crypto";
import type { StructuredLessonDraft } from "./types";

/**
 * Compute a stable content fingerprint for a StructuredLessonDraft.
 *
 * Only content-bearing fields are included — metadata fields (savedAt,
 * promptVersion) are excluded so that re-saves without content changes
 * do not invalidate the fingerprint.
 *
 * Returns a 16-character hex prefix of a SHA-256 hash.
 */
export function computeLessonDraftFingerprint(draft: StructuredLessonDraft): string {
  const contentKey = JSON.stringify({
    title: draft.title,
    lesson_focus: draft.lesson_focus,
    primary_objectives: draft.primary_objectives,
    success_criteria: draft.success_criteria,
    total_minutes: draft.total_minutes,
    lesson_shape: draft.lesson_shape ?? null,
    assessment_artifact: draft.assessment_artifact ?? null,
    visual_aids: (draft.visual_aids ?? []).map((visualAid) => ({
      id: visualAid.id,
      title: visualAid.title,
      kind: visualAid.kind,
      url: visualAid.url,
      alt: visualAid.alt,
      caption: visualAid.caption ?? null,
      usage_note: visualAid.usage_note ?? null,
      source_name: visualAid.source_name ?? null,
    })),
    blocks: draft.blocks.map((b) => ({
      type: b.type,
      title: b.title,
      minutes: b.minutes,
      purpose: b.purpose,
      teacher_action: b.teacher_action,
      learner_action: b.learner_action,
      check_for: b.check_for ?? null,
      visual_aid_ids: b.visual_aid_ids ?? [],
      optional: b.optional ?? null,
    })),
    materials: draft.materials,
    adaptations: draft.adaptations.map((a) => ({
      trigger: a.trigger,
      action: a.action,
    })),
  });

  return createHash("sha256").update(contentKey).digest("hex").slice(0, 16);
}
