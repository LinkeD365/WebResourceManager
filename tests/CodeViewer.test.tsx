import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CodeViewer, prettifyCode } from "../src/components/viewers/CodeViewer";
import { createResource } from "./factories";

vi.mock("react-ace", () => ({
  default: (props: {
    mode: string;
    value: string;
    readOnly: boolean;
    onChange: (value: string) => void;
    onLoad: (editor: { execCommand: (command: string) => void }) => void;
  }) => {
    props.onLoad({ execCommand: vi.fn() });
    return (
      <textarea
        aria-label="Code editor"
        data-mode={props.mode}
        value={props.value}
        readOnly={props.readOnly}
        onChange={(event) => props.onChange(event.target.value)}
      />
    );
  },
}));
vi.mock("ace-builds/src-noconflict/mode-javascript", () => ({}));
vi.mock("ace-builds/src-noconflict/mode-css", () => ({}));
vi.mock("ace-builds/src-noconflict/mode-html", () => ({}));
vi.mock("ace-builds/src-noconflict/mode-xml", () => ({}));
vi.mock("ace-builds/src-noconflict/theme-chrome", () => ({}));
vi.mock("ace-builds/src-noconflict/theme-monokai", () => ({}));
vi.mock("ace-builds/src-noconflict/ext-searchbox", () => ({}));

describe("CodeViewer", () => {
  beforeEach(() => {
    document.body.setAttribute("data-theme", "light");
  });

  it("selects the code mode and updates the resource when edited", () => {
    const resource = createResource("code-1", "sample.js", 3, "const a=1");
    render(<CodeViewer resource={resource} searchTrigger={0} />);
    const editor = screen.getByRole("textbox", { name: "Code editor" });

    expect(editor).toHaveAttribute("data-mode", "javascript");
    fireEvent.change(editor, { target: { value: "const a = 1;" } });
    expect(resource.stringContent).toBe("const a = 1;");
    expect(resource.isDirty).toBe(true);
  });

  it("makes managed resources read-only and shows a notice", () => {
    const resource = createResource("code-2", "managed.js", 3, "x");
    resource.isCustomizable = false;
    render(<CodeViewer resource={resource} searchTrigger={0} />);

    expect(screen.getByRole("textbox", { name: "Code editor" })).toHaveAttribute("readonly");
    expect(screen.getByText("This file is not customizable")).toBeInTheDocument();
  });

  it("prettifies supported code and leaves unsupported types unchanged", () => {
    expect(prettifyCode("const x=1;", 3)).toContain("const x = 1");
    expect(prettifyCode("<a/>", 4)).toBe("<a/>");
  });

  it("shows an empty state without loaded content", () => {
    render(<CodeViewer resource={createResource("code-3", "empty.js", 3, null)} searchTrigger={0} />);
    expect(screen.getByText("No content available")).toBeInTheDocument();
  });
});
