import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WebResourceDetails } from "../src/components/WebResourceDetails";
import { createDvService, createResource, createViewModel } from "./factories";

vi.mock("../src/components/viewers/CodeViewer", () => ({
  CodeViewer: ({ resource }: { resource: { stringContent: string | null } }) => (
    <div data-testid="code-content">{resource.stringContent}</div>
  ),
}));
vi.mock("../src/components/viewers/SvgViewer", () => ({ SvgViewer: () => <div>SVG preview</div> }));
vi.mock("../src/components/viewers/ImageViewer", () => ({ ImageViewer: () => <div>Image preview</div> }));
vi.mock("../src/components/viewers/ResxViewer", () => ({ ResxViewer: () => <div>RESX preview</div> }));

describe("WebResourceDetails", () => {
  it("loads and decodes text content for the selected resource", async () => {
    const resource = createResource("resource-1", "sample.js", 3, null);
    const vm = createViewModel();
    vm.openTab(resource);
    const service = createDvService({
      getWebResourceContent: vi.fn().mockResolvedValue(btoa("const x = 1;")),
    });
    render(
      <WebResourceDetails
        vm={vm}
        dvSvc={service}
        onLog={vi.fn()}
        drawerOpen
        onToggleDrawer={vi.fn()}
        codeSearchTrigger={0}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("code-content")).toHaveTextContent("const x = 1;"));
    expect(resource.originalContent).toBe("const x = 1;");
  });

  it("asks before closing a tab with unsaved edits", () => {
    const resource = createResource("resource-1", "sample.js");
    resource.stringContent = "edited";
    const vm = createViewModel();
    vm.openTab(resource);
    render(
      <WebResourceDetails
        vm={vm}
        dvSvc={createDvService()}
        onLog={vi.fn()}
        drawerOpen
        onToggleDrawer={vi.fn()}
        codeSearchTrigger={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close sample.js" }));
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(vm.openTabs).toHaveLength(0);
    expect(resource.stringContent).toBe("original");
  });

  it("shows an empty state without a selected resource", () => {
    render(
      <WebResourceDetails
        vm={createViewModel()}
        dvSvc={createDvService()}
        onLog={vi.fn()}
        drawerOpen={false}
        onToggleDrawer={vi.fn()}
        codeSearchTrigger={0}
      />,
    );
    expect(screen.getByText("Select a web resource to view details")).toBeInTheDocument();
  });
});
