Execute a live browser QA pass for tracking, reports, account, and household-management surfaces using the local QA pipeline docs:

- `/home/luke/Desktop/homeschool-v2/docs/qa/local-qa-pipeline.md`
- `/home/luke/Desktop/homeschool-v2/docs/qa/qa-report-template.md`
- `/home/luke/Desktop/homeschool-v2/docs/qa/qa-flow-inventory.md`

Important:
- this is live browser QA, not code review
- use the docs as the checklist

Repo:
- `/home/luke/Desktop/homeschool-v2`

Target:
- `http://localhost:3000`

If `localhost:3000` is not running, start it with:
- `corepack pnpm dev`

Credentials:
- use the current working adult account provided by the requesting agent or user

Required route coverage:
1. `/tracking`
2. `/tracking/reports`
3. `/account`
4. `/users`

Required checks:
1. records/reporting surfaces feel functional and readable
2. account surface feels like real settings, not a placeholder
3. learner/household management is reachable and understandable
4. no runtime errors, console errors, or blocking failed requests

Responsive minimum:
- laptop on all routes
- tablet on `/tracking` and `/account`
- phone on `/account`

Return the report in the structure from `qa-report-template.md`.

Do not merge anything. Do not change code.
