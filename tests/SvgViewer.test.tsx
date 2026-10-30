import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SvgViewer } from "../src/components/viewers/SvgViewer";
import { createResource } from "./factories";

describe("SvgViewer", () => {
  it("renders sanitized SVG as an image instead of injecting markup", () => {
    const resource = createResource(
      "svg-1",
      "icon.svg",
      11,
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><path d="M0 0"/></svg>',
    );
    render(<SvgViewer resource={resource} />);

    const image = screen.getByRole("img", { name: "icon.svg preview" });
    expect(image.getAttribute("src")).toContain("data:image/svg+xml");
    expect(image.getAttribute("src")).not.toContain("script");
    expect(document.querySelector("script")).toBeNull();
  });

  it("reports invalid source instead of rendering it", () => {
    render(<SvgViewer resource={createResource("svg-2", "invalid.svg", 11, "<div>unsafe</div>")} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/invalid/i);
  });
});
