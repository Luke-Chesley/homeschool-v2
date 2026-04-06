You are working in the repo Luke-Chesley/homeschool-v2.

Goal:
Create a first-class contract registry for the generated artifacts in this system so the repo has one clear place to track:
- what each generated component is
- its required vs optional fields
- who produces it
- who consumes it
- where it is persisted
- what invariants/defaults/fallbacks apply
- what versioning/change rules apply

Scope:
At minimum cover these generated artifacts:
1. curriculum generation artifact
2. curriculum revision/edit artifact
3. daily plan / lesson draft artifact
4. activity artifact(s)

Important intent:
This is not just docs for docs’ sake.
The contracts should reflect how the code actually works today.
The repo should make it easy to answer:
- what is the contract?
- where is it produced?
- where is it validated?
- where is it stored?
- what reads it?
- what is required vs optional?
- what defaults/fallbacks exist?
- what breaks if this changes?

Backward compatibility is not the priority. Correctness and clarity are.

Do not ask for clarification. Inspect the codebase, add the contract registry, wire agent instructions to keep it updated, and leave the repo in a coherent state.

Work in this order.

1. Add a top-level contract registry
Create a new top-level directory:

- /contracts/

Add these files:

- /contracts/README.md
- /contracts/_template.md
- /contracts/curriculum-artifact.md
- /contracts/curriculum-revision-artifact.md
- /contracts/lesson-draft-artifact.md
- /contracts/activity-artifact.md
- /contracts/contract-index.json

Purpose of each:
- README: explains what contracts are, how to use them, how to update them
- _template: canonical structure for all contract docs
- the 4 artifact files: actual contract docs
- contract-index.json: machine-readable registry of the contracts and the code paths they map to

Acceptance criteria:
- `/contracts/` exists as a first-class top-level repo directory
- Every target artifact has its own contract doc
- There is both a human-readable index and a machine-readable registry

2. Use a standard format for every contract doc
Every contract markdown file must use the same structure.

Required sections in each contract file:
- Contract name
- Status
- Canonical artifact name
- Purpose
- Current version field(s)
- Producer entrypoints
- Canonical source files
- Consumer entrypoints
- Persistence/storage locations
- Required fields
- Optional fields
- Derived/computed fields
- Defaults/fallbacks
- Validation/invariants
- Ownership / parent-child hierarchy
- Change impact
- Known gaps / TODOs

For fields:
- explicitly separate required vs optional
- explicitly note when a field is conditionally present
- explicitly note where defaults are injected
- explicitly note where the contract is still implicit or only prompt-defined

Acceptance criteria:
- All contract files follow the same shape
- Required/optional/defaulted behavior is easy to scan
- Contract docs are operational, not vague prose

3. Base the contracts on actual code paths, not guesses
Audit the real implementation and map each contract to the actual source files.

At minimum inspect and reflect the current reality in:
- lib/prompts/curriculum-draft.ts
- curriculum import/application/normalization services
- lib/prompts/lesson-draft.ts
- lib/ai/task-service.ts
- app/api/ai/lesson-plan/route.ts
- lib/lesson-draft/types.ts
- lib/lesson-draft/validate.ts
- lib/activities/types.ts
- activity generation/publishing services
- planning/today services where lesson drafts and activities are attached

Do not write generic contracts disconnected from code.
Each contract doc must name the actual producing and consuming files/modules.

Acceptance criteria:
- Every contract doc cites the actual source modules that define or enforce it
- Every contract doc describes current handling, not aspirational handling only

4. Make the curriculum generation contract explicit
In /contracts/curriculum-artifact.md document:
- the curriculum generation prompt output shape
- required top-level sections
- pacing object
- document tree shape
- units and lessons shape
- where lesson/session timing currently lives
- how the curriculum artifact gets normalized/applied to operational data
- what is lost, transformed, or synthesized during import
- what remains only prompt-defined vs code-validated

Be explicit about:
- source.title / metadata
- pacing fields
- document tree
- units.lessons.estimatedMinutes
- linkedSkillTitles / objectives
- any places where operational persistence diverges from raw artifact shape

Acceptance criteria:
- A reader can understand the curriculum artifact without opening the prompt file
- The contract clearly distinguishes raw AI output from normalized operational form

5. Make the curriculum revision/edit contract explicit
In /contracts/curriculum-revision-artifact.md document:
- revision request/response shape
- clarify vs apply modes
- when artifact is omitted
- what “full revised artifact” means
- how the revision contract relates to the base curriculum artifact
- what the parent system expects when revision succeeds

Be explicit about:
- action enum
- assistantMessage
- changeSummary
- artifact presence rules
- inheritance from the base curriculum artifact

Acceptance criteria:
- A reader can see exactly how curriculum edits are expected to behave
- The difference between “clarify” and “apply” is contractually explicit

6. Make the daily plan / lesson draft contract explicit
In /contracts/lesson-draft-artifact.md document:
- the structured lesson draft schema
- required fields vs optional modules
- block schema
- adaptation schema
- timing fields
- validation rules
- prompt versioning
- persistence format
- legacy vs structured handling if it still exists
- where it is generated from
- where it is rendered
- where it is saved in metadata/artifacts

Be explicit about:
- total_minutes
- blocks
- primary_objectives
- success_criteria
- materials
- teacher_notes
- adaptations
- optional fields like prep, extension, follow_through, etc.
- block minute constraints
- required instructional/check rules
- the actual source of lesson timing used today

Acceptance criteria:
- A reader can understand both schema and runtime handling
- Timing/default/fallback behavior is clearly documented

7. Make the activity contract explicit
In /contracts/activity-artifact.md document:
- supported activity kinds
- shared primitives
- per-kind required fields
- parsing/validation behavior
- activity ownership hierarchy
- session/attempt/outcome relationship
- how generated activities relate to lesson drafts
- what is persisted as the durable activity artifact vs runtime session state

Be explicit about:
- ActivityDefinition union
- per-kind schemas
- parseActivityDefinition behavior
- activity session
- attempt state
- outcome/reporting
- lesson-draft ownership vs prior plan-item ownership if relevant
- any places where hybrid/recursive handling is special

Acceptance criteria:
- A reader can understand both the generated definition and the runtime lifecycle
- The doc clearly separates durable activity definition from session/attempt/outcome records

8. Add a machine-readable contract index
Create /contracts/contract-index.json with a stable schema like:

{
  "contracts": [
    {
      "id": "curriculum-artifact",
      "title": "Curriculum Artifact",
      "docPath": "/contracts/curriculum-artifact.md",
      "canonicalSources": [
        "lib/prompts/curriculum-draft.ts"
      ],
      "producerEntrypoints": [
        "..."
      ],
      "consumerEntrypoints": [
        "..."
      ],
      "versionFields": [
        "..."
      ]
    }
  ]
}

This file is not the artifact schema itself.
It is a registry telling future tools/agents where the contract lives.

Acceptance criteria:
- There is one machine-readable registry of contract docs
- It maps each contract to the real code files

9. Add a lightweight contract lint/check script
Create a script such as:
- scripts/check-contracts.mts

Responsibilities:
- verify every contract in contract-index.json has a matching markdown file
- verify every contract doc includes all required sections
- verify all referenced canonical source files exist
- fail loudly if the registry is incomplete or stale structurally

Add a package script if appropriate, e.g.:
- pnpm contracts:check

This is not expected to semantically prove the docs are perfect.
It is there to stop the registry from structurally rotting.

Acceptance criteria:
- Contract registry has a basic automated structural check
- Missing docs/sections/paths are caught automatically

10. Wire contract maintenance into agent instructions
Update all repo-level agent instruction files that exist.

At minimum inspect and update:
- AGENTS.md
- CLAUDE.md

If any additional agent-facing instruction files exist, update those too.

Add a new section like:
- Contract Maintenance
or equivalent

Required instruction:
- If a task changes the shape, required fields, defaults, versioning, persistence, ownership hierarchy, or consumer expectations of a generated artifact, update the matching file in `/contracts/` in the same change.
- If no contract file exists yet for a new generated artifact, create one.
- If a contract file changes, update `/contracts/contract-index.json`.
- If top-level repo structure changes, update README as well.

Do not add fluffy wording. Make it a hard maintenance rule.

Acceptance criteria:
- AGENTS.md and CLAUDE.md both include an explicit contract maintenance rule
- Any future agent changing these artifacts is instructed to keep `/contracts/` up to date

11. Update README to acknowledge the new contracts directory
Because this adds a top-level repo directory, update README.md.

Add:
- `/contracts/` to the repo structure section
- a short explanation that this directory is the artifact contract registry for generated system components

Acceptance criteria:
- README reflects the new top-level `/contracts/` directory
- Repo map stays accurate

12. Use precise terminology and separate raw artifact contracts from operational models
In the contract docs, explicitly distinguish between:
- raw AI artifact shape
- normalized operational representation
- persisted storage shape
- rendered/runtime consumption shape

Example:
- curriculum raw artifact != normalized curriculum nodes
- lesson draft raw artifact != today metadata cache shape
- activity definition != activity session/attempt/outcome

Do not blur these.
The docs should make data transformations obvious.

Acceptance criteria:
- Each contract file explains transformation boundaries clearly
- A reader can see where the artifact shape changes across the system

13. Make required/optional/default behavior explicit everywhere
For every contract doc:
- required means “must be present for a valid artifact”
- optional means “may be omitted without invalidating the artifact”
- derived means “not authored directly; computed from other inputs”
- defaulted means “missing value gets injected by code/prompt/runtime”
- conditional means “present only under specific modes”

Do not just list fields.
Classify them.

Acceptance criteria:
- Every important field is classified
- Hidden defaults/fallbacks are surfaced

14. Do not invent fake precision where the code is still implicit
If part of a contract is currently only prompt-defined and not code-validated, say so plainly.
If a field is only conventionally expected, say so plainly.
If two layers disagree, document the discrepancy.

Do not clean up reality in the docs.
Capture reality.

Acceptance criteria:
- Contract docs are honest about weak spots
- Docs are useful for refactoring, not just for presentation

15. Add “change impact” notes per contract
Each contract doc should include:
- what downstream systems are affected if this contract changes
- what other contract docs must likely be updated
- what entrypoints should be re-tested

Examples:
- changing curriculum pacing fields impacts planning + lesson draft timing
- changing lesson draft timing or ownership impacts activities
- changing activity definition impacts renderer + session/attempt parsing

Acceptance criteria:
- Contract docs help future change planning
- A reader can tell the blast radius of contract changes

16. Final pass
Before finishing:
- run the new contract check script
- run typecheck if any code/scripts/package changes require it
- ensure README, AGENTS.md, CLAUDE.md, contract docs, and contract-index.json are all coherent
- keep the wording terse, specific, and operational

Implementation constraints:
- Prefer `/contracts/` as a top-level first-class directory
- Do not bury this under docs/plans
- Do not make the contract docs aspirational architecture docs
- Do not duplicate huge code blobs into markdown; summarize shape cleanly
- Do not try to generate perfect schemas for things that are still prompt-only unless you also make code changes to support them
- The registry should help humans and agents answer “what is the contract?” quickly