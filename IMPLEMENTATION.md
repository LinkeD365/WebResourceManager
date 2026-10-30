# Implementation Plan

## Objectives

1. Prevent active SVG markup from being inserted into the tool's HTML document.
2. Require an explicit, environment- and scope-aware review before every Dataverse write.
3. Export the current resource as a backup before replacing its content.
4. Revalidate the active connection and Dataverse target immediately before writes.
5. Roll back completed members of a folder rename when a later rename fails, and report incomplete rollback explicitly.
6. Document every write and export in the user guide, and use an icon that represents the tool rather than its publisher.
7. Add runnable automated tests covering existing application modules and the new safeguards.

## Implementation sequence

1. Add a Vitest/jsdom test setup and a shared test harness; establish the full-suite command.
2. Add SVG sanitization and render the sanitized result as an image, not injected markup.
3. Add a reusable write-review dialog showing the active environment and exact target scope.
4. Add a required pre-write backup export for content replacement and native confirmations for resource creation, publishing, and renames.
5. Add active-connection checks and fresh resource/solution validation at the service boundary; make folder renames cancellable between requests and roll back partial changes when possible.
6. Update package metadata, README, and this document with accurate behavior, attribution, safeguards, and test commands.
7. Run focused tests, the complete test suite, the production build, package validation, and dependency audit.

## Test organization

- `tests/viewModel.test.ts`: filtering, tree construction, virtual folders, selection, and tab state transitions.
- `tests/dataverseService.test.ts`: request construction, pagination, content encoding, fresh target validation, stale-backup conflicts, write errors, cancellation, and rename rollback metadata/error reporting.
- `tests/useToolboxAPI.test.tsx`: connection loading, host events, and bounded event-log state.
- `tests/*Dialog.test.tsx`, `tests/*Tree.test.tsx`, and `tests/*Manager.test.tsx`: UI flows, nullable-service behavior, scope previews, backup freshness, rename reconciliation, confirmations, and host interactions.
- `tests/*Viewer.test.tsx` and `tests/sanitizeSvg.test.ts`: code, image, sanitized SVG, and RESX rendering/edit behavior.
- `tests/factories.ts` and `tests/setup.ts`: shared fake host/service objects and jsdom/testing-library setup.

All test files and shared test scripts live together in `tests/`. Tests use Vitest with jsdom and React Testing Library. They mock PPTB host APIs at the service boundary; they do not represent real-environment acceptance testing.

## Commands

- Full automated suite: `npm test`
- Focused suite: `npm test -- tests/dataverseService.test.ts`
- Test TypeScript check: `npm run test:types`
- Build and type-check: `npm run build`
- Manifest validation: `npm run validate`
- Dependency audit: `npm audit`

## Releases

Releases follow the Release Please flow used by BulkDataStudio. The package and release manifest baseline is `1.0.0`. Use Conventional Commit messages so Release Please can determine the next version: `fix:` for patch releases, `feat:` for minor releases, and a breaking-change footer or `!` marker for major releases. Commits pushed to `main` drive a Release Please pull request that updates the package version and changelog. Merge the reviewed release pull request to create the release tag; the release workflow then installs from the shrinkwrap, runs tests, type-checking, validation, audit, and build, and publishes the tagged package to npm with provenance.

The CI workflow runs the same quality checks for pull requests and pushes to `main`. Publishing requires the GitHub `npm` environment to be configured for npm trusted publishing/provenance. Do not publish manually as part of normal release flow.

Configure a repository secret named `RELEASE_PLEASE_TOKEN` with a GitHub App installation token or fine-grained personal access token that can write contents, issues, and pull requests. Release Please uses this token so its generated release pull requests trigger the normal pull-request CI checks. The workflow can create/update the release pull request without that secret only if a token is otherwise supplied, but generated PR checks will not be triggered by the default `GITHUB_TOKEN`.

## External verification still required

Before marketplace submission, a person must test the packaged tool inside PPTB against a real Dataverse environment, verify permissions and failure behavior, use realistic resource volumes, and inspect both light and dark themes. Automated tests cannot verify host connection locking or live Dataverse behavior.

Use the [human acceptance-testing checklist](./TESTING.md) to record these checks. For end-user behavior and usage guidance, see the [README](./README.md).
