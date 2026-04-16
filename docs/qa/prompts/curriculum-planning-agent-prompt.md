Execute a live browser QA pass for curriculum and planning using the local QA pipeline docs:

- `/home/luke/Desktop/learning/homeschool-v2/docs/qa/local-qa-pipeline.md`
- `/home/luke/Desktop/learning/homeschool-v2/docs/qa/qa-report-template.md`
- `/home/luke/Desktop/learning/homeschool-v2/docs/qa/qa-flow-inventory.md`

Important:
- this is live browser execution, not a review of the docs
- actually click through the planning and curriculum flows

Repo:
- `/home/luke/Desktop/learning/homeschool-v2`

Target:
- `http://localhost:3000`

If `localhost:3000` is not running, start it with:
- `corepack pnpm dev`

Credentials:
- use the current working adult account provided by the requesting agent or user

Required route coverage:
1. `/curriculum`
2. `/curriculum/new`
3. `/curriculum/manage`
4. `/curriculum/graph`
5. `/planning`
6. `/planning/month`
7. return to `/today` to confirm resulting handoff if planning or curriculum state changes

Required checks:
1. curriculum source creation/import is reachable
2. empty states guide the user correctly
3. planning surfaces are understandable and usable
4. planned work becomes visible from `Today` if data supports it
5. no runtime or blocking network failures

If data is too thin:
- create enough curriculum/planning state to make the flow review meaningful
- record exactly what data was created

Responsive minimum:
- laptop on all main routes
- tablet on `/curriculum` and `/planning`

Return the report in the structure from `qa-report-template.md`.

Do not merge anything. Do not change code.
