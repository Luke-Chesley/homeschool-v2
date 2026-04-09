# Agentic Platform Architecture

## Purpose

This document describes how the platform could evolve from an AI-assisted planning product into an agentic learning operations system.

The goal is not to add a vague "AI agent" layer on top of the current app. The goal is to let bounded model-driven workers observe durable context, call approved tools, run background jobs, and leave behind structured system outputs such as:

- generated artifacts
- interactive activities
- evidence records
- review items
- adaptation insights
- recommendations
- proposed plan changes

This should preserve the product's current control model: AI helps, but the adult or educator remains accountable for meaningful plan, assessment, and reporting decisions.

## Executive Summary

The product now contains most of the foundation needed for an agentic system:

- a separate `learning-core` runtime instead of app-owned prompt execution
- copilot threads, messages, and structured actions
- durable lesson sessions and plan items
- schema-driven interactive activities instead of arbitrary generated code
- evidence, feedback, review queue, and recommendation primitives
- organization templates that already extend beyond homeschooling
- transcript-oriented curriculum drafting patterns

That means the next generation of the product should not be designed as "one chat UI that can do everything." It should be designed as a small set of bounded agents operating over durable learning objects and workflow events.

The best initial bet is not a fully autonomous live tutor. It is an asynchronous loop:

1. plan the work
2. run the session
3. collect attempts, evidence, and optional multimodal signals
4. synthesize what happened
5. propose the next change
6. let the adult approve or override important changes

## Why This Goes Beyond Homeschooling

The broader platform direction is already visible in the current system:

- `Organization` is the top-level model, not `Household`.
- Organization types already include `household`, `tutor_practice`, `co_op`, and `school_like`.
- Platform templates already include `homeschool`, `tutoring_practice`, `classroom_support`, `workforce_onboarding`, `certification_prep`, `bootcamp`, and `self_guided`.
- Workflow modes already vary across `family_guided`, `educator_led`, `manager_led`, `cohort_based`, and `self_guided`.

This matters because agentic behavior should be defined around shared workflow primitives, not homeschool-specific screens.

The durable loop is the same across markets:

- objective or competency
- planned session
- learner activity or evidence
- review and feedback
- recommendation
- replanning

Homeschooling is one template for that loop, not the limit of the system.

## Current Assets In The Repo

The system already has strong architectural anchors for agentic behavior.

### Product and platform direction

- [docs/PRODUCT_IMPLEMENTATION_PLAN.md](/home/luke/Desktop/homeschool-v2/docs/PRODUCT_IMPLEMENTATION_PLAN.md)
- [docs/VISION.md](/home/luke/Desktop/homeschool-v2/docs/VISION.md)
- [lib/platform/settings.ts](/home/luke/Desktop/homeschool-v2/lib/platform/settings.ts)

### Learning-core boundary and operation calls

- [lib/learning-core/operations.ts](/home/luke/Desktop/homeschool-v2/lib/learning-core/operations.ts)
- [lib/learning-core/copilot.ts](/home/luke/Desktop/homeschool-v2/lib/learning-core/copilot.ts)
- [lib/learning-core/session.ts](/home/luke/Desktop/homeschool-v2/lib/learning-core/session.ts)
- [lib/learning-core/curriculum.ts](/home/luke/Desktop/homeschool-v2/lib/learning-core/curriculum.ts)

### Copilot context, threads, and actions

- [app/(parent)/copilot/page.tsx](/home/luke/Desktop/homeschool-v2/app/(parent)/copilot/page.tsx)
- [app/api/ai/chat/route.ts](/home/luke/Desktop/homeschool-v2/app/api/ai/chat/route.ts)
- [lib/ai/copilot-store.ts](/home/luke/Desktop/homeschool-v2/lib/ai/copilot-store.ts)
- [lib/planning/copilot-snapshot.ts](/home/luke/Desktop/homeschool-v2/lib/planning/copilot-snapshot.ts)
- [lib/db/schema/copilot.ts](/home/luke/Desktop/homeschool-v2/lib/db/schema/copilot.ts)

### Planning, sessions, and execution state

- [lib/planning/today-service.ts](/home/luke/Desktop/homeschool-v2/lib/planning/today-service.ts)
- [lib/session-workspace/service.ts](/home/luke/Desktop/homeschool-v2/lib/session-workspace/service.ts)
- [components/planning/today-workspace-view.tsx](/home/luke/Desktop/homeschool-v2/components/planning/today-workspace-view.tsx)

### Activity runtime and adaptive outcomes

- [lib/activities/types.ts](/home/luke/Desktop/homeschool-v2/lib/activities/types.ts)
- [lib/activities/assignment-service.ts](/home/luke/Desktop/homeschool-v2/lib/activities/assignment-service.ts)
- [lib/activities/session-service.ts](/home/luke/Desktop/homeschool-v2/lib/activities/session-service.ts)
- [lib/db/schema/activities.ts](/home/luke/Desktop/homeschool-v2/lib/db/schema/activities.ts)

### Evidence, review, and recommendations

- [lib/db/schema/workflow.ts](/home/luke/Desktop/homeschool-v2/lib/db/schema/workflow.ts)
- [lib/tracking/service.ts](/home/luke/Desktop/homeschool-v2/lib/tracking/service.ts)
- [components/tracking/tracking-overview.tsx](/home/luke/Desktop/homeschool-v2/components/tracking/tracking-overview.tsx)

### Transcript and intake generation patterns

- [lib/curriculum/ai-draft-service.ts](/home/luke/Desktop/homeschool-v2/lib/curriculum/ai-draft-service.ts)
- [app/api/homeschool/onboarding/route.ts](/home/luke/Desktop/homeschool-v2/app/api/homeschool/onboarding/route.ts)

## Working Definition Of Agentic

For this platform, an agent should have four properties:

1. It has scoped context.
2. It can call approved tools.
3. It can act in the background on events or schedules.
4. It writes durable outputs back into the system.

What does not count:

- a plain chat response with no durable effect
- a prompt that returns freeform text with no typed destination
- synchronous model calls that block the main workflow and disappear

What does count:

- a worker that reads the current learner, day plan, and recent evidence, then creates two proposed remediation activities
- a worker that reads a session transcript and writes a structured summary plus evidence candidate links
- a worker that detects repeated struggle and creates a recommendation with payloads that can later modify planning

## Core Architectural Model

### 1. Durable Objects Stay Canonical

The existing architectural choice is correct and should remain in place.

Canonical product state should live in durable domain records such as:

- organization and platform settings
- learner and learner profile
- curriculum source and curriculum item
- plan, plan day, and plan item
- lesson session
- generated artifact
- interactive activity
- activity attempt
- progress record
- evidence record
- review queue item
- adaptation insight
- recommendation

Agents should never become the source of truth. They should observe these records, propose changes to them, or create new ones.

### 2. Agents Are Bounded Workers, Not Personalities

Each agent should own a small job family with explicit inputs and outputs.

Good examples:

- intake agent
- planning agent
- session synthesis agent
- adaptive practice agent
- reporting agent

Bad example:

- one "super tutor" with unrestricted write access across the whole system

### 3. Tools Should Be Domain Actions, Not Raw Database Access

The tool surface should sit above repositories and below prompts.

Examples of read tools:

- `getLearnerContext`
- `getWeeklyPlan`
- `getTodayWorkspace`
- `getSessionEvidence`
- `getObjectiveCoverage`
- `getRecentRecommendations`

Examples of write tools:

- `createGeneratedArtifact`
- `createInteractiveActivity`
- `createEvidenceRecord`
- `createAdaptationInsight`
- `createRecommendation`
- `proposePlanAdjustment`
- `enqueueReviewItem`

The model should not directly compose SQL-like mutations. It should call typed domain tools with authorization, validation, and audit.

### 4. Event-Driven Background Execution Is The Right Backbone

The docs already point toward job-based AI and background orchestration. That should become the standard execution pattern.

Core triggers should include:

- curriculum uploaded
- curriculum draft conversation marked ready
- weekly route generated
- today workspace materialized
- session started
- attempt autosaved
- attempt submitted
- evidence uploaded
- session completed
- review resolved
- recommendation accepted or overridden
- nightly digest window
- weekly planning window

### 5. Approval Is A First-Class Workflow State

Meaningful changes should flow through states like:

- `drafted`
- `proposed`
- `approved`
- `applied`
- `dismissed`
- `superseded`

This protects parent and educator control while still letting the system operate proactively.

## Proposed Agent Roles

### A. Curriculum Intake And Ingestion Agent

#### Job

Turn conversation, uploaded documents, and future multimodal signals into structured curriculum and initial planning assumptions.

#### Reads

- learner profile
- organization template and workflow mode
- intake conversation transcript
- uploaded curriculum assets
- standards or objective frameworks

#### Writes

- captured requirements summary
- curriculum source draft
- curriculum tree draft
- standards mapping suggestions
- ingestion issues and follow-up questions

#### Why It Fits

This pattern already exists in the curriculum AI draft flow, which uses conversation transcripts to build a structured curriculum artifact rather than just returning chat text.

#### Future Multimodal Extension

- voice-first intake for parents or tutors
- photo upload of workbook pages or course outlines
- scanned syllabus to draft units and lessons

### B. Planning Agent

#### Job

Prepare the next teachable plan from curriculum, progress, constraints, and pending issues.

#### Reads

- weekly route
- today workspace
- recent lesson sessions
- recommendations
- review queue
- learner skill state summaries

#### Writes

- lesson draft artifacts
- worksheet or quiz generation requests
- proposed plan adjustments
- carryover suggestions
- pacing recommendations

#### Why It Fits

The current today workspace and lesson-plan generation flow already collects the right context. The system only needs to move from "on-demand generation" to "event-driven preparation."

#### Example

At 7:00 PM, the planning agent notices:

- one skipped lesson
- one completed lesson with struggle
- one review item still open

It then prepares:

- a lighter draft for tomorrow
- one retrieval quiz
- one recommendation to defer the next advanced item

The adult sees a proposed update instead of a blank page.

### C. Session Support Agent

#### Job

Assist during the live session without taking over the experience.

#### Reads

- current lesson session
- active artifact and activity set
- learner history for the lesson or objective
- transcript or live signals if enabled

#### Writes

- suggested explanation variants
- on-the-fly bounded activities
- contextual hints
- live note suggestions

#### Why It Fits

This is where "tool calls and background work" can feel magical without becoming chaotic. The agent should not improvise a whole new curriculum mid-session. It should help the adult or learner recover in the moment.

#### Constraints

- no autonomous plan rewrites during the session
- no arbitrary executable content
- no hidden grading decisions

### D. Session Synthesis Agent

#### Job

After a session ends, synthesize what happened into durable system records.

#### Reads

- lesson session
- plan item
- attempts
- evidence uploads
- adult notes
- optional transcript
- optional oral or video evidence metadata

#### Writes

- session summary
- evidence candidates
- objective links
- misconception notes
- next-step prompts
- adaptation insight

#### Why It Fits

This is the highest-leverage first agent because it reduces reporting burden and improves downstream planning with minimal autonomy risk.

### E. Adaptive Practice Agent

#### Job

Generate the next bounded practice step when the learner is clearly secure, clearly stuck, or inconsistent.

#### Reads

- recent attempts
- objective mappings
- mastery signal
- current workflow mode
- time budget and schedule context

#### Writes

- new quiz
- flashcard set
- guided practice
- checklist
- reflection prompt
- optional escalation to review queue

#### Why It Fits

The activity runtime is already schema-driven. That is exactly the right target for agentic generation because it keeps the system safe, auditable, and adaptable without allowing arbitrary code execution.

#### Rule

The agent should create only supported activity schemas and only within a bounded duration and scope.

### F. Assessment And Review Agent

#### Job

Turn outcomes and evidence into a proposed instructional response.

#### Reads

- progress records
- evidence ledger
- review queue
- skill state summaries
- prior recommendations

#### Writes

- adaptation insight
- recommendation
- draft review summary
- optional parent-facing explanation of why the recommendation exists

#### Why It Fits

A large part of the value of the platform is not content generation. It is converting real learner performance into the next correct instructional move.

### G. Reporting And Compliance Agent

#### Job

Assemble clean records from the underlying evidence graph.

#### Reads

- progress records
- evidence records
- review decisions
- standards or objective coverage
- generated artifacts
- observation notes

#### Writes

- weekly summary artifact
- homeschool record pack draft
- tutor session brief
- cohort progress summary
- manager sign-off packet
- certification readiness brief

#### Why It Fits

This is one of the strongest cross-market applications because reporting overhead exists in every guided learning workflow.

### H. Organization Operations Agent

#### Job

Adapt the system's behavior to the organization's template and workflow mode.

#### Reads

- organization type
- platform settings
- workflow mode
- report defaults
- evidence defaults

#### Writes

- suggested default prompts
- workflow-specific generation presets
- reporting pack defaults
- role-appropriate review routing suggestions

#### Why It Fits

This is how the same underlying system can feel right for homeschooling, tutoring, bootcamps, and onboarding without forking the product model.

## Proposed Tool Surface

The most important design choice is to expose domain tools, not generic chat actions.

| Tool Family | Example Tools | Notes |
| --- | --- | --- |
| Context assembly | `getCopilotContext`, `getTodayWorkspace`, `getLearnerSkillStateSummary` | Read-only grounding tools |
| Planning | `draftLessonPlan`, `proposeScheduleAdjustment`, `queueCarryoverReview` | Writes should default to proposal state |
| Artifact generation | `createLessonArtifact`, `createWorksheetArtifact`, `createInteractiveBlueprint` | Existing artifact lineage fits here |
| Activity runtime | `publishPracticeActivity`, `attachActivityToSession`, `recommendNextActivity` | Must stay schema-driven |
| Evidence and review | `createEvidenceRecord`, `linkEvidenceToObjectives`, `enqueueReviewItem` | Core to trustworthy adaptation |
| Adaptation | `createInsight`, `createRecommendation`, `applyAcceptedRecommendation` | Acceptance flow remains human-controlled |
| Reporting | `generateWeeklySummary`, `buildExportPackDraft` | Output should be reviewable before export |
| Notifications | `notifyParent`, `notifyTutor`, `surfaceDigestCard` | Optional but useful for background agents |

## Event Model

The agent layer should be driven by domain events, not just chat requests.

### Key Events

- `curriculum.asset_uploaded`
- `curriculum.intake_ready`
- `curriculum.source_created`
- `weekly_route.created`
- `today_workspace.materialized`
- `lesson_session.started`
- `activity_attempt.autosaved`
- `activity_attempt.submitted`
- `evidence_record.created`
- `lesson_session.completed`
- `review_queue_item.resolved`
- `recommendation.accepted`
- `schedule.day_closed`
- `schedule.weekly_planning_window_opened`

### Example Event Reactions

- `today_workspace.materialized`
  - prebuild lesson draft
  - prepare one remediation option and one extension option
- `activity_attempt.submitted`
  - write progress and evidence
  - update skill state summary
  - generate adaptation insight
  - optionally create a recommendation
- `lesson_session.completed`
  - create session synthesis
  - compare planned vs actual
  - queue next-day adjustment suggestion
- `schedule.weekly_planning_window_opened`
  - generate weekly digest
  - identify gaps and overload
  - propose replanning actions

## Multimodal Architecture

Multimodal input is where the platform becomes materially more useful than a planner with chat.

### Inputs Worth Supporting

- session audio
- oral learner responses
- photo or scan of handwritten work
- file upload of essays, worksheets, or project artifacts
- whiteboard or notebook images
- optional short video clips for demonstrations or sign-off evidence

### What Multimodal Unlocks

- automatic session notes from real interaction instead of memory-based logging
- evidence capture for oral explanations, reading fluency, and presentations
- misconception detection from spoken reasoning, not just answer correctness
- work-sample linking from photos or scanned pages
- better plan adaptation because the system sees how the learner actually reasoned
- richer review flows for tutors, managers, or parents who were not present live

### Recommended Pipeline

1. capture raw media only with explicit opt-in
2. transcribe or extract text in a background job
3. segment the transcript or OCR text into meaningful moments
4. run bounded analysis tasks over those segments
5. store structured derivatives such as:
   - session summary
   - quoted evidence segment
   - misconception marker
   - mastery indicator
   - suggested next move
6. write only the durable outputs needed for the workflow

### Product Rule

Raw media should not be the primary object that the rest of the product depends on. The core workflow should depend on derived structured records so the system stays portable, searchable, and privacy-manageable.

## Approval And Safety Model

Agentic behavior should be divided into autonomy tiers.

### Tier 0: Read And Explain

Allowed:

- summarize context
- answer questions
- explain why a recommendation exists

No approval required.

### Tier 1: Draft Low-Risk Objects

Allowed:

- create lesson drafts
- create worksheet drafts
- create bounded activities
- create weekly summary drafts

No approval required to draft.
Approval required to publish or apply if the object materially changes the learner plan.

### Tier 2: Propose Operational Changes

Allowed:

- recommend schedule changes
- recommend remediation
- recommend extension
- recommend review escalation

Adult approval required before any durable plan mutation is applied.

### Tier 3: Apply Bounded Automatic Changes

Allowed only under organization policy:

- append one short follow-up practice activity
- mark a low-risk artifact as ready for review
- queue a review item

Should be limited by:

- scope
- time budget
- allowed activity types
- workflow mode

### Tier 4: Restricted Actions

Always require explicit human approval:

- modifying official reports
- changing mastery/completion outcomes that count for compliance
- changing the weekly route materially
- resolving review items
- deleting evidence

## Data Model Extensions

The current schema is close, but a full agentic system likely needs a few additional primitives.

### Recommended Additions

- `agent_runs`
  - which agent ran
  - why it ran
  - event trigger
  - input references
  - output references
  - status
  - cost and latency
- `agent_tool_executions`
  - tool name
  - parameters
  - result reference
  - audit fields
- `approval_requests`
  - proposal subject
  - requested action
  - approver
  - decision state
- `media_assets`
  - storage metadata for audio, image, or video inputs
- `transcript_segments`
  - speaker
  - timestamp range
  - linked session
  - extracted tags
- `derived_observations`
  - misconception markers
  - confidence notes
  - intervention triggers

These do not replace the existing evidence and recommendation model. They support the execution and audit of agent behavior around it.

## UX Implications

Agentic behavior should appear in the UI as helpful workflow state, not as noisy AI theater.

### Parent Workspace

The parent should see:

- what the system prepared in the background
- what it observed
- what it recommends next
- what needs approval

Good UI shapes:

- "Prepared for tomorrow"
- "Observed during today's session"
- "Needs your decision"
- "Suggested next practice"

Bad UI shapes:

- giant AI dashboards
- speculative insight cards with no operational consequence
- extra chat panels that duplicate system state

### Learner Surface

The learner surface should remain simple.

Agentic enhancements should feel like:

- the next activity appears at the right time
- hints adapt when the learner is stuck
- reflection prompts become more specific

They should not feel like:

- constant chat interruption
- identity-heavy AI tutor personas
- unstable lesson flows

## Phased Implementation Plan

### Phase 1: After-Session Synthesis

Build first:

- session synthesis agent
- event trigger on session completion and attempt submission
- summary plus evidence-linking flow
- adaptation insight creation
- recommendation drafting

Why first:

- high leverage
- low autonomy risk
- directly improves planning and reporting

### Phase 2: Prepared Planning

Build next:

- nightly planning agent
- prebuilt lesson draft generation
- remediation and extension suggestions
- digest cards in Today and Planning

Why next:

- reduces blank-page planning work
- uses existing plan and artifact models

### Phase 3: Adaptive Practice

Build next:

- bounded next-step activity generation
- publish only supported activity schemas
- small automatic interventions under policy

Why next:

- directly improves learner responsiveness
- still constrained by the existing activity engine

### Phase 4: Multimodal Session Understanding

Build next:

- transcript ingestion
- oral evidence capture
- photo and OCR evidence linking
- multimodal session synthesis

Why later:

- largest privacy, cost, and trust implications
- strongest upside once the evidence loop is already solid

### Phase 5: Workflow-Specific Agent Packs

Build last:

- homeschool pack
- tutoring pack
- classroom support pack
- onboarding pack
- certification prep pack
- bootcamp pack

Each pack should tune:

- approval rules
- default prompts
- report outputs
- escalation thresholds
- recommended activity types

## Example End-To-End Flows

### Flow 1: Homeschool Daily Session

1. Today workspace materializes.
2. Planning agent drafts tomorrow's lesson and two optional practice artifacts.
3. Learner completes one activity and uploads a photo of written work.
4. Session synthesis agent summarizes the session and links evidence to objectives.
5. Assessment agent creates one recommendation: repeat with scaffold before moving on.
6. Parent accepts the recommendation.
7. Planning agent adjusts tomorrow's route and inserts one guided practice activity.

### Flow 2: Tutor Practice

1. Tutor finishes a live session and records a short voice note.
2. Transcript plus activity outcomes feed the session synthesis agent.
3. The agent creates:
   - a tutor summary
   - parent handoff notes
   - one homework activity
   - one next-session recommendation
4. The tutor approves the homework and summary.
5. The reporting agent compiles a session brief automatically.

### Flow 3: Certification Prep

1. Learner works in self-guided mode.
2. Adaptive practice agent notices repeated misses on one objective cluster.
3. It adds one short retrieval quiz and one flashcard set automatically.
4. Assessment agent flags readiness as unstable and proposes a checkpoint review.
5. Coach approves a revised study sequence for the next week.

## Success Metrics

The system should be judged by workflow improvement, not model novelty.

Key metrics:

- time saved in planning
- rate of evidence capture per session
- latency from session completion to next-step recommendation
- percentage of recommendations accepted
- percentage of accepted recommendations that improve later outcomes
- reduction in skipped or overloaded plan items
- reporting completion time
- percentage of multimodal captures that become usable structured evidence

## Risks

- over-automation that erodes parent or educator trust
- noisy recommendations that create more review burden than value
- multimodal privacy and retention concerns
- cost growth from background runs without enough operational value
- hidden grading or mastery changes that users cannot explain
- weak tool boundaries that let prompts mutate too much state

## Non-Negotiable Design Rules

- AI outputs are not the source of truth. Durable domain records are.
- Agents use typed domain tools, not unrestricted writes.
- Every meaningful write is auditable.
- Activities remain schema-driven and safe to render.
- Approval state is visible in the product.
- Multimodal capture is explicit, bounded, and policy-controlled.
- The learner experience stays simpler than the parent or operator experience.

## Recommendation

The platform should evolve into an event-driven, tool-using, multi-agent learning operations system built on top of its existing durable workflow model.

The first implementation step should be an after-session synthesis loop, not a fully autonomous live tutor.

That path fits the current architecture, improves the product immediately, preserves adult control, and creates the data flywheel needed for stronger adaptive behavior later.
