You are working in the repo Luke-Chesley/homeschool-v2.

Goal:
Add a real global curriculum progression model, but implement it as a two-pass internal generation pipeline while keeping one combined curriculum artifact in storage and in the user-facing product.

Required product behavior:
- The curriculum remains one artifact from the product/user perspective.
- The saved curriculum artifact must include:
  - source
  - pacing
  - document tree
  - units/lessons
  - progression
- Progression is not a separate user-facing object.
- Internally, generation should happen in two passes:
  1. generate the curriculum core
  2. generate/reconcile the progression layer against that core
- Revisions should follow the same pattern:
  1. revise the structural curriculum
  2. regenerate/reconcile progression against the revised structure
- The planner must consume the explicit progression model during initial route generation.

Why this is needed:
- Right now the curriculum prompt produces tree + pacing + units/lessons, but no real global progression graph.
- The import layer currently manufactures weak inferred predecessor ordering from flattened leaf order.
- The planner mostly uses branch weighting plus explicit prerequisites, so global order is underpowered and often feels loose or random.
- We want a correct global progression model without collapsing the curriculum into one giant linear skill list.

Design decision:
- Do NOT make progression a separate top-level product object.
- Do NOT force everything into one huge first-pass prompt.
- Do use one combined artifact with two internal reasoning steps.

Do not ask for clarification. Inspect the code, implement the changes, add tests, and leave the repo in a coherent state.

Work in this order.

1. Define the new combined curriculum artifact shape
Files likely involved:
- lib/prompts/curriculum-draft.ts
- curriculum artifact validation/types
- /contracts/curriculum-artifact.md

Tasks:
- Extend the curriculum artifact with a top-level `progression` section.
- Keep `progression` inside the same canonical curriculum artifact as:
  - source
  - intakeSummary
  - pacing
  - document
  - units
- Do not split progression into a separate top-level product artifact.
- The progression section must support:
  - phases/layers/bands
  - hard prerequisite edges
  - soft sequencing edges
  - optional revisit/co-practice/reinforcement relationships
- Use stable skill references that can be resolved after generation and after normalization.
- Keep the progression model separate from the hierarchical tree.

Acceptance criteria:
- The curriculum artifact now has one combined structure that includes progression.
- Progression is a first-class part of the saved curriculum artifact.

2. Split curriculum generation into two internal passes
Files likely involved:
- curriculum generation service
- lib/prompts/curriculum-draft.ts
- service/orchestration layer for AI generation

Tasks:
- Refactor curriculum generation into:
  Pass 1: curriculum core generation
    - source
    - intakeSummary
    - pacing
    - document
    - units
  Pass 2: progression generation/reconciliation
    - progression phases
    - dependency edges
    - revisit/co-practice structure
- Pass 2 must take the Pass 1 artifact as input.
- Pass 2 should reason over the already-generated tree and unit/lesson outline.
- Final output returned to the rest of the app must be one merged curriculum artifact.

Acceptance criteria:
- Curriculum generation is internally two-pass.
- The rest of the product still receives one combined artifact.

3. Create a dedicated curriculum-core prompt
Files likely involved:
- lib/prompts/curriculum-draft.ts

Tasks:
- Narrow the existing curriculum generation prompt so Pass 1 focuses on:
  - curriculum structure
  - pacing
  - units/lessons
- Remove the burden of inventing the full progression graph in the same response.
- Keep the prompt responsible for the curriculum core only.
- Preserve current quality requirements around granularity, pacing realism, and teachability.

Acceptance criteria:
- Pass 1 prompt produces a coherent curriculum core without needing to solve the full global graph problem at once.

4. Create a dedicated progression-generation prompt
Files likely involved:
- lib/prompts/curriculum-draft.ts
- new prompt helper if needed

Tasks:
- Add a new prompt specifically for progression generation.
- Inputs to Pass 2 should include the generated curriculum core:
  - document tree
  - pacing
  - units/lessons
  - titles/descriptions/objectives/linkedSkillTitles
- Instruct the model to generate:
  - phases/layers/bands
  - hard prerequisite edges
  - recommended-before edges
  - revisit/co-practice/reinforcement relationships
- Explicitly instruct the model:
  - do not assume one skill equals one lesson
  - do not force a single total order
  - use hard edges only when truly gating
  - use softer edges and phases for pedagogical flow
  - allow revisits and recurrence
- Keep the output bounded and structured.

Acceptance criteria:
- Pass 2 prompt produces structured progression data from the curriculum core.
- The progression prompt solves the global ordering problem as a separate reasoning task.

5. Merge the two-pass output into one final artifact
Files likely involved:
- curriculum generation service
- validation layer
- persistence/import layer

Tasks:
- After Pass 2, merge `progression` into the Pass 1 curriculum artifact.
- The merged artifact should become the canonical curriculum artifact used everywhere else.
- Preserve prompt lineage/version information for both passes if useful, but do not make the external artifact shape depend on internal orchestration details.
- Keep the artifact clean and product-facing.

Acceptance criteria:
- The final artifact is one coherent JSON object.
- Internal two-pass orchestration is invisible to the rest of the product.

6. Make curriculum revision two-pass as well
Files likely involved:
- lib/prompts/curriculum-draft.ts
- curriculum revision service/orchestration
- revision validation layer

Tasks:
- Refactor curriculum revision so it follows the same architecture:
  Pass 1: revise the curriculum core
  Pass 2: regenerate/reconcile progression against the revised core
- The UI/user still experiences a single “edit curriculum” action.
- If the edit is narrow, preserve unchanged structure where possible, but always ensure progression is revalidated or regenerated against the final revised core.
- Do not require the model to perfectly update tree + units + progression in one giant response.

Acceptance criteria:
- Curriculum revision is internally two-pass.
- The final revision result is still one combined artifact.

7. Add progression validation
Files likely involved:
- curriculum artifact validation layer
- import/apply services

Tasks:
- Validate the progression section after Pass 2 and again before import/application.
- Required checks:
  - all referenced skills exist
  - no self-loops
  - no duplicate edges
  - allowed dependency kinds only
  - phases contain valid skill refs
  - hard-prerequisite graph is acyclic
- Soft edges can be denser, but still reject nonsense.
- If progression fails validation:
  - retry Pass 2 with correction notes
  - do not silently drop progression

Acceptance criteria:
- Invalid progression data is rejected or retried.
- The system can trust the explicit progression graph it persists.

8. Persist progression as an operational graph
Files likely involved:
- curriculum import/application services
- db schema
- repositories
- normalization/import helpers

Tasks:
- Persist explicit progression data into operational storage.
- Store:
  - phase membership
  - dependency edges
  - dependency kinds
  - authored vs inferred metadata if relevant
- Keep this separate from the document tree storage.
- The planner must be able to query progression directly from operational data.

Acceptance criteria:
- Progression exists as operational persisted data, not only as raw artifact JSON.
- The planner no longer needs to fake global order from flattened leaf traversal.

9. Remove flattened predecessor inference as the main global-order mechanism
Files likely involved:
- lib/curriculum/normalization.ts
- import/apply services
- planner code

Tasks:
- Stop using flattened canonical leaf order as the primary source of global predecessor edges.
- If you keep inferred predecessor logic at all, demote it to fallback/debug metadata only.
- Preserve tree-local order for local sibling ordering and tie-breaking only.
- Do not let fake predecessor inference remain the global planner brain.

Acceptance criteria:
- Explicit progression graph becomes the primary global-order source.
- Flattened predecessor inference is no longer the core sequencing mechanism.

10. Keep the tree and the progression graph as separate concerns
Files likely involved:
- curriculum prompt/types
- normalization
- planner

Tasks:
- Preserve the curriculum tree for organization and local structural meaning.
- Use the progression graph for global pedagogical sequencing.
- Keep local tree order useful for:
  - within-goal-group ordering
  - within-strand ordering
  - tie-breaking when multiple skills are equally eligible
- Do not overload the tree to carry all global progression meaning.

Acceptance criteria:
- Tree structure and progression structure are clearly distinct in code and data.
- Each serves its own role.

11. Rewrite route generation to use the progression graph in first-pass selection
Files likely involved:
- lib/curriculum-routing/service.ts

Tasks:
- Refactor initial weekly route recommendation logic so it uses the explicit progression model directly.
- New high-level route selection behavior:
  1. determine skills eligible under hard prerequisites
  2. prioritize the earliest not-yet-completed phase(s)
  3. within those phases, use soft sequencing edges
  4. then apply branch weighting/profile preferences
  5. then use local tree order as tie-breaker
- Preserve priority for unfinished scheduled/in-progress work where appropriate.
- Do not rely on repair as the main source of sequence coherence.

Acceptance criteria:
- Initial weekly route generation is progression-aware.
- Route generation is no longer mostly branch-weight-driven with later repair cleanup.

12. Distinguish hard constraints from soft ordering in the planner
Files likely involved:
- lib/curriculum-routing/service.ts
- routing types

Tasks:
- Hard prerequisite edges must act as true eligibility gates.
- Recommended-before edges must be ranking signals, not hard blockers.
- Revisit/co-practice relationships must influence resurfacing/reinforcement behavior differently from prerequisites.
- Keep these semantics explicit in planner code.
- Do not collapse all edge types into one generic dependency list.

Acceptance criteria:
- Different progression edge kinds have different planner effects.
- The planner becomes more coherent without becoming brittle.

13. Add revisit/reinforcement handling
Files likely involved:
- progression model
- planner
- learner skill state logic if needed

Tasks:
- Support the idea that a skill may reappear intentionally after initial introduction.
- Use progression metadata to allow revisits, co-practice, and reinforcement.
- Do not represent every revisit as a duplicate top-level skill.
- Keep revisit logic compatible with:
  - spaced practice
  - interleaving
  - application after introduction
- Ensure revisits remain grounded in learner state.

Acceptance criteria:
- The planner can intentionally resurface earlier skills.
- The system no longer behaves as though “introduced once” means “done forever.”

14. Update repair/conflict logic to use the new progression model
Files likely involved:
- lib/curriculum-routing/service.ts

Tasks:
- Refactor repair/conflict detection to use explicit progression semantics.
- Hard prerequisite conflicts remain true blockers.
- Recommended-before conflicts are softer and may allow override.
- Reorder/conflict explanations must refer to the explicit graph, not fake flattened predecessor order.
- Keep repair aligned with the same semantics used in first-pass generation.

Acceptance criteria:
- Repair logic matches planner logic.
- Conflict explanations become more meaningful and less arbitrary.

15. Add observability for progression-aware planning
Files likely involved:
- lib/curriculum-routing/service.ts
- route generation metadata/generationBasis

Tasks:
- Expand route generation metadata to include:
  - active phases
  - hard eligibility filtering summary
  - soft ordering influence summary
  - revisit/co-practice influence summary
- Keep this concise but inspectable.
- Make route generation behavior debuggable without reading all planner code.

Acceptance criteria:
- Route generation metadata reflects progression-aware behavior.
- The planner is easier to debug.

16. Keep lesson planning flexible and downstream
Files likely involved:
- curriculum prompt
- route generation
- lesson-draft generation context

Tasks:
- Ensure the new progression graph improves route generation without forcing one-skill-per-lesson behavior.
- Preserve the distinction between:
  - skill progression
  - lesson composition
- A lesson may still combine multiple skills and repeat earlier skills as needed.
- Do not let the new graph collapse lesson design into linear skill cards.

Acceptance criteria:
- Progression improves planning without over-constraining lesson drafting.
- Multi-skill and revisit-rich lessons remain natural.

17. Update contracts/docs
Files likely involved:
- /contracts/curriculum-artifact.md
- /contracts/contract-index.json
- docs/plans/*
- README/agent docs if affected by contract maintenance rules

Tasks:
- Update the curriculum artifact contract to include the new progression section.
- Explicitly document:
  - raw artifact progression shape
  - internal two-pass generation architecture
  - how progression maps into operational persisted graph
  - how the planner consumes it
- Add/update an implementation note describing the new graph model and two-pass generation pipeline.

Acceptance criteria:
- Contracts reflect the new combined artifact and two-pass generation process.
- Future agents can understand the architecture quickly.

18. Add tests
Tasks:
- Add tests proving:
  - Pass 1 + Pass 2 merge into one valid curriculum artifact
  - progression validation rejects bad references/cycles/duplicate edges
  - route generation respects hard prerequisites
  - route generation prefers earlier phases
  - recommended-before edges affect ranking without hard blocking
  - revisit/co-practice relationships can resurface earlier skills
  - tree order is used only as secondary ordering
  - repair logic uses the explicit graph
  - revision pipeline updates progression coherently after structural edits
- Add a regression test showing why flattened predecessor inference was insufficient.

Acceptance criteria:
- Progression-aware routing and two-pass generation are covered by tests.
- The old loose-order behavior cannot silently return.

19. Clean up naming
Tasks:
- Rename misleading terms where necessary.
- Prefer names like:
  - progression
  - phase
  - hardPrerequisite
  - recommendedBefore
  - revisitAfter
  rather than generic predecessor everywhere.
- Remove stale comments/docs that describe the old flattened-order model as if it were intentional.

Acceptance criteria:
- A reader can tell the system now has a real progression graph and a two-pass curriculum generator.
- Naming no longer encodes the old fake-global-order model.

20. Add an implementation note
File to add:
- docs/plans/two-pass-curriculum-progression-graph.md

Include:
- root cause of current planning looseness
- why tree order alone was insufficient
- why a single huge prompt was rejected
- why separate user-facing artifacts were rejected
- the new “one artifact, two reasoning passes” model
- the progression model
- how persistence changed
- how route generation changed
- how repair changed
- how revisits are handled
- remaining limitations / next recommended step

Implementation constraints:
- Do not create a separate user-facing progression artifact.
- Do not force everything into one giant curriculum generation response.
- Do not reduce the progression model to one total ordered list.
- Do not rely on flattened leaf predecessor inference as the main global-order mechanism.
- Keep the saved curriculum artifact combined.
- Keep lesson composition flexible and downstream of progression.
- Prefer a clean two-pass architecture over patching branch-weight behavior again.

Before finishing:
- Run tests.
- Update any callers still assuming predecessor means flattened local order.
- If any migration is needed, implement the smallest clean migration or document the blocker clearly.