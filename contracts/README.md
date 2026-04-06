# Artifact Contracts

This directory serves as the first-class contract registry for all generated artifacts in the Homeschool V2 system.

## Purpose

Generated artifacts (curriculum, lesson plans, activities) are the core of the system. To ensure reliability and maintainability, we explicitly document:
- What each artifact is and its purpose.
- Its required, optional, and defaulted fields.
- The producers (code/prompts) and consumers (UI/services) of the artifact.
- Where it is persisted and how it is validated.

## How to Use These Contracts

- **For Developers:** Consult these docs before changing any prompt that generates structured data or any service that consumes it.
- **For AI Agents:** Use these docs as the ground truth for the shape of the data you are expected to produce or modify.
- **For Onboarding:** Read these to understand the data flow between the AI generation layer and the operational application.

## How to Update

1. If you change the shape, required fields, defaults, versioning, or persistence of a generated artifact, you **must** update the matching contract file in this directory.
2. If you create a new type of generated artifact, create a new contract file using `_template.md` and add it to `contract-index.json`.
3. Run `npm run contracts:check` (or equivalent) to ensure the registry remains structurally sound.

## Index

See [contract-index.json](./contract-index.json) for a machine-readable registry of all contracts and their associated code paths.
