# QA Report Template

Use this structure for every QA execution pass.

## Findings

List findings ordered by severity.

Each finding should include:
- route
- viewport if relevant
- reproduction steps
- what happened
- what should have happened

## Responsive Results

Summarize behavior at:
- laptop
- tablet
- phone

## Execution Log

Record the exact steps taken in order.

Include:
- route visited
- viewport used
- auth/setup actions
- data creation steps
- studio mode toggles
- any blocked or skipped attempts

## Flow Coverage Completed

List what was actually exercised.

## Open Questions Or Residual Risks

Call out:
- areas not covered
- data gaps
- environment-specific uncertainty

## Signoff Recommendation

Say explicitly whether the tested flow looks:
- ready
- ready with minor caveats
- not ready
