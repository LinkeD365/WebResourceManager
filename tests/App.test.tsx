import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refreshConnection: vi.fn(),
  addLog: vi.fn(),
  eventHandler: undefined as ((event: string, data: unknown) => void) | undefined,
}));

vi.mock("../src/hooks/useToolboxAPI", () => ({
  useConnection: () => ({
    connection: {
      id: "connection-1",
      name: "Development",
      url: "https://example.crm.dynamics.com",
      environment: "Dev",
    },
    refreshConnection: mocks.refreshConnection,
  }),
  useEventLog: () => ({ addLog: mocks.addLog }),
  useToolboxEvents: (handler: (event: string, data: unknown) => void) => {
    mocks.eventHandler = handler;
  },
}));

vi.mock("../src/components/WebResourceManager", () => ({
  WebResourceManager: () => <div data-testid="manager" />,
}));

import App from "../src/App";
import { installToolboxApi } from "./factories";

describe("App", () => {
  beforeEach(() => {
    mocks.refreshConnection.mockReset();
    mocks.addLog.mockReset();
    mocks.eventHandler = undefined;
  });

  it("initializes the host theme and refreshes the connection on host events", async () => {
    installToolboxApi();
    Object.defineProperty(window, "dataverseAPI", { configurable: true, value: {} });
    render(<App />);

    await waitFor(() => expect(document.body).toHaveAttribute("data-theme", "light"));
    act(() => mocks.eventHandler?.("connection:updated", {}));
    expect(mocks.refreshConnection).toHaveBeenCalledOnce();
    expect(mocks.addLog).toHaveBeenCalledWith("WebResourceManager initialized", "success");

    act(() => mocks.eventHandler?.("settings:updated", { theme: "dark" }));
    await waitFor(() => expect(document.body).toHaveAttribute("data-theme", "dark"));
  });
});
