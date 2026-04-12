# Phase 8 Launch Readiness QA

This file records the Phase 8 launch-prep QA pass run from the local app.

Review target used in this pass:
- `http://localhost:3000`

Reason:
- the staged hosted deployment is behind Vercel protection in this session
- local verification was used to keep launch-prep moving
- a hosted rerun is still recommended once a share URL or connector access is available

Review account used for primary flow:
- `test@test.com`
- `123456`

## Findings

### 1. Low: launch-critical existing-account flows are stable locally

Routes exercised:
- `/`
- `/auth/login`
- `/today`
- `/today?date=2026-04-13`
- `/learner`
- `/planning`
- `/curriculum`
- `/tracking`
- `/tracking/reports`
- `/copilot`
- `/account`

Observed:
- no runtime exceptions
- no console errors
- no hydration warnings
- no blocking failed requests during the signed-in route pass

### 2. Low: the final learner completion-state signoff is now closed locally

Live learner route:
- `/activity/session_e7dc12eba7994016bddbc60f0253c1b1`

Observed:
- the session reached `7/7`
- submit became available after the missing evidence-match interaction was completed
- submit succeeded
- the route showed:
  - `Activity submitted.`
  - `This session is finished and saved to today’s work.`
  - `Back to queue`
- the learner queue then reflected the completed state

### 3. Medium: fresh-account sign-up still needs manual verification outside headless local automation

Observed:
- one earlier local run reached `/auth/setup`
- repeated headless sign-up runs did not consistently advance past `/auth/sign-up`
- those repeated runs also did not surface a clear error or confirmation notice
- request logging suggested the client-side auth request did not consistently fire in those runs

Interpretation:
- this is not enough evidence to call sign-up broken for human users
- it is enough to keep fresh-account sign-up on the remaining Phase 8 manual-verification list

### 4. Low: studio mode remains functionally secondary, but still adds visual weight on learner activity routes

Observed:
- with studio off, the learner activity route returns to a clean finished-state view
- with studio on, runtime diagnostics remain available and still lengthen the page

Interpretation:
- not a launch blocker
- still worth remembering as a product-mode vs studio-mode tradeoff

## Route Coverage

Covered in this Phase 8 pass:
- launch-critical parent routes at laptop width
- learner queue and learner activity route at laptop width
- completed learner session state locally
- studio on/off comparison for learner activity
- studio on/off comparison for key parent/learner routes where relevant

Existing supporting QA from earlier phases still applies:
- responsive learner-flow QA across laptop, tablet, and phone
- Phase 7 product-polish QA across account/tracking/auth surfaces

## Execution Log

1. verified the local app was already serving on `http://localhost:3000`
2. opened `/`
3. opened `/auth/login`
4. signed in with `test@test.com / 123456`
5. reviewed `/today`
6. reviewed `/today?date=2026-04-13`
7. reviewed `/learner`
8. reviewed `/planning`
9. reviewed `/curriculum`
10. reviewed `/tracking`
11. reviewed `/tracking/reports`
12. reviewed `/copilot`
13. reviewed `/account`
14. reopened the live learner session at `/activity/session_e7dc12eba7994016bddbc60f0253c1b1`
15. completed the remaining evidence-match interaction
16. submitted the learner activity successfully
17. confirmed the finished-state message and back-to-queue path
18. compared learner activity with studio mode on and off
19. attempted fresh-account sign-up flows with unique emails to probe `/auth/sign-up` -> `/auth/setup`

## Residual Risks

- hosted staging still needs a rerun once Vercel protection is bypassed for this session
- fresh-account sign-up still needs manual or hosted validation beyond headless local automation
- a real hosted storage flow is still not verified in this pass

## Signoff Recommendation

Phase 8 can continue on the basis of this local run.

Current recommendation:
- treat the final learner completion-state signoff as closed
- treat existing-account launch-critical routes as locally healthy
- keep hosted staging rerun, storage verification, and fresh-account sign-up validation on the remaining launch-prep list

