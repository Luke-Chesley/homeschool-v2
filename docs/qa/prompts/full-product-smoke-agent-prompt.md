Execute a full local product smoke QA pass using the local QA pipeline docs:

- `/home/luke/Desktop/learning/homeschool-v2/docs/qa/local-qa-pipeline.md`
- `/home/luke/Desktop/learning/homeschool-v2/docs/qa/qa-report-template.md`
- `/home/luke/Desktop/learning/homeschool-v2/docs/qa/qa-flow-inventory.md`

Important:
- this is a live browser QA run, not a code review
- do not critique the QA docs
- use them as the execution checklist
- this task is only complete after the routes are exercised in the browser

Repo:
- `/home/luke/Desktop/learning/homeschool-v2`

Target:
- `http://localhost:3000`

If `localhost:3000` is not running, start it with:
- `corepack pnpm dev`

Credentials:
- use the current working adult account provided by the requesting agent or user
- if sign-up needs a fresh account, record the exact email used

Required route coverage:
1. `/`
2. `/auth/login`
3. `/today`
4. `/today?date=2026-04-13` if useful
5. `/curriculum`
6. `/planning`
7. `/learner`
8. one real `/activity/[sessionId]`
9. `/tracking`
10. `/tracking/reports`
11. `/copilot`
12. `/account`
13. `/users`

Required checks:
1. auth entry and login
2. parent `Today` to learner handoff
3. curriculum and planning surfaces load and remain usable
4. learner queue and one activity route work
5. tracking and account surfaces load correctly
6. Copilot loads and either works or degrades gracefully
7. no runtime, console, hydration, or blocking request errors

Required responsive coverage:
- laptop: all major routes
- tablet: `/today`, `/learner`, `/activity/[sessionId]`
- phone: `/today`, `/learner`, `/activity/[sessionId]`, `/auth/login`

Deliverable:
- use the report structure from `qa-report-template.md`
- include a clear final signoff recommendation for local launch readiness

Do not merge anything. Do not change code.
