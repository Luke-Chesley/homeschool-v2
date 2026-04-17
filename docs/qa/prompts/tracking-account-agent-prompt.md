Execute a live browser QA pass for tracking, reports, account, and household-management surfaces using the local QA pipeline docs:

- `/home/luke/Desktop/learning/homeschool-v2/docs/qa/local-qa-pipeline.md`
- `/home/luke/Desktop/learning/homeschool-v2/docs/qa/qa-report-template.md`
- `/home/luke/Desktop/learning/homeschool-v2/docs/qa/qa-flow-inventory.md`

Important:
- this is live browser QA, not code review
- use the docs as the checklist

Repo:
- `/home/luke/Desktop/learning/homeschool-v2`

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

Execution steps:
1. Open `/tracking`.
2. Confirm the page presents four clear surfaces in a single scan: program setup, attendance, progress, portfolio, and requirements.
3. In the tracking setup card:
   - confirm jurisdiction/pathway options render
   - change one field such as school year label, grade band, or pathway
   - save it
   - verify the card stays on the page and the updated value remains visible after the save finishes
4. In attendance:
   - mark or update today with a status and minutes
   - verify the yearly progress summary updates or remains internally consistent
   - verify the new row appears in the recent ledger with the correct status, minutes, and source
5. In progress:
   - confirm subject coverage cards, progress snapshots, and outcome history load without empty-shell layout bugs
   - note whether the generated narrative and subject signals look coherent for the active learner data
6. In portfolio:
   - save one existing evidence item to the portfolio if an inbox item exists
   - if manual upload is available, attempt a manual note or file upload
   - verify the saved item appears with the chosen subject/period metadata and status
7. In requirements:
   - mark one requirement task complete or not applicable
   - add an evaluation record
   - verify the new task state and evaluation entry remain visible after save
8. Open `/tracking/reports`.
9. Confirm quarterly/annual/evaluation/portfolio draft cards render from the tracking record.
10. Edit one report draft, save it, and verify the saved content persists.
11. Trigger at least one export button and confirm the response downloads successfully instead of failing or opening an error page.
12. Open `/account`.
13. Confirm the same tracking setup information is reachable from account settings and feels like a real settings surface rather than a placeholder.
14. Open `/users`.
15. Confirm learner/household management remains reachable and understandable after the tracking changes.

Expected outcomes:
1. `/tracking` should read as an operational record, not a dashboard full of filler; the page should stay calm and easy to scan.
2. Attendance should support day/hour tracking with recent ledger rows and no confusing duplicate states.
3. Progress should reflect actual learner work, not obviously fake compliance claims.
4. Portfolio should allow evidence to be saved or added manually without broken uploads or missing metadata.
5. Requirements should show deadlines/checklist state and evaluation history in a way that feels actionable.
6. `/tracking/reports` should expose editable draft shells and working exports for the visible report kinds.
7. `/account` should surface tracking setup cleanly alongside learner settings.
8. `/users` should still function normally after the compliance-layer changes.
9. No route should show runtime errors, console errors, or blocking failed requests.

Responsive minimum:
- laptop on all routes
- tablet on `/tracking` and `/account`
- phone on `/account`

Return the report in the structure from `qa-report-template.md`.

Reporting notes:
- Explicitly list what passed, what failed, and what looked suspicious even if it did not block the flow.
- Include the exact route, viewport, and action that exposed each issue.
- Call out data-shape problems separately from UI polish problems.
- Mention whether the tracking copy feels legally overconfident; the expected tone is “ready / missing / likely complete”, not “guaranteed compliant”.

Do not merge anything. Do not change code.
