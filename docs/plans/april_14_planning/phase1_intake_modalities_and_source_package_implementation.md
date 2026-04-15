# Phase 1 Implementation

## Goal

Support typed text, pasted outline, photographed page, PDF, and dragged file upload through one durable intake-package layer before any generation starts.

## Current Fit With Repo

- `components/onboarding/homeschool-onboarding-form.tsx` currently only sends `sourceInput` text into `/api/homeschool/onboarding`.
- `curriculum_sources` and `curriculum_assets` already exist, but they assume a curriculum source record already exists.
- Supabase storage helpers already exist in `lib/storage/*`.
- The current fast-path preview already computes confidence and horizon from raw text, which can be reused once asset-backed intake becomes normalized text.

## Implementation Decision

Phase 1 will add a real `NormalizedIntakeSourcePackage` layer rather than hiding upload state inside provisional curriculum-source rows.

That means:

- add `intake_source_packages` for the durable package record
- add `intake_source_assets` for uploaded assets linked to the package
- keep `curriculum_sources` untouched until generation phases actually promote a package into a source
- let onboarding consume either typed text or a package id, but always normalize into package-backed text before preview/generation

## Scope

### Persistence

- add `intake_source_packages`
- add `intake_source_assets`
- persist:
  - modality
  - asset metadata
  - extracted text
  - user notes
  - normalized text
  - extraction status
  - source fingerprint

### Extraction

- text and outline: direct normalization
- plain text / markdown / json / csv / html files: UTF-8 extraction
- PDF: server-side text extraction
- image/photo: store the asset plus parent note as the launch-safe extracted text for now

### Onboarding UX

- keep the fast 4-step frame
- replace the single textarea with modality-aware input:
  - text
  - photo
  - PDF
  - file
- create the intake package before the existing confidence / horizon preview step
- show package details inside preview so the parent can see what the app thinks it received

### API

- add one package-creation route that accepts:
  - JSON for text-based intake
  - multipart form-data for asset-backed intake
- return the normalized package payload to the client
- allow `/api/homeschool/onboarding` to accept `sourcePackageId`

## Contracts To Add

- `contracts/normalized-intake-source-package.md`

## Exit Criteria

- parent can paste text or upload a supported asset from onboarding
- asset-backed intake is stored durably before generation
- onboarding preview can show a normalized intake package
- fast-path onboarding no longer depends on raw textarea text alone
