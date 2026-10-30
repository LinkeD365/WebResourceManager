import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WebResourceTree } from "../src/components/WebResourceTree";
import { createDvService, createResource, installToolboxApi } from "./factories";
import { ViewModel } from "../src/model/viewModel";

describe("WebResourceTree", () => {
  it("previews a resource rename and applies it only after confirmation", async () => {
    installToolboxApi();
    const vm = new ViewModel();
    const resource = createResource("resource-1", "sample.js");
    vm.setWebResources([resource]);
    const service = createDvService();
    render(<WebResourceTree vm={vm} dvSvc={service} onLog={vi.fn()} />);

    fireEvent.contextMenu(screen.getByText("sample.js"));
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByDisplayValue("sample.js"), { target: { value: "renamed.js" } });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));

    expect(screen.getByText("Rename sample.js to renamed.js")).toBeInTheDocument();
    expect(service.renameWebResources).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm rename" }));

    await waitFor(() => expect(service.renameWebResources).toHaveBeenCalledOnce());
    expect(service.renameWebResources).toHaveBeenCalledWith(
      [
        {
          id: "resource-1",
          oldName: "sample.js",
          oldDisplayName: "sample.js",
          newName: "renamed.js",
        },
      ],
      expect.any(AbortSignal),
    );
    expect(resource.name).toBe("renamed.js");
  });

  it("does not rename on blur or when the review is cancelled", () => {
    const vm = new ViewModel();
    vm.setWebResources([createResource("resource-1", "sample.js")]);
    const service = createDvService();
    render(<WebResourceTree vm={vm} dvSvc={service} onLog={vi.fn()} />);

    fireEvent.contextMenu(screen.getByText("sample.js"));
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    const input = screen.getByDisplayValue("sample.js");
    fireEvent.change(input, { target: { value: "renamed.js" } });
    fireEvent.blur(input);
    expect(service.renameWebResources).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(service.renameWebResources).not.toHaveBeenCalled();
  });

  it("stops a repeated paging cookie instead of recursing indefinitely", async () => {
    const vm = new ViewModel();
    vm.selectedSolution = {
      id: "solution-1",
      name: "Customizations",
      uniqueName: "customizations",
      managed: false,
    } as ViewModel["selectedSolution"];
    const onLog = vi.fn();
    const getWebResources = vi.fn().mockResolvedValue({
      resources: [],
      pagingCookie: "<cookie pagenumber='2' pagingcookie='repeat'/>",
    });
    const service = createDvService({ getWebResources });
    render(<WebResourceTree vm={vm} dvSvc={service} onLog={onLog} />);

    await waitFor(() => expect(getWebResources).toHaveBeenCalledTimes(2));
    expect(onLog).toHaveBeenCalledWith(
      "Stopped loading because Dataverse repeated a paging cookie.",
      "error",
    );
    expect(vm.loadingWebResources).toBe(false);
  });
});
