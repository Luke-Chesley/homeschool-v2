# Vision

> Status: aspirational product direction, not the operational source of truth for the current homeschool beta.
> For the live product and runtime model, use [CURRENT_PRODUCT_AND_RUNTIME_MODEL.md](./CURRENT_PRODUCT_AND_RUNTIME_MODEL.md) and the shared cross-repo traces under `../docs/architecture/`.

## Users

- homeschooling parent
- teacher/tutor
- learner profile managed by an adult

## Problems To Solve

- planning a coherent learning week takes too much manual effort
- curriculum is fragmented across sources
- lesson customization is repetitive
- tracking progress is messy
- adapting plans to learner needs is time-consuming

## Product Principles

- planning first, content second
- AI assists, but parent stays in control
- one clear daily workspace
- curriculum and progress are durable system data
- generated content is editable and versioned

## V1 Ideas Worth Keeping

- curriculum tree: course -> subject -> unit -> lesson/objective
- daily schedule generation from curriculum outcomes
- learner context and teacher/parent context
- lesson-plan generation
- worksheet generation
- calendar/day view
- progress tracking by user and curriculum item

## V1 Ideas To Drop

- `default_user` fallback behavior
- checked-in app database
- mixed session/token approaches
- frontend and backend as separate local-dev apps by default
- long AI calls inside normal request/response handlers
- coupling generated content directly to one opaque JSON blob

## V2 Core Objects

- Organization or Household
- AdultUser
- Learner
- CurriculumSource
- CurriculumItem
- Plan
- PlanDay
- PlanItem
- GeneratedArtifact
- ProgressRecord
- Event

## V2 MVP

1. Auth
2. Learner profiles
3. Curriculum import/manual entry
4. Schedule generation
5. Daily workspace
6. AI lesson draft generation
7. AI worksheet generation
8. Progress tracking

## Non-MVP

- marketplace of curricula
- billing
- multi-school org admin
- complex standards alignment
- parent/child real-time collaboration
