import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewResourceDialog } from "../src/components/NewResourceDialog";
import { createDvService, createViewModel, installToolboxApi } from "./factories";

describe("NewResourceDialog", () => {
  it("renders safely when the Dataverse service is unavailable", () => {
    render(
      <NewResourceDialog
        open
        folder=""
        vm={createViewModel()}
        dvSvc={null}
        onLog={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();
  });

  it("previews the environment, resource name, and solution before creating", async () => {
    const service = createDvService();
    const vm = createViewModel();
    const onClose = vi.fn();
    installToolboxApi();
    render(
      <NewResourceDialog
        open
        folder="scripts"
        vm={vm}
        dvSvc={service}
        onLog={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("myresource"), { target: { value: "site" } });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByText("Development (Dev)")).toBeInTheDocument();
    expect(screen.getByText(/scripts\/site\.js/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm create" }));

    await waitFor(() =>
      expect(service.createWebResource).toHaveBeenCalledWith(
        "scripts/site.js",
        "site.js",
        3,
        "solution-1",
        "customizations",
      ),
    );
    expect(vm.webResources).toHaveLength(1);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("returns to the form when review is cancelled", () => {
    const service = createDvService();
    render(
      <NewResourceDialog
        open
        folder=""
        vm={createViewModel()}
        dvSvc={service}
        onLog={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("myresource"), { target: { value: "site" } });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByPlaceholderText("myresource")).toBeInTheDocument();
    expect(service.createWebResource).not.toHaveBeenCalled();
  });
});
