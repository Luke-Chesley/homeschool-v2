Execute a live browser QA pass for the learner flow using the local QA pipeline docs:

- `/home/luke/Desktop/learning/homeschool-v2/docs/qa/local-qa-pipeline.md`
- `/home/luke/Desktop/learning/homeschool-v2/docs/qa/qa-report-template.md`
- `/home/luke/Desktop/learning/homeschool-v2/docs/qa/qa-flow-inventory.md`

Important:
- this is a live browser QA run, not a code review
- do not critique the QA docs
- use them as the execution checklist
- do not stop after route inspection

Repo:
- `/home/luke/Desktop/learning/homeschool-v2`

Target:
- `http://localhost:3000`

If `localhost:3000` is not running, start it with:
- `corepack pnpm dev`

Credentials:
- use the current local review account provided by the requesting agent or user
- if the provided credentials fail, use a valid local account and record it

Required route coverage:
1. `/today`
2. `/today?date=2026-04-13` if it has learner work
3. `/learner`
4. one real `/activity/[sessionId]`

Required checks:
1. learner work is clearly surfaced from `Today`
2. learner queue hierarchy is understandable
3. activity runtime is readable and usable
4. completion and recovery states are clear
5. studio mode is secondary and does not dominate product mode
6. no console, runtime, hydration, or blocking request issues

Required responsive coverage:
- laptop
- tablet
- phone

At each width, review:
- `/today`
- `/learner`
- one `/activity/[sessionId]`

Return the report in the structure from `qa-report-template.md`.

Do not merge anything. Do not change code.
