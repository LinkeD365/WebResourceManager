import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  render: vi.fn(),
  createRoot: vi.fn(),
}));

vi.mock("react-dom/client", () => ({
  createRoot: mocks.createRoot.mockReturnValue({ render: mocks.render }),
}));
vi.mock("../src/App", () => ({ default: () => null }));

describe("application entry point", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    mocks.createRoot.mockClear();
    mocks.render.mockClear();
    vi.resetModules();
  });

  it("mounts the app exactly once when the root element exists", async () => {
    document.body.innerHTML = '<div id="root"></div>';
    await import("../src/main");
    await import("../src/main");

    expect(mocks.createRoot).toHaveBeenCalledOnce();
    expect(mocks.render).toHaveBeenCalledOnce();
    expect(document.getElementById("root")).toHaveAttribute("data-reactroot-initialized", "true");
  });

  it("reports a missing root element", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await import("../src/main");

    expect(error).toHaveBeenCalledWith(
      "Root element not found. Make sure the HTML contains <div id=\"root\"></div>",
    );
    expect(mocks.createRoot).not.toHaveBeenCalled();
  });
});
