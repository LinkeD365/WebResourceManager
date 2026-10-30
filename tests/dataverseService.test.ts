import { beforeEach, describe, expect, it, vi } from "vitest";
import { dvService } from "../src/services/dataverseService";

const connection: ToolBoxAPI.DataverseConnection = {
  id: "connection-1",
  name: "Development",
  url: "https://example.crm.dynamics.com",
  environment: "Dev",
};

const createHarness = () => {
  const api = {
    queryData: vi.fn(),
    fetchXmlQuery: vi.fn(),
    retrieve: vi.fn(),
    update: vi.fn(),
    execute: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  } as unknown as DataverseAPI.API;
  const activeConnection = vi.fn(async () => connection);
  const onLog = vi.fn();
  const service = new dvService({
    connection,
    dvApi: api,
    getActiveConnection: activeConnection,
    onLog,
  });
  return { api, activeConnection, onLog, service };
};

describe("dvService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("builds paged FetchXML queries and escapes interpolated filters", async () => {
    const { api, service } = createHarness();
    vi.mocked(api.fetchXmlQuery).mockResolvedValueOnce({
      value: [{ webresourceid: "wr-1", name: "a.js", webresourcetype: 3 }],
      "@Microsoft.Dynamics.CRM.fetchxmlpagingcookie": "<cookie pagenumber='2' pagingcookie='x'/>",
    });

    const result = await service.getWebResources(
      "solution'&id",
      [3],
      ["prefix' OR 'x'='x"],
      false,
      false,
    );
    const fetchXml = vi.mocked(api.fetchXmlQuery).mock.calls[0][0];

    expect(fetchXml).toContain("count='500'");
    expect(fetchXml).toContain("solution&apos;&amp;id");
    expect(fetchXml).toContain("prefix&apos; OR &apos;x&apos;=&apos;x");
    expect(result.resources[0].id).toBe("wr-1");
    expect(result.pagingCookie).toContain("pagenumber");
  });

  it("escapes paging cookies before inserting them into FetchXML", async () => {
    const { api, service } = createHarness();
    vi.mocked(api.fetchXmlQuery).mockResolvedValueOnce({ value: [] });
    await service.getWebResources("solution", [], [], false, false, "<cookie pagenumber='2' pagingcookie='a%2526b'/>");

    expect(vi.mocked(api.fetchXmlQuery).mock.calls[0][0]).toContain("paging-cookie='a&amp;b'");
  });

  it("encodes Unicode content and validates the fresh target before saving", async () => {
    const { api, service } = createHarness();
    vi.mocked(api.retrieve).mockResolvedValueOnce({
      name: "script.js",
      iscustomizable: { Value: true },
    });

    await service.saveWebResourceContent("wr-1", "héllo", "script.js");

    const update = vi.mocked(api.update).mock.calls[0];
    expect(update[0]).toBe("webresource");
    const bytes = Uint8Array.from(atob((update[2] as { content: string }).content), (character) =>
      character.charCodeAt(0),
    );
    expect(new TextDecoder().decode(bytes)).toBe("héllo");
    expect(api.retrieve).toHaveBeenCalledWith(
      "webresource",
      "wr-1",
      ["webresourceid", "name", "displayname", "iscustomizable"],
    );
  });

  it("rejects a stale connection, uncustomizable resource, or changed name before writing", async () => {
    const stale = createHarness();
    stale.activeConnection.mockResolvedValue({
      ...connection,
      id: "connection-2",
    });
    await expect(stale.service.saveWebResourceContent("wr-1", "x", "script.js")).rejects.toThrow(
      "active Dataverse connection changed",
    );
    expect(stale.api.update).not.toHaveBeenCalled();

    const changedUrl = createHarness();
    changedUrl.activeConnection.mockResolvedValue({
      ...connection,
      url: "https://other.crm.dynamics.com",
    });
    await expect(changedUrl.service.saveWebResourceContent("wr-1", "x", "script.js")).rejects.toThrow(
      "active Dataverse connection changed",
    );
    expect(changedUrl.api.update).not.toHaveBeenCalled();

    const managed = createHarness();
    vi.mocked(managed.api.retrieve).mockResolvedValueOnce({
      name: "script.js",
      iscustomizable: { Value: false },
    });
    await expect(managed.service.saveWebResourceContent("wr-1", "x", "script.js")).rejects.toThrow(
      "not customizable",
    );
    expect(managed.api.update).not.toHaveBeenCalled();

    const renamed = createHarness();
    vi.mocked(renamed.api.retrieve).mockResolvedValueOnce({
      name: "renamed.js",
      iscustomizable: { Value: true },
    });
    await expect(renamed.service.renameWebResources([
      { id: "wr-1", oldName: "script.js", oldDisplayName: "script.js", newName: "new.js" },
    ])).rejects.toThrow("changed since it was reviewed");
    expect(renamed.api.update).not.toHaveBeenCalled();
  });

  it("does not re-encode already-base64 image contents", async () => {
    const { api, service } = createHarness();
    vi.mocked(api.retrieve).mockResolvedValueOnce({
      name: "image.png",
      iscustomizable: { Value: true },
    });

    await service.saveWebResourceContent("image-id", "aGVsbG8=", "image.png", true);

    expect(api.update).toHaveBeenCalledWith("webresource", "image-id", { content: "aGVsbG8=" });
  });

  it("rejects a save when server content changed after the backup snapshot", async () => {
    const { api, service } = createHarness();
    vi.mocked(api.retrieve).mockResolvedValueOnce({
      name: "script.js",
      iscustomizable: { Value: true },
    });
    vi.mocked(api.queryData).mockResolvedValueOnce({
      value: [{ content: "bmV3LXNlcnZlci1jb250ZW50" }],
    });

    await expect(
      service.saveWebResourceContent(
        "wr-1",
        "replacement",
        "script.js",
        false,
        "b2xkLXNlcnZlci1jb250ZW50",
      ),
    ).rejects.toThrow("changed after its backup was created");
    expect(api.update).not.toHaveBeenCalled();
  });

  it("rolls back earlier folder renames when a later update fails", async () => {
    const { api, service } = createHarness();
    const records: Record<string, Array<Record<string, unknown>>> = {
      "1": [
        { name: "old/a.js", displayname: null, iscustomizable: { Value: true } },
        { name: "new/a.js", displayname: "New label", iscustomizable: { Value: true } },
      ],
      "2": [
        { name: "old/b.js", displayname: "B", iscustomizable: { Value: true } },
        { name: "old/b.js", displayname: "B", iscustomizable: { Value: true } },
      ],
    };
    vi.mocked(api.retrieve).mockImplementation(async (_entity, id) => records[id].shift() ?? {});
    vi.mocked(api.update)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("conflict"))
      .mockResolvedValueOnce(undefined);

    await expect(
      service.renameWebResources([
        { id: "1", oldName: "old/a.js", oldDisplayName: "A", newName: "new/a.js" },
        { id: "2", oldName: "old/b.js", oldDisplayName: "B", newName: "new/b.js" },
      ]),
    ).rejects.toThrow("1 completed change was rolled back");

    expect(api.update).toHaveBeenNthCalledWith(3, "webresource", "1", {
      name: "old/a.js",
      displayname: null,
    });
  });

  it("reports both the original rename error and rollback failure", async () => {
    const { api, service } = createHarness();
    vi.mocked(api.retrieve)
      .mockResolvedValueOnce({ name: "old/a.js", displayname: "A", iscustomizable: { Value: true } })
      .mockResolvedValueOnce({ name: "old/b.js", displayname: "B", iscustomizable: { Value: true } })
      .mockResolvedValueOnce({ name: "old/b.js", displayname: "B", iscustomizable: { Value: true } })
      .mockResolvedValueOnce({ name: "new/a.js", displayname: "New A", iscustomizable: { Value: true } });
    vi.mocked(api.update)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("original rename conflict"))
      .mockRejectedValueOnce(new Error("rollback permission denied"));

    await expect(
      service.renameWebResources([
        { id: "1", oldName: "old/a.js", oldDisplayName: "A", newName: "new/a.js" },
        { id: "2", oldName: "old/b.js", oldDisplayName: "B", newName: "new/b.js" },
      ]),
    ).rejects.toThrow(/original rename conflict.*rollback permission denied/);
  });

  it("cancels a folder rename between requests and rolls back completed changes", async () => {
    const { api, service } = createHarness();
    const controller = new AbortController();
    vi.mocked(api.retrieve)
      .mockResolvedValueOnce({ name: "old/a.js", displayname: null, iscustomizable: { Value: true } })
      .mockResolvedValueOnce({ name: "new/a.js", displayname: "New A", iscustomizable: { Value: true } });
    vi.mocked(api.update)
      .mockImplementationOnce(async () => {
        controller.abort();
      })
      .mockResolvedValueOnce(undefined);

    await expect(
      service.renameWebResources(
        [
          { id: "1", oldName: "old/a.js", oldDisplayName: "A", newName: "new/a.js" },
          { id: "2", oldName: "old/b.js", oldDisplayName: "B", newName: "new/b.js" },
        ],
        controller.signal,
      ),
    ).rejects.toThrow(/Rename cancelled.*1 completed change was rolled back/);

    expect(api.retrieve).toHaveBeenCalledTimes(2);
    expect(api.update).toHaveBeenNthCalledWith(2, "webresource", "1", {
      name: "old/a.js",
      displayname: null,
    });
  });

  it("verifies the unmanaged solution and deletes a newly created resource if solution assignment fails", async () => {
    const { api, service } = createHarness();
    vi.mocked(api.retrieve)
      .mockResolvedValueOnce({ uniquename: "custom", ismanaged: false })
      .mockResolvedValueOnce({ uniquename: "custom", ismanaged: false });
    vi.mocked(api.create).mockResolvedValueOnce({ id: "created-id" });
    vi.mocked(api.execute).mockRejectedValueOnce(new Error("assignment failed"));
    vi.mocked(api.delete).mockResolvedValueOnce(undefined);

    await expect(
      service.createWebResource("new.js", "New", 3, "solution-id", "custom"),
    ).rejects.toThrow("assignment failed");

    expect(api.delete).toHaveBeenCalledWith("webresource", "created-id");
  });

  it("rejects managed solutions before creating a resource", async () => {
    const { api, service } = createHarness();
    vi.mocked(api.retrieve).mockResolvedValueOnce({
      uniquename: "managed",
      ismanaged: true,
    });
    await expect(
      service.createWebResource("new.js", "New", 3, "solution-id", "managed"),
    ).rejects.toThrow("not an unmanaged solution");
    expect(api.create).not.toHaveBeenCalled();
  });

  it("cleans up the resource if the selected solution changes before assignment", async () => {
    const { api, service } = createHarness();
    vi.mocked(api.retrieve)
      .mockResolvedValueOnce({ uniquename: "custom", ismanaged: false })
      .mockResolvedValueOnce({ uniquename: "changed", ismanaged: false });
    vi.mocked(api.create).mockResolvedValueOnce({ id: "created-id" });
    vi.mocked(api.delete).mockResolvedValueOnce(undefined);

    await expect(
      service.createWebResource("new.js", "New", 3, "solution-id", "custom"),
    ).rejects.toThrow("selected solution changed before");
    expect(api.execute).not.toHaveBeenCalled();
    expect(api.delete).toHaveBeenCalledWith("webresource", "created-id");
  });
});
