import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContextMenu } from "../src/components/ContextMenu";

describe("ContextMenu", () => {
  it("shows only available actions and invokes the chosen action", () => {
    const onNewResource = vi.fn();
    const onRename = vi.fn();
    const onClose = vi.fn();
    render(
      <ContextMenu
        target={{ x: 10, y: 20 }}
        onClose={onClose}
        onNewResource={onNewResource}
        onRename={onRename}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /new resource/i }));
    expect(onNewResource).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Rename" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
  });
});
