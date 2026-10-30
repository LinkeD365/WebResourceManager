import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImageViewer } from "../src/components/viewers/ImageViewer";
import { createResource } from "./factories";

describe("ImageViewer", () => {
  it("creates a data URL with the resource's image MIME type", () => {
    render(<ImageViewer resource={createResource("image-1", "sample.png", 5, "aGVsbG8=")} />);
    expect(screen.getByRole("img", { name: "png preview" })).toHaveAttribute(
      "src",
      "data:image/png;base64,aGVsbG8=",
    );
  });

  it("shows the empty state when content is absent", () => {
    render(<ImageViewer resource={createResource("image-2", "empty.png", 5, null)} />);
    expect(screen.getByText("No image content available")).toBeInTheDocument();
  });
});
