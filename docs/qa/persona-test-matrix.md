# Persona Test Matrix

Use this matrix when preparing local QA states or assigning persona-based QA runs.

## Persona Set

### `fresh_parent`

State:
- no existing household
- no learners
- no curriculum
- no planning

Primary questions:
- is sign-up and first-run setup understandable?
- does the app guide the user toward the first real teaching state?
- are empty states actionable instead of vague?

Core routes:
- `/`
- `/auth/sign-up`
- `/auth/setup`
- `/onboarding`
- `/today`

### `single_learner_parent`

State:
- one household
- one active learner
- one usable curriculum source
- one workable day with learner activity

Primary questions:
- does `Today` feel like the control center?
- is the path from planning into learner work obvious?
- does the parent know what to do next without guesswork?

Core routes:
- `/today`
- `/curriculum`
- `/planning`
- `/learner`
- `/activity/[sessionId]`

### `multi_learner_parent`

State:
- one household
- two learners
- active learner switching
- differentiated daily work

Primary questions:
- is learner switching understandable?
- does the workspace stay calm with more than one learner?
- does `Today` still feel manageable?

Core routes:
- `/today`
- `/users`
- `/learner`
- `/tracking`

### `sparse_parent`

State:
- authenticated adult account
- household exists
- little or no curriculum/planning data

Primary questions:
- do sparse or empty states guide recovery?
- is the next setup step obvious?
- does the app avoid dead ends?

Core routes:
- `/today`
- `/curriculum`
- `/planning`
- `/account`

### `active_learner`

State:
- one learner
- at least one live session
- partial progress and one completable session when possible

Primary questions:
- is the learner queue readable?
- is activity completion clear?
- do laptop, tablet, and phone remain usable?

Core routes:
- `/learner`
- `/activity/[sessionId]`

## Recommended Local Test States

Best recurring local setup:
- one `fresh_parent` path available through sign-up
- one `single_learner_parent` account ready for broad parent QA
- one `multi_learner_parent` account ready for switching and complexity review
- one `active_learner` account or session ready for responsive learner QA

Use the shared local fake-account registry at `/home/luke/Desktop/learning/codex-agent-loop-harness/LOCAL_TEST_USERS.md` for reusable seeded accounts when possible.

## Coverage Guidance

If time is limited:
1. `single_learner_parent`
2. `active_learner`
3. `fresh_parent`

If doing broad release QA:
- cover all personas that are currently supported by local data
