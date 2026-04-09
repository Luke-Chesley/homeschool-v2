# Artifact Contracts

This directory is the contract registry for the durable artifacts and view models that `homeschool-v2` persists or consumes.

`learning-core` now owns:
- prompt templates
- `SKILL.md` instructions
- prompt assembly
- provider/model selection
- execution
- prompt preview generation

These contract docs therefore describe the boundary between the product app and `learning-core`, not app-owned prompt files.

## Purpose

- Document the shape of generated artifacts and transient generation inputs.
- Make producer and consumer ownership explicit across the two repos.
- Define persistence and downstream breakage when shapes change.

## How To Use These Contracts

- Before changing any generated artifact shape, update the matching contract here in the same change.
- When the producer lives in `learning-core`, update both the contract doc here and the source contract/schema in `learning-core`.
- When a debug route or persistence flow changes, update the producer/consumer paths in `contract-index.json`.

## Required Updates

1. If you change required fields, optional fields, defaults, lineage/version fields, or persistence shape, update the matching contract file.
2. If you add a new artifact or durable generation input, create a contract from `_template.md` and register it in `contract-index.json`.
3. Run `npm run contracts:check` before finishing.

## Index

See [contract-index.json](./contract-index.json) for the machine-readable registry.
