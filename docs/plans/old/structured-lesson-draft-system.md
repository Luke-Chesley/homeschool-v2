# Structured Lesson Draft System

## What Changed

Lesson drafts were previously generated as freeform markdown strings and rendered via `ReactMarkdown`. The system has been replaced with a structured JSON-based lesson draft that separates content generation from UI presentation.

**Files added:**
- `lib/lesson-draft/types.ts` — TypeScript types for the structured schema and block library
- `lib/lesson-draft/validate.ts` — Zod validation, prose-heaviness detection, retry correction notes
- `components/planning/lesson-draft-renderer.tsx` — structured UI renderer (replaces markdown display)
- `scripts/lesson-draft.test.mts` — 43 unit tests covering the new system
- `docs/plans/structured-lesson-draft-system.md` — this file

**Files modified:**
- `lib/prompts/lesson-draft.ts` — rewritten to target structured JSON output (v2.0.0)
- `lib/ai/task-service.ts` — `generateLessonDraft()` now returns `StructuredLessonDraft` with validation + retry
- `lib/planning/types.ts` — `DailyWorkspaceLessonDraft` now has optional `structured` field alongside legacy `markdown`
- `lib/planning/today-service.ts` — `saveTodayLessonDraft()` persists structured data; `readLessonDraftFromMetadata()` handles both formats
- `app/api/ai/lesson-plan/route.ts` — returns `structured` instead of `markdown` in the response
- `components/planning/today-workspace-view.tsx` — uses new renderer; typed `DraftState` handles both structured and legacy
- `components/planning/lesson-plan-panel.tsx` — handles `DraftState`; renders `LessonDraftRenderer` or legacy markdown

## Why Markdown-Style Drafting Was Replaced

The previous system had three structural problems:

1. **Rendering brittleness**: ReactMarkdown rendered opaque text. The UI could not reliably extract semantic parts (objectives, blocks, adaptations) to lay them out distinctly. The result was a long scrolling document, not a scannable teaching tool.

2. **No validation signal**: Markdown generation could silently produce walls of prose, partially complete sections, or miss key operational content (adaptations, success criteria) with no way to detect or retry.

3. **Presentation baked into generation**: Section headers and paragraph structure were part of the model output. Changing the layout required changing the prompt.

## New Lesson Schema

Located in `lib/lesson-draft/types.ts`. Schema version "1.0".

### Required top-level fields

| Field | Type | Notes |
|---|---|---|
| `schema_version` | `"1.0"` | Distinguishes from legacy |
| `title` | `string` | ≤ 150 chars |
| `lesson_focus` | `string` | 1 sentence |
| `primary_objectives` | `string[]` | 1–3 items |
| `success_criteria` | `string[]` | 1–4 observable items |
| `total_minutes` | `number` | Total planned time |
| `blocks` | `LessonBlock[]` | Ordered lesson sequence |
| `materials` | `string[]` | All materials for the lesson |
| `teacher_notes` | `string[]` | Short bullets for live use |
| `adaptations` | `LessonAdaptation[]` | Structured adaptation cases |

### Optional top-level fields

`prep`, `assessment_artifact`, `extension`, `follow_through`, `co_teacher_notes`, `accommodations`, `lesson_shape`

### Shared block shape

```typescript
{
  type: LessonBlockType;     // one of 15 supported types
  title: string;             // ≤ 10 words
  minutes: number;
  purpose: string;           // 1 sentence
  teacher_action: string;    // 1–2 sentences
  learner_action: string;    // 1–2 sentences
  check_for?: string;        // 1 sentence visible check
  materials_needed?: string[];
  optional?: boolean;        // can skip if time is short
}
```

### Adaptation shape

```typescript
{
  trigger: "if_struggles" | "if_finishes_early" | "if_attention_drops" | "if_materials_missing" | string;
  action: string;  // 1–2 sentences
}
```

## Bounded Block Library

15 allowed block types (`LESSON_BLOCK_TYPES` in `types.ts`):

`opener`, `retrieval`, `warm_up`, `model`, `guided_practice`, `independent_practice`, `discussion`, `check_for_understanding`, `reflection`, `wrap_up`, `transition`, `movement_break`, `project_work`, `read_aloud`, `demonstration`

The renderer assigns visual groupings to these types:
- **Instructional** (blue-left border): `model`, `guided_practice`, `independent_practice`, `demonstration`, `read_aloud`, `project_work`
- **Check/close** (green-left border): `check_for_understanding`, `reflection`
- **Movement** (muted border): `movement_break`, `transition`
- **Other** (default border): all remaining types

Not every lesson uses all block types. The model selects only the types relevant to the current lesson and content shape.

## How UI Rendering Works

`LessonDraftRenderer` (`components/planning/lesson-draft-renderer.tsx`) is a presentation-layer component that takes a `StructuredLessonDraft` and a `mode` prop (`"full"` or `"compact"`).

Layout sections in order:
1. **Header strip** — title, total time, lesson shape badge, block count
2. **Objectives and done-when** — two-column grid
3. **Lesson flow** — one `BlockCard` per block, with left-border accent by type group
4. **Materials** — compact checklist
5. **Adaptations** — grid of trigger/action cards
6. **Teacher notes** — short bullet list
7. **Optional modules** (full mode only) — `prep`, `assessment_artifact`, `extension`, `follow_through`, `accommodations`, `co_teacher_notes`

The schema is independent of this layout. Future views (print, compact mobile, parent-only, learner-facing) can be added as new renderer configurations without changing the schema or generation prompt.

Legacy drafts (markdown-only, promptVersion ≤ 1.3.0) are rendered with `MarkdownContent` and shown a notice prompting regeneration.

## Persistence and Versioning

**No DB migration required.** The `generatedArtifacts.body` field is a `text` column that previously held markdown. It now stores a JSON string of `StructuredLessonDraft`. The `sourceContext` metadata includes `schemaVersion: "1.0"` so old and new artifacts can be distinguished without parsing the body.

The `planDays.metadata.todayLessonDrafts[sourceId][fingerprint]` cache entry:
- **New format**: has `structured` key containing the full `StructuredLessonDraft` object
- **Legacy format**: has `markdown` key containing the markdown string

`readLessonDraftFromMetadata()` in `today-service.ts` handles both cases. `DailyWorkspaceLessonDraft` in `types.ts` has both `structured?: StructuredLessonDraft` and `markdown?: string` as optional fields.

## Validation Rules

Enforced in `lib/lesson-draft/validate.ts` via Zod:

1. All required fields must be present and non-empty
2. Block types must be from the bounded library (15 types)
3. Block `minutes` total must be within ±15% of `total_minutes`
4. At least one instructional block required
5. At least one visible check mechanism required (check_for_understanding block, reflection block, or `check_for` field on any block)
6. Per-field string length limits prevent prose-heavy outputs (teacher_action ≤ 400 chars, etc.)
7. Prose-heaviness detection: blocks with >4 sentence-ending punctuation marks in any action field are flagged

If validation fails, `generateLessonDraft()` retries up to 2 times, injecting correction notes into the conversation turn before retrying.

## Teacher/Parent Context

`LessonDraftInput` now accepts an optional `teacherContext` object:
```typescript
{ subject_comfort?, prep_tolerance?, teaching_style?, role? }
```

This is included in the user prompt to tune the content of blocks and notes without forking the schema. The same schema serves all teaching contexts.

## Meta-Template Support

`LessonDraftInput` accepts an optional `lessonShape` field:
`"balanced" | "direct_instruction" | "discussion_heavy" | "project_based" | "practice_heavy" | "gentle_short_blocks"`

This guides block selection and emphasis at the prompt level without forcing a rigid sequence. The generated lesson still validates against the same schema regardless of shape.

## Remaining Limitations / Next Steps

**TODO: Async dispatch path** — The `dispatchLessonDraft()` path (used via `/api/ai/generate` + Inngest job) now serializes the structured output to JSON string before storing. When a dispatched job's result is surfaced to the client (via polling or websocket), the consumer needs to parse `artifact.body` as JSON and detect `schema_version`. This is currently a manual step. The activity repository layer should be updated to handle the lesson draft body format transparently.

**TODO: Artifact retrieval** — When loading a previously-generated lesson draft from the `generatedArtifacts` table (not the metadata cache), the consumer must parse `body` as JSON and check `schema_version`. There is no utility for this yet. Add a `parseLessonDraftArtifact(body: string | null): AnyLessonDraft | null` helper.

**TODO: Print view** — The renderer structure supports a print view but none is implemented. Add a `mode="print"` variant to `LessonDraftRenderer` that removes interactive elements and expands all optional modules.

**TODO: Learner-facing view** — A stripped-down learner view of the lesson (e.g. just the `learner_action` fields as a checklist) is possible from the same schema but not yet built.

**TODO: Legacy draft regeneration** — There is no UI affordance to regenerate a specific old markdown draft into the new structured format. The "Regenerate" button in `LessonPlanPanel` generates a fresh draft based on current route context, not the old content. A migration path for persistent legacy drafts would be a targeted regeneration workflow.
