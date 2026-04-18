# Triage Taxonomy

Every finding should map to one primary bucket.

## homeschool-v2 / onboarding
Use when:
- required fields are too heavy
- route selection is confusing
- upload affordance is weak
- Today does not clearly show loading or progress
- regeneration controls are missing or confusing

## homeschool-v2 / runtime UX
Use when:
- lesson load state is unclear
- activity pending state is unclear
- learner switching is awkward
- phone layout hides essential actions

## shared / source normalization
Use when:
- image, PDF, or pasted text is not normalized well enough
- source metadata is missing
- inferred horizon is not explicit enough

## learning-core / operation routing
Use when:
- the wrong named operation handled the input
- one-day inputs were sent down curriculum-wide generation
- source-entry inputs should have gone through `source_interpret -> curriculum_generate`

## learning-core / curriculum_intake
Use when:
- source interpretation is wrong
- extracted structure is poor
- ambiguity handling is weak

## learning-core / session_generate
Use when:
- the lesson is poorly grounded
- teacher instructions are weak
- success criteria are missing
- the lesson is teachable only after heavy edits

## learning-core / activity_generate
Use when:
- the activity is generic
- the activity ignores lesson specifics
- the interaction type is wrong
- runtime support exists but generation chose poorly

## learning-core / pack opportunity
Use when:
- repeated scenario families want the same interaction type
- there is no good current pack for the domain
- multiple weak activities cluster around the same domain

## shared / contract
Use when:
- artifact shape is missing necessary fields
- frontend cannot represent an otherwise good output
- operation responses are hard to compare or evaluate

## not a bug / expected
Use when:
- source was too weak to support more
- user expectation exceeds current scope
- current behavior is the right bounded choice
