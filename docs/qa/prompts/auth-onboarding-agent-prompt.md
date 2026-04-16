Execute a live browser QA pass for auth and initial setup using the local QA pipeline docs:

- `/home/luke/Desktop/learning/homeschool-v2/docs/qa/local-qa-pipeline.md`
- `/home/luke/Desktop/learning/homeschool-v2/docs/qa/qa-report-template.md`
- `/home/luke/Desktop/learning/homeschool-v2/docs/qa/qa-flow-inventory.md`

Important:
- this is a live browser QA run, not a code review
- do not critique the documents
- use them as execution instructions
- actually run the app and click through the flows

Repo:
- `/home/luke/Desktop/learning/homeschool-v2`

Target:
- `http://localhost:3000`

If `localhost:3000` is not running, start it with:
- `corepack pnpm dev`

Credentials:
- use the credentials provided separately by the requesting agent or user
- if sign-up needs a fresh email, create one and record exactly what was used

Required flow coverage:
1. `/`
2. `/auth/login`
3. `/auth/sign-up`
4. `/auth/setup`
5. `/onboarding`
6. `/auth/error` only if reached during the run

Required checks:
1. public landing page loads
2. existing-user login works or fails clearly
3. fresh-account sign-up works or fails clearly
4. auth redirects are correct after login and setup
5. newly authenticated users are routed into setup/onboarding correctly
6. no runtime, console, hydration, or blocking network errors

Responsive minimum:
- laptop for all auth routes
- phone for `/auth/login` and `/auth/sign-up`

Return the report in the structure from `qa-report-template.md`.

Do not merge anything. Do not change code.
