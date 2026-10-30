import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResxViewer } from "../src/components/viewers/ResxViewer";
import { createResource, createViewModel } from "./factories";

vi.mock("ag-grid-react", () => ({
  AgGridReact: (props: {
    rowData: Array<{ key: string; value: string; comment: string }>;
    columnDefs: Array<{ field?: string; editable?: boolean | ((params: { data?: { isNew?: boolean } }) => boolean) }>;
    onCellValueChanged: () => void;
  }) => (
    <div data-testid="resx-grid">
      {props.rowData.map((row) => (
        <span key={row.key}>{`${row.key}:${row.value}:${row.comment}`}</span>
      ))}
      <button
        onClick={() => {
          if (props.rowData[0]) props.rowData[0].value = "edited";
          props.onCellValueChanged();
        }}
      >
        Simulate edit
      </button>
      <span data-testid="editable-columns">
        {props.columnDefs.map((column) =>
          typeof column.editable === "function"
            ? String(column.editable({ data: { isNew: false } }))
            : String(column.editable),
        ).join(",")}
      </span>
    </div>
  ),
}));

describe("ResxViewer", () => {
  it("parses RESX entries and serializes edits back to the resource", () => {
    const resource = createResource(
      "resx-1",
      "labels.resx",
      12,
      '<root><data name="greeting"><value>Hello</value><comment>Comment</comment></data></root>',
    );
    const vm = createViewModel();
    render(<ResxViewer resource={resource} vm={vm} />);

    expect(screen.getByText("greeting:Hello:Comment")).toBeInTheDocument();
    screen.getByRole("button", { name: "Simulate edit" }).click();
    expect(resource.stringContent).toContain("<value>edited</value>");
  });

  it("disables editing for managed resources and handles missing content", () => {
    const managed = createResource("resx-2", "managed.resx", 12, "<root/>");
    managed.isCustomizable = false;
    render(<ResxViewer resource={managed} vm={createViewModel()} />);
    expect(screen.getByTestId("editable-columns")).toHaveTextContent("false,false,false");

    render(<ResxViewer resource={createResource("resx-3", "empty.resx", 12, null)} vm={createViewModel()} />);
    expect(screen.getByText("No content available")).toBeInTheDocument();
  });

  it("adds a blank entry when the view model requests a row", () => {
    const resource = createResource("resx-4", "new.resx", 12, "<root/>");
    const vm = createViewModel();
    render(<ResxViewer resource={resource} vm={vm} />);
    act(() => vm.triggerResxAddRow());

    expect(resource.stringContent).toContain("<data name=\"\"");
  });
});
