# Phase 2: Curriculum Intake And Horizon Policy

## Purpose

The launch user often has partial or messy source material.
This phase defines how the product should accept that material, how much plan it should generate from it, and how to avoid fake confidence.

This is the phase that makes "no full curriculum upload required" real.

## Core Rule

The product should schedule only as far as the source justifies.

If the user provides one day of material, do not stretch it into a fake week.
If the user provides a table of contents or weekly assignment list, it is reasonable to project farther.
If the source is ambiguous, default to a shorter horizon and let the user expand it later.

## Outcome

At the end of Phase 2:

- the product supports multiple practical intake routes
- each route has a default scheduling horizon
- the system preserves source provenance and confidence
- the user can see and correct the generated interpretation before or immediately after save

## Launch Intake Routes

### Route A: Chapter / Pages / Single Lesson

Best for:

- a book chapter
- workbook pages
- a single assignment
- one day's co-op follow-up

Default output:

- Today
- optional tomorrow suggestion

Do not default to:

- a full week
- a broad curriculum tree without confirmation

### Route B: Weekly Assignment List

Best for:

- parent weekly notes
- copied teacher plan
- bullet list of work for the week

Default output:

- current week
- Today highlighted

### Route C: Outline / Scope And Sequence / TOC

Best for:

- pasted table of contents
- syllabus
- chapter list
- rough sequence from a curriculum

Default output:

- Today + next 3 to 5 school days
- editable structure preview

### Route D: Topic From Scratch

Best for:

- interest-led module
- enrichment
- electives like chess
- gap-fill mini-unit

Default output:

- 3 to 5 session starter module

Do not present this as a full-year curriculum by default.

### Route E: Manual Starter Shell

Best for:

- families that want to scaffold the system slowly
- families that only know subject areas and time budget

Default output:

- simple Today or starter week shell
- clear expectation that the parent will refine it

## Recommended Horizon Policy

| Input shape | Confidence | Default horizon | Allowed auto-expansion | Notes |
| --- | --- | --- | --- | --- |
| Single chapter, pages, or one assignment | Low to medium | Today only | Tomorrow suggestion only | Never silently create a week |
| Weekly assignment list | Medium to high | Current week | Limited carryover | Best low-friction scheduling input |
| TOC / scope and sequence / outline | Medium | 3 to 5 school days | Expand after review | Good candidate for preview + confirm |
| Full structured outline | High | First workable week | Yes | Can build stronger curriculum tree |
| Topic from scratch | Medium | 3 to 5 sessions | Expand into module later | Sell this as a starter module |
| Manual shell | Low | Today or starter week | Manual refinement | Useful as fallback, not hero |

## Confidence Rules

The system should store and respect a generation-confidence signal.

Confidence should consider:

- amount of source material
- structural clarity
- number of detected lesson chunks
- whether the source names sequence or pacing
- whether the user explicitly requested a longer plan

If confidence is low:

- generate a shorter horizon
- label assumptions clearly
- prompt for one quick correction
- avoid strong scheduling language

## Recommended User-Facing Copy

Use language like:

- Build today from what I have
- Plan this week from my notes
- Turn this outline into the next few school days
- Start a topic module

Avoid language like:

- import your curriculum system
- decompose source material
- build dependency graph

## Required Product Behaviors

### Preview And Correction

Before or immediately after save, show:

- what the system thinks the source contains
- what horizon it will plan
- what learner it targets
- what assumptions it made

Allow quick fixes for:

- wrong subject
- wrong learner
- wrong horizon
- obvious chunking mistakes

### Durable Provenance

Store:

- source type
- raw source text or asset reference
- creation route
- inferred horizon
- confidence level
- user overrides

### Regeneration Without Destruction

The user should be able to:

- replace the source
- shorten or lengthen the horizon
- regenerate lesson drafts
- keep progress already captured where appropriate

## Recommended Backend Changes

- add intake route identifiers beyond the current three-mode abstraction
- store source-confidence metadata on curriculum source or intake record
- store plan-horizon policy on initial generation runs
- add plan preview / confirmation payload support
- separate source interpretation from final save where needed

## Suggested Implementation Order

1. define the input taxonomy and horizon rules
2. implement user-facing intake routes and copy
3. add preview / correction for low and medium confidence routes
4. persist provenance and confidence metadata
5. verify regeneration behavior does not corrupt progress state

## Exit Criteria

Phase 2 is complete when:

- a user can start from several realistic input types
- the system no longer overcommits schedule from weak source material
- preview and quick correction exist where confidence is lower
- source provenance and horizon decisions are durable and inspectable
- the intake routes feel parent-facing, not internal

## Explicit Deferrals

This phase does not need to solve:

- every file type under the sun
- publisher-specific integrations
- deep standards mapping
- perfect OCR for every upload scenario
