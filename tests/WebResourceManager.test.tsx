import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { describe, expect, it, vi } from "vitest";
import { WebResourceManager } from "../src/components/WebResourceManager";
import { ViewModel } from "../src/model/viewModel";
import {
  createDvService,
  createResource,
  installToolboxApi,
  testConnection,
} from "./factories";

vi.mock("../src/components/WebResourceTree", () => ({ WebResourceTree: () => <div data-testid="resource-tree" /> }));
vi.mock("../src/components/WebResourceDetails", () => ({ WebResourceDetails: () => <div data-testid="resource-details" /> }));
vi.mock("../src/components/ResourceTypeFilter", () => ({ ResourceTypeFilter: () => <div data-testid="type-filter" /> }));

const renderManager = (vm: ViewModel, service: ReturnType<typeof createDvService>, onLog = vi.fn()) =>
  render(
    <FluentProvider theme={webLightTheme}>
      <WebResourceManager connection={testConnection} dvSvc={service} vm={vm} onLog={onLog} />
    </FluentProvider>,
  );

describe("WebResourceManager", () => {
  it("requires a backup and confirmation before replacing resource content", async () => {
    const toolboxAPI = installToolboxApi();
    const vm = new ViewModel();
    const resource = createResource("resource-1", "folder/sample.js");
    resource.stringContent = "const changed = true;";
    vm.openTab(resource);
    const service = createDvService();
    renderManager(vm, service);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Development (Dev)")).toBeInTheDocument();
    const confirmButton = screen.getByRole("button", { name: "Confirm save" });
    expect(confirmButton).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Export backup" }));
    await waitFor(() => expect(confirmButton).toBeEnabled());
    expect(toolboxAPI.fileSystem.saveFile).toHaveBeenCalledWith(
      "sample.js.backup.js",
      "original",
      [{ name: "JavaScript backup", extensions: ["js"] }],
    );
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(service.saveWebResourceContent).toHaveBeenCalledWith(
        "resource-1",
        "const changed = true;",
        "folder/sample.js",
        false,
      ),
    );
    expect(resource.isDirty).toBe(false);
  });

  it("does not write when the user cancels the review", () => {
    installToolboxApi();
    const vm = new ViewModel();
    const resource = createResource();
    resource.stringContent = "changed";
    vm.openTab(resource);
    const service = createDvService();
    renderManager(vm, service);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(service.saveWebResourceContent).not.toHaveBeenCalled();
  });

  it("saves before publishing when the user explicitly confirms Save and Publish", async () => {
    installToolboxApi();
    const vm = new ViewModel();
    const resource = createResource();
    resource.stringContent = "changed";
    vm.openTab(resource);
    const service = createDvService();
    renderManager(vm, service);

    fireEvent.click(screen.getByRole("button", { name: "Save and Publish" }));
    fireEvent.click(screen.getByRole("button", { name: "Export backup" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirm save and publish" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Confirm save and publish" }));

    await waitFor(() => expect(service.publishWebResource).toHaveBeenCalledWith("resource-1", "sample.js"));
    expect(service.saveWebResourceContent).toHaveBeenCalledWith("resource-1", "changed", "sample.js", false);
    expect(resource.isSavedNotPublished).toBe(false);
  });

  it("exports binary image backups and preserves their base64 content on save", async () => {
    const toolboxAPI = installToolboxApi();
    const vm = new ViewModel();
    const resource = createResource("image-1", "sample.png", 5, "aGVsbG8=");
    resource.stringContent = "d29ybGQ=";
    vm.openTab(resource);
    const service = createDvService();
    renderManager(vm, service);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Export backup" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirm save" })).toBeEnabled());

    const backupCall = vi.mocked(toolboxAPI.fileSystem.saveFile).mock.calls[0];
    expect(backupCall[0]).toBe("sample.png.backup.png");
    expect(backupCall[1]).toEqual(Uint8Array.from([104, 101, 108, 108, 111]));
    fireEvent.click(screen.getByRole("button", { name: "Confirm save" }));

    await waitFor(() =>
      expect(service.saveWebResourceContent).toHaveBeenCalledWith(
        "image-1",
        "d29ybGQ=",
        "sample.png",
        true,
      ),
    );
  });
});
