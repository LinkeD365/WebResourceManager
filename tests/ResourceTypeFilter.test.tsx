import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResourceTypeFilter } from "../src/components/ResourceTypeFilter";
import { createViewModel } from "./factories";

describe("ResourceTypeFilter", () => {
  it("applies drafted type and visibility filters when the popover closes", () => {
    const vm = createViewModel();
    render(<ResourceTypeFilter vm={vm} />);

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "JavaScript" }));
    expect(vm.isTypeFilteredIn(3)).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(vm.isTypeFilteredIn(3)).toBe(false);
    expect(screen.getByText((content) => content.includes("Inc Mgd") && content.includes("Not Hdn"))).toBeInTheDocument();
  });

  it("supports changing the prefix exclusion", () => {
    const vm = createViewModel();
    render(<ResourceTypeFilter vm={vm} />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.change(screen.getByPlaceholderText("e.g. contoso_, fabrikam_"), {
      target: { value: "custom_" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(vm.prefixFilter).toBe("custom_");
  });
});
