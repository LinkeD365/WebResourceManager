import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useConnection, useEventLog, useToolboxEvents } from "../src/hooks/useToolboxAPI";
import { installToolboxApi, testConnection } from "./factories";

describe("PPTB API hooks", () => {
  it("loads the current connection and completes the loading state", async () => {
    const toolboxAPI = installToolboxApi();
    const { result } = renderHook(() => useConnection());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.connection).toEqual(testConnection);
    expect(toolboxAPI.connections.getActiveConnection).toHaveBeenCalledOnce();
  });

  it("dispatches host events to the latest handler", () => {
    const toolboxAPI = installToolboxApi();
    const callback = vi.fn();
    renderHook(() => useToolboxEvents(callback));
    const handler = vi.mocked(toolboxAPI.events.on).mock.calls[0][0];
    act(() => handler({}, { event: "connection:updated", data: { id: "c1" }, timestamp: "now" }));

    expect(callback).toHaveBeenCalledWith("connection:updated", { id: "c1" });
  });

  it("keeps the most recent 50 log entries and clears them", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { result } = renderHook(() => useEventLog());
    act(() => {
      for (let index = 0; index < 55; index++) result.current.addLog(`item-${index}`);
    });

    expect(result.current.logs).toHaveLength(50);
    expect(result.current.logs[0].message).toBe("item-54");
    expect(log).toHaveBeenCalledTimes(55);
    act(() => result.current.clearLogs());
    expect(result.current.logs).toEqual([]);
  });
});
