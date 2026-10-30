# Human Acceptance Testing

Automated tests, a successful build, and `pptb-validate` do not replace testing inside Power Platform ToolBox (PPTB) against a real Dataverse environment. Complete this checklist before marketplace submission and record any failures or deviations.

## Test record

- Tester: Carl Cookson
- Date: 30/10/26
- PPTB version: 1.2.8-dev.20261030
- Tool version or package: 0.2.3
- Dataverse environment name and URL: Linked365Dev / Redacted due to Cusomer privacy
- Environment type (development, test, or production): Dev - Linked365Dev / Prod - Customer
- Approximate number of web resources in the tested solution: 22 Dev / 680 Customer
- Result: Passed in each environment

Use a development or test environment with disposable resources for write, failure, and rollback scenarios. Do not test destructive or failure scenarios against production data.

## Setup and launch

- [x] Build and package the current tool version; verify the package contains the built icon and required documentation.
- [x] Load or install the tool in PPTB, not in a standalone browser.
- [x] Confirm the tool opens without host/API errors and displays the expected active Dataverse connection.
- [x] Confirm the tool makes no Dataverse changes merely by opening it or changing filters.
- [x] Confirm the selected solution list contains the expected visible unmanaged solutions.
- [x] Open a managed solution/resource and confirm that editing and write actions are unavailable where appropriate.

**Expected:** The tool loads inside PPTB, identifies the active connection, performs read operations only during initial load, and prevents editing non-customizable resources.

## Browsing, files, and themes

- [x] Browse a small solution and verify resource names, folders, types, and resource contents.
- [x] Exercise search and type/managed/hidden/prefix filters; verify results and empty states.
- [x] Browse a solution with enough resources to require multiple pages. Confirm loading completes or stops with a clear message at the documented 100-page bound.
- [x] Open representative text, RESX, raster image, and SVG resources.
- [x] Preview a benign SVG and an SVG containing event-handler attributes, external references, and unsupported markup. Confirm unsafe markup is not executed and the preview failure/omission is understandable.
- [x] Download text and binary resources; verify filenames, extensions, and contents.
- [x] Upload a valid text file and image to disposable resources; verify extension validation rejects an incompatible file.
- [x] Verify the interface in both light and dark PPTB themes, including dialogs, dropdowns, and other popup content.

**Expected:** Browsing and previews work with realistic data; unsafe SVG features do not execute; uploads/downloads preserve content and provide clear errors.

## Write review and connection safety

For each write scenario below:

- [x] Confirm the review shows the correct environment name, URL, and affected resource/solution scope before applying the change.
- [x] Change the active PPTB connection after opening a review but before confirming. Verify the operation is blocked and no change is made to either environment.
- [x] Cancel the review. Verify no Dataverse change occurs.
- [x] Repeat review in a development environment and confirm the displayed target is still correct.

**Expected:** The target is explicit, stale reviews cannot be applied to a different connection, and cancelling a review performs no write.

## Content save and backup

- [x] Edit a disposable text web resource and select **Save**.
- [x] Verify confirmation is disabled until the original content has been exported successfully.
- [x] Verify the exported backup can be opened and contains the original content.
- [x] Cancel a backup export or make it fail; confirm the Dataverse write remains blocked.
- [x] Export the backup, confirm the save, refresh/reopen the resource, and verify the new content persisted.
- [x] Restore the original text manually from the backup and verify it is correct.
- [x] Repeat with a disposable binary image resource. Verify the backup file and saved image bytes are valid and unchanged except for the intended replacement.
- [x] Attempt a save with missing or insufficient Dataverse privileges, if a safe test account is available. Verify the failure is surfaced and the unsaved editor content remains available.

**Expected:** The required backup is usable before overwrite; backup failure prevents the write; successful saves persist the intended content; failures are visible and do not appear successful.

## Publish

- [x] Save and publish changed content on a disposable web resource. Verify both steps complete and the published resource reflects the change.
- [x] Publish already-saved content and verify the review accurately describes the action.
- [x] Where safe, cause a publish permission or service failure. Verify the failure is surfaced and the UI does not report a successful publish.
- [x] Verify the confirmation states that publishing affects users and cannot be automatically undone.

**Expected:** Publish requires explicit confirmation, targets the reviewed resource/environment, and reports failures accurately. Restore of a published change is manual.

## Create and solution assignment

- [x] Create a disposable web resource in an unmanaged solution. Verify the review names the resource type, name, target environment, and destination solution.
- [x] Confirm creation and verify the resource appears in Dataverse and the selected solution.
- [x] Cancel creation at review and verify no resource is created.
- [x] Where safe, test a solution-assignment failure after resource creation (for example, with a controlled permission/failure setup). Verify the tool attempts cleanup and clearly reports if cleanup also fails.

**Expected:** Creation is deliberate and scoped. A failed solution assignment does not silently leave an unreported resource behind.

## Resource and folder rename

- [x] Rename a disposable resource. Verify the old/new names are reviewed and the Dataverse name changes only after confirmation.
- [x] Rename a folder containing several disposable resources. Verify the preview reports the affected count and representative old/new paths.
- [x] Cancel before confirming and verify no resource names change.
- [x] During a multi-resource rename, use **Cancel operation** between requests when available. Verify completed changes are rolled back or any incomplete rollback is explicitly reported with affected resources.
- [x] Cause a later rename to fail in a controlled test, if possible. Verify earlier renames are rolled back or incomplete rollback is clearly reported.
- [x] Refresh the resource list after success, cancellation, and failure; verify the UI matches Dataverse state.
- [x] Check the final-request cancellation behavior: if cancellation is selected while the last Dataverse request is already in flight, record whether that request completes and whether the tool reports the actual final state accurately.

**Expected:** Rename actions require review; folder scope is clear; cancellation/failure never gives a misleading success result; final Dataverse state is verified after partial operations.

## Connections, permissions, and recovery

- [x] With an authorized test account, exercise an expired connection or reconnect during a review/write. Verify stale writes are blocked or the operation fails visibly.
- [x] Exercise missing read permissions and missing write/publish permissions where safely possible.
- [x] Verify empty solutions and solutions with no matching resources produce a clear, stable empty state.
- [x] After a failed or interrupted write, compare the affected records in Dataverse with the tool's UI and confirm the state before retrying.
- [x] Verify no access tokens or sensitive resource contents appear in logs, notifications, or external requests.

**Expected:** Permission, expired-connection, and partial-operation failures are actionable, and the tool does not silently hide uncertain state.

## Completion

- [x] Record pass/fail and notes for every applicable item above.
- [x] File issues for failures and rerun affected scenarios after fixes.
- [x] Have a maintainer review and explain each destructive write and rollback path before submission.
- [x] Resolve the source/provenance and license basis for the related GPL-3.0 XrmToolBox project separately; this checklist does not establish licensing compliance.

See the [user guide](./README.md) and [implementation and automated test notes](./IMPLEMENTATION.md).
