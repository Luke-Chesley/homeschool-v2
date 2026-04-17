# Homeschool Tracking + Compliance Plan

## Goal

Add a generic tracking/compliance layer that supports common homeschool attendance and progress requirements across many jurisdictions without hard-coding the product around one state or one homeschool pathway.

This should:
- fit the current homeschool-v2 product loop
- reuse existing progress/evidence/planning objects wherever possible
- support current beta users quickly
- leave room for later expansion into more states, pathways, and report types

## Product Position

The product should not become a legal automation product.

It should become:
- a clean operational record for what happened
- a structured compliance assistant for deadlines and summaries
- a report builder that is configurable by jurisdiction/profile

The system should track durable facts once and derive jurisdiction-specific outputs from them.

## Core Design Rule

Separate three layers:

1. **Operational truth**
   - what was planned
   - what was taught
   - what was completed
   - what evidence exists
   - what progress was observed

2. **Compliance configuration**
   - jurisdiction
   - pathway/profile
   - reporting cadence
   - attendance rules
   - progress proof rules
   - required subject coverage rules
   - document/deadline rules

3. **Derived compliance outputs**
   - attendance summary
   - quarterly report draft
   - annual evaluation pack
   - portfolio checklist
   - filing checklist
   - export packets

Do not make the compliance layer the canonical source of learning data.

## Requirements Shape To Support

The system should support these requirement families as first-class concepts:

- notice / affidavit / annual filing
- attendance by days and/or hours
- subject coverage tracking
- portfolio / work sample retention
- periodic progress reports
- annual evaluation / assessment
- standardized test evidence
- optional health / immunization / qualification attestations
- transfer / termination / move-district events

## Recommended MVP Scope

### In scope

1. academic year + learner compliance setup
2. jurisdiction profile selection
3. attendance ledger
4. instructional-hour ledger
5. subject coverage summary
6. evidence / portfolio collection
7. periodic progress snapshots
8. annual progress/evaluation record
9. compliance checklist with deadlines
10. exportable summary views

### Out of scope for this pass

- direct filing to districts/states
- full 50-state legal exhaustiveness
- official transcript / diploma workflows
- scholarship-specific flows
- health-record workflows beyond optional placeholders
- fully automated legal advice

## Data Model Plan

Add or derive the following concepts.

### 1. Compliance Program

A learner-year level object.

Fields:
- `id`
- `organizationId`
- `learnerId`
- `schoolYearLabel`
- `startDate`
- `endDate`
- `jurisdictionCode` (e.g. `US-NY`, `US-PA`)
- `pathwayCode` (e.g. `home_instruction`, `home_education`, `private_school_affidavit`)
- `requirementProfileVersion`
- `status` (`draft`, `active`, `completed`, `archived`)

Purpose:
- anchors attendance, reports, and deadlines to a specific learner-year profile

### 2. Requirement Profile

Prefer config/template-driven, not per-row custom law logic.

Fields / config shape:
- `jurisdictionCode`
- `pathwayCode`
- `version`
- `attendanceMode` (`days`, `hours`, `days_or_hours`, `minimal`)
- `attendanceTargetDays`
- `attendanceTargetHoursElementary`
- `attendanceTargetHoursSecondary`
- `requiresPeriodicReports`
- `periodicReportCadence` (`quarterly`, `annual`, `none`)
- `requiresAnnualEvaluation`
- `requiresPortfolio`
- `requiresTestEvidence`
- `subjectCoverageMode`
- `requiredSubjectGroups`
- `requiredDocuments`
- `deadlineRules`
- `retentionHints`

Purpose:
- keeps state-specific logic configurable and versioned

### 3. Attendance Ledger

One row per learner per date.

Fields:
- `complianceProgramId`
- `learnerId`
- `date`
- `status` (`present`, `partial`, `excused`, `non_instructional`)
- `instructionalMinutes`
- `source` (`manual`, `derived_from_sessions`, `imported`)
- `notes`
- `derivedFromSessionIds[]`

Purpose:
- supports both day-count and hour-count states
- supports manual override

### 4. Instruction Session Summary

Likely derived from existing session / plan data.

Fields:
- `learnerId`
- `date`
- `subjectTags[]`
- `objectiveRefs[]`
- `minutesPlanned`
- `minutesActual`
- `completionState`
- `evidenceRefs[]`

Purpose:
- feeds attendance, progress, and subject coverage without duplicating raw session truth

### 5. Subject Coverage Summary

Derived read model by learner-year.

Fields:
- `complianceProgramId`
- `subjectKey`
- `minutesLogged`
- `daysTouched`
- `unitsTouched`
- `lastCoveredAt`
- `coverageStatus` (`not_started`, `in_progress`, `satisfied`, `unknown`)
- `supportingRefs[]`

Purpose:
- gives flexible “required subjects addressed?” support without pretending to certify compliance automatically

### 6. Progress Snapshot

Human-readable periodic summary.

Fields:
- `complianceProgramId`
- `periodType` (`month`, `quarter`, `year`, `custom`)
- `periodLabel`
- `summaryText`
- `subjectNotes[]`
- `strengths`
- `struggles`
- `nextSteps`
- `evidenceRefs[]`
- `status` (`draft`, `final`)

Purpose:
- powers quarterly reports and annual summaries
- keeps narrative progress separate from atomic activity records

### 7. Evaluation Record

Fields:
- `complianceProgramId`
- `evaluationType` (`parent_summary`, `teacher_letter`, `standardized_test`, `portfolio_review`, `external_assessment`)
- `completedAt`
- `resultSummary`
- `documentRefs[]`
- `evaluatorName`
- `evaluatorRole`
- `status`

Purpose:
- generic enough for Virginia/Florida/Pennsylvania/New York style annual proof

### 8. Evidence Artifact

Likely reuse/extend existing evidence/generated artifact models.

Needs metadata for:
- work sample
- photo
- PDF
- test result
- evaluator letter
- transcript/report card
- reading log export
- checklist attachment

### 9. Compliance Task / Deadline

Fields:
- `complianceProgramId`
- `taskType` (`notice`, `ihip`, `quarterly_report`, `annual_evaluation`, `affidavit`, `portfolio_ready`, `termination`, `transfer_letter`)
- `title`
- `dueDate`
- `status` (`upcoming`, `ready`, `completed`, `overdue`, `not_applicable`)
- `completionRefs[]`
- `notes`

Purpose:
- lets the app feel helpful without pretending to file automatically

## Implementation Strategy

### Phase 1 — Foundation: learner-year compliance setup

Build:
- compliance program creation during learner/year setup
- jurisdiction + pathway selection
- versioned requirement profiles in config
- minimal deadline generation

UI:
- add “Tracking setup” block on learner/year settings
- choose:
  - state/jurisdiction
  - pathway/profile
  - start/end dates
  - elementary/secondary band if needed

Deliverable:
- every learner can have one active compliance program for the current year

### Phase 2 — Attendance + hours ledger

Build:
- daily attendance ledger
- derived session-to-attendance mapping
- manual overrides
- day and hour summaries

Rules:
- operational session data may prefill attendance
- parent can override or add manual instructional time
- non-instructional days must be explicit

UI:
- simple attendance calendar/table
- “mark today” controls
- daily total instructional minutes/hours
- yearly progress to target where applicable

Deliverable:
- one reliable attendance source of truth

### Phase 3 — Progress + subject coverage

Build:
- subject coverage read model
- progress snapshot model
- optional monthly/quarterly progress drafts

Rules:
- derive from plan/session/evidence first
- allow human edits
- do not auto-claim compliance satisfaction where evidence is weak

UI:
- calmer Tracking overview
- tabs/sections:
  - attendance
  - progress
  - evidence / portfolio
  - deadlines

Deliverable:
- a parent can see “what we covered” and “how the learner is progressing” in one place

### Phase 4 — Evidence + portfolio

Build:
- portfolio bucket per learner-year
- evidence tagging by subject/date/objective/report period
- reading/materials log export

Rules:
- evidence should be attachable from Today/session flows
- parents should also be able to upload manually

UI:
- “Save to portfolio” from Today/session outcomes
- evidence grid/list with filters
- export-ready packet preview

Deliverable:
- enough raw material for PA/FL/VA/NY-style proof workflows

### Phase 5 — Periodic and annual report drafts

Build:
- report composer from attendance + progress + evidence
- quarterly/annual draft templates driven by requirement profile
- annual evaluation record management

UI:
- generate draft quarterly report
- generate annual summary/evaluation packet
- editable before export

Deliverable:
- parent can produce a usable report pack without re-entering everything

### Phase 6 — Specific profile packs

Start with 5-6 profile packs, not all states.

Suggested first packs:
- Texas minimal record pack
- Florida home education pack
- New York home instruction pack
- Pennsylvania home education pack
- Virginia home instruction pack
- California private/home school affidavit pack

Each pack should define:
- deadlines
- attendance mode
- progress proof expectations
- suggested exports
- wording for report sections

Do not hard-code these into the core models.

## UI / UX Recommendation

Tracking should become four simple surfaces:

1. **Attendance**
   - days/hours completed
   - current totals
   - calendar/list
   - mark or correct today

2. **Progress**
   - narrative summary
   - subject coverage
   - what improved / what needs work

3. **Portfolio**
   - saved work samples
   - evaluations
   - tests
   - photos / PDFs

4. **Requirements**
   - deadlines
   - what is ready
   - what is missing
   - export buttons

The parent should not need to understand internal concepts like graphs, route boards, or evidence pipelines to use this.

## Mapping To Existing Product Objects

Reuse instead of replacing.

- existing session outcomes -> feed progress and attendance derivation
- existing evidence records -> feed portfolio
- existing progress records -> feed snapshots and recommendations
- existing generated artifacts -> attach to evidence/report packs where useful
- existing recommendations -> stay instructional, not compliance truth

Compliance is a read/write layer around the current product, not a replacement for it.

## Important Product Rules

1. Track raw facts once; derive reports later.
2. Keep jurisdiction logic config-driven and versioned.
3. Allow manual override on attendance and narrative progress.
4. Never auto-file to districts in the MVP.
5. Never claim “you are compliant” with hard certainty.
6. Prefer “ready / likely complete / missing items” language.
7. Keep required-state specifics out of the generic domain core as much as possible.
8. Use exports and checklists as the primary compliance UX.

## What To Build First

If only doing one strong pass, build this exact stack:

1. compliance program + requirement profile
2. attendance ledger with days/hours
3. evidence / portfolio tagging
4. progress snapshot drafts
5. compliance tasks/deadlines
6. quarterly/annual export shell

That is enough to support many states without overfitting the whole app to one legal regime.

## Agent Handoff

Implement a generic homeschool compliance/tracking layer for attendance and progress.

Priorities:
1. learner-year compliance program
2. versioned jurisdiction/pathway profiles in config
3. attendance ledger supporting both days and hours
4. progress snapshot model
5. evidence/portfolio tagging and export
6. compliance task/deadline model
7. derived subject coverage summaries
8. quarterly/annual report composer

Keep the system generic:
- no hard-coded homeschool-only assumptions in the core domain where avoidable
- no legal automation promises
- no direct filing workflows
- no 50-state exhaustive implementation in first pass

Use the existing homeschool-v2 tracking/evidence/session structures wherever possible.
Build compliance as a thin structured layer on top.
