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

  it("renders safely when the Dataverse service is unavailable", () => {
    render(<WebResourceTree vm={new ViewModel()} dvSvc={null} onLog={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Confirm rename" })).not.toBeInTheDocument();
  });

  it("reconciles server names after an incomplete rename without discarding editor content", async () => {
    installToolboxApi();
    const vm = new ViewModel();
    const resource = createResource("resource-1", "sample.js");
    vm.setWebResources([resource]);
    resource.stringContent = "unsaved editor content";
    vm.openTab(resource);
    const service = createDvService({
      renameWebResources: vi.fn().mockRejectedValue(new Error("conflict")),
      getWebResourceNameStates: vi.fn().mockResolvedValue([
        { id: "resource-1", name: "server-name.js", displayName: "Server label" },
      ]),
    });
    render(<WebResourceTree vm={vm} dvSvc={service} onLog={vi.fn()} />);

    fireEvent.contextMenu(screen.getByText("sample.js"));
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByDisplayValue("sample.js"), { target: { value: "renamed.js" } });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm rename" }));

    await waitFor(() => expect(resource.name).toBe("server-name.js"));
    expect(resource.path).toBe("server-name.js");
    expect(resource.displayName).toBe("Server label");
    expect(resource.stringContent).toBe("unsaved editor content");
    expect(vm.openTabs).toContain(resource);
    expect(screen.queryByText("Rename sample.js to renamed.js")).not.toBeInTheDocument();
    expect(service.getWebResourceNameStates).toHaveBeenCalledWith(["resource-1"]);
  });

  it("preserves virtual folders when a folder rename fails", async () => {
    installToolboxApi();
    const vm = new ViewModel();
    vm.setWebResources([createResource("resource-1", "old/sample.js")]);
    vm.addVirtualFolder("old/local-empty");
    const service = createDvService({
      renameWebResources: vi.fn().mockRejectedValue(new Error("conflict")),
      getWebResourceNameStates: vi.fn().mockResolvedValue([
        { id: "resource-1", name: "old/sample.js", displayName: "sample.js" },
      ]),
    });
    render(<WebResourceTree vm={vm} dvSvc={service} onLog={vi.fn()} />);

    fireEvent.contextMenu(screen.getByText("old"));
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByDisplayValue("old"), { target: { value: "new" } });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm rename" }));

    await waitFor(() => expect(service.getWebResourceNameStates).toHaveBeenCalledOnce());
    expect(vm.virtualFolders.has("old/local-empty")).toBe(true);
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

  it("deduplicates resources returned again on a repeated page", async () => {
    const vm = new ViewModel();
    vm.selectedSolution = {
      id: "solution-1",
      name: "Customizations",
      uniqueName: "customizations",
      managed: false,
    } as ViewModel["selectedSolution"];
    const duplicatedResource = createResource("resource-1", "sample.js");
    const getWebResources = vi.fn()
      .mockResolvedValueOnce({
        resources: [duplicatedResource],
        pagingCookie: "<cookie pagenumber='2' pagingcookie='repeat'/>",
      })
      .mockResolvedValueOnce({
        resources: [createResource("resource-1", "sample.js")],
        pagingCookie: "<cookie pagenumber='2' pagingcookie='repeat'/>",
      });
    render(<WebResourceTree vm={vm} dvSvc={createDvService({ getWebResources })} onLog={vi.fn()} />);

    await waitFor(() => expect(vm.loadingWebResources).toBe(false));
    expect(vm.webResources).toHaveLength(1);
    expect(vm.webResources[0]).toBe(duplicatedResource);
  });
});
