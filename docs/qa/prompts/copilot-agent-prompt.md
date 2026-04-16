Execute a live browser QA pass for Copilot using the local QA pipeline docs:

- `/home/luke/Desktop/learning/homeschool-v2/docs/qa/local-qa-pipeline.md`
- `/home/luke/Desktop/learning/homeschool-v2/docs/qa/qa-report-template.md`
- `/home/luke/Desktop/learning/homeschool-v2/docs/qa/qa-flow-inventory.md`

Important:
- this is live browser QA, not a code review
- actually load and use the Copilot route

Repo:
- `/home/luke/Desktop/learning/homeschool-v2`

Target:
- `http://localhost:3000`

If `localhost:3000` is not running, start it with:
- `corepack pnpm dev`

Credentials:
- use the current working adult account provided by the requesting agent or user

Required route coverage:
1. `/copilot`

Required checks:
1. Copilot route loads without runtime errors
2. existing conversation UI, if present, renders correctly
3. asking a prompt works or fails gracefully
4. service failures are surfaced clearly and do not crash the page
5. layout is consistent with the rest of the parent workspace
6. no console errors or blocking failed requests except expected AI service failures, which should still be documented

Responsive minimum:
- laptop required
- tablet optional if time allows

Return the report in the structure from `qa-report-template.md`.

Do not merge anything. Do not change code.
