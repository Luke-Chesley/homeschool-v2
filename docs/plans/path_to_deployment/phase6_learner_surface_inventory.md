# Phase 6: Learner Surface Inventory

This document breaks the learner redesign into concrete surfaces and responsibilities.

Use it to keep Phase 6 focused on the actual learner experience rather than treating “learner UX” as a single page.

## Shared Learner Surfaces

### Learner Shell

Primary files:

- [app/(learner)/layout.tsx](</home/luke/Desktop/learning/homeschool-v2/app/(learner)/layout.tsx>)
- [app/globals.css](/home/luke/Desktop/learning/homeschool-v2/app/globals.css)
- [components/studio](/home/luke/Desktop/learning/homeschool-v2/components/studio)

Why it matters:

- the learner shell sets the tone for every learner route
- it currently needs to be lighter and more integrated with the Phase 5 design language

Primary redesign targets:

- simplify the learner top bar
- keep the active learner visible without wasting vertical space
- keep the return path to the parent workspace clear
- ensure studio access feels secondary

### Shared Activity Runtime

Primary files:

- [components/activities/ActivityRenderer.tsx](/home/luke/Desktop/learning/homeschool-v2/components/activities/ActivityRenderer.tsx)
- [components/activities/v2/ActivitySpecRenderer.tsx](/home/luke/Desktop/learning/homeschool-v2/components/activities/v2/ActivitySpecRenderer.tsx)
- [components/activities](/home/luke/Desktop/learning/homeschool-v2/components/activities)

Why it matters:

- this is the core learner interaction engine
- if it still feels mechanically rendered, the learner experience will still feel unfinished even with a cleaner shell

Primary redesign targets:

- improve spacing and measure for instruction-heavy layouts
- clarify action areas
- reduce visual fragmentation across component types
- make submit and completion flows feel intentional

## Learner Route Surfaces

### Parent Today To Learner Access

Primary files:

- [app/(parent)/today/page.tsx](</home/luke/Desktop/learning/homeschool-v2/app/(parent)/today/page.tsx>)
- [components/planning](/home/luke/Desktop/learning/homeschool-v2/components/planning)
- [app/(learner)/learner/page.tsx](</home/luke/Desktop/learning/homeschool-v2/app/(learner)/learner/page.tsx>)

Why it matters:

- the parent already works from `Today`
- if activity access is hidden or indirect, learner work feels detached from the daily workflow

Primary redesign targets:

- make activity launch points clearer from `Today`
- reduce route-hunting between parent planning and learner execution
- keep the handoff consistent with learner queue states and labels

### Learner Home

Primary files:

- [app/(learner)/learner/page.tsx](</home/luke/Desktop/learning/homeschool-v2/app/(learner)/learner/page.tsx>)
- [lib/activities/session-service.ts](/home/luke/Desktop/learning/homeschool-v2/lib/activities/session-service.ts)

Why it matters:

- this is the daily entry point for the learner
- it needs to answer “what next” immediately

Primary redesign targets:

- stronger queue hierarchy
- cleaner session cards
- calmer empty state
- better distinction between resume, start, and complete states

### Activity Session

Primary files:

- [app/(learner)/activity/[sessionId]/page.tsx](</home/luke/Desktop/learning/homeschool-v2/app/(learner)/activity/[sessionId]/page.tsx>)
- [components/activities/ActivityStudioPanel.tsx](/home/luke/Desktop/learning/homeschool-v2/components/activities/ActivityStudioPanel.tsx)

Why it matters:

- this is the most important learner route in the product
- this is where long-form activity text, interactive widgets, evidence capture, and completion flow meet

Primary redesign targets:

- make the activity surface feel focused
- reduce chrome weight around the activity
- make instructions and responses easier to scan
- improve loading, error, and completion states
- keep diagnostics out of the default flow

### Sample Activity Redirect

Primary files:

- [app/sample-activity/page.tsx](/home/luke/Desktop/learning/homeschool-v2/app/sample-activity/page.tsx)

Why it matters:

- this route is lightweight, but it is part of the learner/runtime flow for developer and demo use

Primary redesign targets:

- ensure it still lands the user in the right place after Phase 6
- avoid letting demo-only behavior drift from the learner runtime assumptions

## Supporting Learner Concerns

### Runtime Diagnostics

Primary files:

- [components/activities/ActivityStudioPanel.tsx](/home/luke/Desktop/learning/homeschool-v2/components/activities/ActivityStudioPanel.tsx)
- [components/studio/StudioDrawer.tsx](/home/luke/Desktop/learning/homeschool-v2/components/studio/StudioDrawer.tsx)
- [components/studio/StudioJsonInspector.tsx](/home/luke/Desktop/learning/homeschool-v2/components/studio/StudioJsonInspector.tsx)

Primary redesign targets:

- keep the entry point easy for operators to find
- keep the drawer compact and secondary
- ensure diagnostics never dominate the learner page

### Responsive Behavior

Primary files:

- [app/globals.css](/home/luke/Desktop/learning/homeschool-v2/app/globals.css)
- learner route files under [app/(learner)](</home/luke/Desktop/learning/homeschool-v2/app/(learner)>)
- activity renderer files under [components/activities](/home/luke/Desktop/learning/homeschool-v2/components/activities)

Primary redesign targets:

- stronger tablet behavior
- reliable narrow-width spacing
- improved touch target sizing
- fewer multi-column collisions in learner runtime

## Design Constraints To Apply Everywhere

- preserve attempt lifecycle behavior
- preserve autosave and submit flows
- preserve the studio/product split
- reduce copy rather than layering more explanations
- keep the learner experience visually calmer than the parent experience
- prefer one clear next action over many parallel actions

## Sequencing Guidance

Recommended order:

1. learner shell
2. parent `Today` to learner handoff
3. learner home
4. activity runtime
5. diagnostics boundary review
6. responsive QA
7. final consistency pass

## Review Questions

- can a parent move from `Today` into learner work without hunting for it
- does the learner home make the next action obvious
- does the learner activity page begin with the work instead of with chrome
- are instructions readable on laptop and tablet widths
- are action buttons touch-friendly on smaller widths
- did studio diagnostics stay accessible without leaking into product mode
- does every learner route feel consistent with the Phase 5 parent product language
