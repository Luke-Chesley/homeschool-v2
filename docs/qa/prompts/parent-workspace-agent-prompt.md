Execute a live browser QA pass for the core parent workspace using the local QA pipeline docs:

- `/home/luke/Desktop/homeschool-v2/docs/qa/local-qa-pipeline.md`
- `/home/luke/Desktop/homeschool-v2/docs/qa/qa-report-template.md`
- `/home/luke/Desktop/homeschool-v2/docs/qa/qa-flow-inventory.md`

Important:
- this is live browser QA, not document review and not code review
- use the docs as the checklist
- actually sign in and run the routes

Repo:
- `/home/luke/Desktop/homeschool-v2`

Target:
- `http://localhost:3000`

If `localhost:3000` is not running, start it with:
- `corepack pnpm dev`

Credentials:
- use the current working adult account provided by the requesting agent or user

Required route coverage:
1. `/today`
2. `/today?date=2026-04-13` if it has useful data
3. `/users`
4. top-level navigation between `Today`, `Curriculum`, `Planning`, `Tracking`, `Copilot`, and `Account`

Required checks:
1. `Today` surfaces the next relevant parent action
2. learner handoff from `Today` is visible and understandable
3. top bar and workspace nav remain stable
4. empty or sparse states still guide the user forward
5. no runtime or blocking request failures

Responsive minimum:
- laptop: `/today`
- tablet: `/today`
- phone: `/today`

Return the report in the structure from `qa-report-template.md`.

Do not merge anything. Do not change code.
