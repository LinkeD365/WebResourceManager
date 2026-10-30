import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { isSameWriteTarget, WriteConfirmationDialog } from "../src/components/WriteConfirmationDialog";
import { testConnection, testTarget } from "./factories";

describe("WriteConfirmationDialog", () => {
  it("shows environment and scope and requires a successful backup before confirmation", async () => {
    const onExportBackup = vi.fn().mockResolvedValue("/backups/sample.js");
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <WriteConfirmationDialog
        open
        title="Review content save"
        actionLabel="Confirm save"
        target={testTarget}
        connectionMatches
        changes={["sample.js", "Replace the saved content"]}
        rollbackNotice="Rollback is manual."
        requiresBackup
        onExportBackup={onExportBackup}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Development (Dev)")).toBeInTheDocument();
    expect(screen.getByText(testTarget.url)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm save" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Export backup" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("/backups/sample.js"));
    expect(screen.getByRole("button", { name: "Confirm save" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm save" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("blocks confirmation when the active connection no longer matches", () => {
    render(
      <WriteConfirmationDialog
        open
        title="Review"
        actionLabel="Confirm"
        target={testTarget}
        connectionMatches={false}
        changes={["Rename resource"]}
        rollbackNotice="Rollback is attempted."
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/active connection changed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });

  it("offers a cancellation action while a cancellable write is running", () => {
    const onCancelBusy = vi.fn();
    render(
      <WriteConfirmationDialog
        open
        title="Review"
        actionLabel="Renaming..."
        target={testTarget}
        connectionMatches
        changes={["Rename resources"]}
        rollbackNotice="Completed changes will be rolled back."
        onConfirm={vi.fn()}
        onClose={vi.fn()}
        onCancelBusy={onCancelBusy}
        isBusy
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel operation" }));
    expect(onCancelBusy).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Renaming..." })).toBeDisabled();
  });

  it("treats a changed environment URL as a different write target", () => {
    expect(
      isSameWriteTarget(
        { ...testConnection, url: "https://other.crm.dynamics.com" },
        testTarget,
      ),
    ).toBe(false);
    expect(isSameWriteTarget({ ...testConnection, url: `${testConnection.url}/` }, testTarget)).toBe(true);
  });

  it("does not allow a cancelled or failed backup to proceed", async () => {
    const onExportBackup = vi.fn().mockResolvedValue(null);
    render(
      <WriteConfirmationDialog
        open
        title="Review"
        actionLabel="Confirm"
        target={testTarget}
        connectionMatches
        changes={["Replace resource"]}
        rollbackNotice="Manual rollback."
        requiresBackup
        onExportBackup={onExportBackup}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Export backup" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/no backup was saved/i));
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });
});
