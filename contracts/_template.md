# Contract: [Contract Name]

- **Status:** [Draft | Active | Deprecated]
- **Canonical Artifact Name:** [e.g., CurriculumDraft]
- **Current Version:** [e.g., 1.0.0]

## Purpose
[Briefly describe the purpose of this artifact and what it represents in the system.]

## Producers
- **Entrypoints:** [The specific AI prompt or service that generates this artifact]
- **Canonical Source Files:** [The file(s) that define the prompt or generation logic]

## Consumers
- **Entrypoints:** [The UI routes or API endpoints that consume this artifact]
- **Processing Logic:** [Services that transform or normalize the raw artifact]

## Persistence
- **Storage Location:** [Database table, JSON file, or metadata field where this is stored]
- **Storage Shape:** [If different from the raw artifact shape, explain here]

## Field Definitions

### Required Fields
| Field | Type | Description |
|-------|------|-------------|
| field_name | type | description |

### Optional Fields
| Field | Type | Description |
|-------|------|-------------|
| field_name | type | description |

### Derived / Computed Fields
| Field | Source | Logic |
|-------|--------|-------|
| field_name | [source] | [logic] |

## Defaults & Fallbacks
- **[Field Name]:** [Default value and when it is applied]

## Validation & Invariants
- [List any rules that must be true for the artifact to be valid]

## Ownership & Hierarchy
- **Parent:** [e.g., Household, Learner]
- **Children:** [e.g., Units, Lessons, Activities]

## Change Impact
- **Downstream Effects:** [What breaks if this contract changes?]
- **Related Contracts:** [Other contract files that may need updates]

## Known Gaps / TODOs
- [List any parts of the contract that are currently implicit or need hardening]
