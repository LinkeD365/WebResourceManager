import { SolutionMeta, WebResource } from "../model/viewModel";

export interface WebResourcesResult {
  resources: WebResource[];
  pagingCookie?: string;
}

interface dvServiceProps {
  connection: ToolBoxAPI.DataverseConnection | null;
  dvApi: DataverseAPI.API;
  getActiveConnection: () => Promise<ToolBoxAPI.DataverseConnection | null>;
  onLog: (message: string, type?: "info" | "success" | "warning" | "error") => void;
}

export interface WebResourceRename {
  id: string;
  oldName: string;
  oldDisplayName: string;
  newName: string;
}

const encodeBase64 = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

const escapeXmlAttribute = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export class dvService {
  connection: ToolBoxAPI.DataverseConnection | null;
  dvApi: DataverseAPI.API;
  getActiveConnection: () => Promise<ToolBoxAPI.DataverseConnection | null>;
  onLog: (message: string, type?: "info" | "success" | "warning" | "error") => void;
  batchSize = 2;
  constructor(props: dvServiceProps) {
    this.connection = props.connection;
    this.dvApi = props.dvApi;
    this.getActiveConnection = props.getActiveConnection;
    this.onLog = props.onLog;
  }

  private async assertActiveConnection(): Promise<void> {
    if (!this.connection) {
      throw new Error("No connection available");
    }

    const activeConnection = await this.getActiveConnection();
    const normalizeUrl = (url: string) => url.replace(/\/+$/, "").toLowerCase();
    if (
      !activeConnection ||
      activeConnection.id !== this.connection.id ||
      normalizeUrl(activeConnection.url) !== normalizeUrl(this.connection.url) ||
      activeConnection.environment !== this.connection.environment
    ) {
      throw new Error("The active Dataverse connection changed. Review the target and try again.");
    }
  }

  private async getWritableResource(
    webResourceId: string,
    expectedName?: string,
  ): Promise<Record<string, unknown>> {
    await this.assertActiveConnection();
    const resource = await this.dvApi.retrieve("webresource", webResourceId, [
      "webresourceid",
      "name",
      "displayname",
      "iscustomizable",
    ]);

    const customizableField = resource.iscustomizable as { Value?: boolean } | boolean | undefined;
    const isCustomizable =
      typeof customizableField === "boolean" ? customizableField : customizableField?.Value;
    if (isCustomizable !== true) {
      throw new Error(`Web resource ${webResourceId} no longer exists or is not customizable.`);
    }

    if (expectedName && resource.name !== expectedName) {
      throw new Error(
        `Web resource ${webResourceId} changed since it was reviewed. Refresh the resource and review the change again.`,
      );
    }
    return resource;
  }

  async getSolutions(managed: boolean): Promise<SolutionMeta[]> {
    this.onLog("Fetching solutions...", "info");
    if (!this.connection) {
      throw new Error("No connection available");
    }

    const solutionsData = await this.dvApi.queryData(
      "solutions?$filter=(isvisible eq true) and ismanaged eq " +
        (managed ? "true" : "false") +
        " and (friendlyname ne 'Default' and friendlyname ne 'Common Data Service Default Solution') &$select=friendlyname,uniquename,ismanaged&$orderby=createdon desc",
    );
    const solutions: SolutionMeta[] = (solutionsData.value as any[]).map((sol: any) => {
      return new SolutionMeta(sol.friendlyname, sol.uniquename, sol.solutionid, sol.ismanaged);
    });

    return solutions;
  }

  async getWebResources(
    solutionId: string,
    typeFilters: number[],
    prefixes: string[] = [],
    loadManaged: boolean = false,
    showHidden: boolean = false,
    pagingCookie?: string,
  ): Promise<WebResourcesResult> {
    this.onLog("Fetching web resources...", "info");
    if (!this.connection) {
      throw new Error("No connection available");
    }

    try {
      // Decode and prepare the paging cookie if provided
      let decodedPagingCookie = "";
      let pageNumber = 1;

      if (pagingCookie) {
        try {
          // The pagingCookie parameter is an XML element string like:
          // <cookie pagenumber="2" pagingcookie="..."/>
          // Extract the pagingcookie attribute value
          const pagingCookieMatch = pagingCookie.match(/pagingcookie=["']([^"']+)["']/);
          if (pagingCookieMatch && pagingCookieMatch[1]) {
            let cookieValue = pagingCookieMatch[1];
            // URL decode twice as per Microsoft documentation
            cookieValue = decodeURIComponent(decodeURIComponent(cookieValue));
            // XML encode the decoded value
            decodedPagingCookie = this.escapePagingCookie(cookieValue);
          }

          // Extract page number from the cookie element
          const pageNumberMatch = pagingCookie.match(/pagenumber=["']?(\d+)["']?/);
          if (pageNumberMatch && pageNumberMatch[1]) {
            pageNumber = parseInt(pageNumberMatch[1], 10);
          }
        } catch (err) {
          this.onLog(`Error processing paging cookie: ${err}`, "warning");
        }
      }

      const typeFilterXml = typeFilters.length
        ? [
            "    <filter>",
            "      <condition attribute='webresourcetype' operator='in'>",
            ...typeFilters.map((type) => `        <value>${type}</value>`),
            "      </condition>",
            "    </filter>",
          ].join("\n")
        : "";

      const prefixFilterXml = prefixes.length
        ? [
            "    <filter type='and'>",
            ...prefixes.map(
              (p) =>
                `      <condition attribute='name' operator='not-like' value='${escapeXmlAttribute(p)}%'/>`,
            ),
            "    </filter>",
          ].join("\n")
        : "";

      const managedFilterXml = !loadManaged
        ? "    <filter>\n      <condition attribute='ismanaged' operator='eq' value='0'/>\n    </filter>"
        : "";

      const hiddenFilterXml = !showHidden
        ? "    <filter>\n      <condition attribute='ishidden' operator='eq' value='0'/>\n    </filter>"
        : "";

      const fetchXml = [
        `<fetch page='${pageNumber}' count='500'`,
        decodedPagingCookie ? ` paging-cookie='${decodedPagingCookie}'` : "",
        ">",
        "  <entity name='webresource'>",
        "    <attribute name='displayname' />",
        "    <attribute name='name' />",
        "    <attribute name='webresourceid' />",
        "    <attribute name='webresourcetype' />",
        "    <attribute name='iscustomizable' />",
        typeFilterXml,
        prefixFilterXml,
        managedFilterXml,
        hiddenFilterXml,
        "    <link-entity name='solutioncomponent' from='objectid' to='webresourceid' link-type='inner' alias='sc'>",
        "      <filter>",
        "        <condition attribute='solutionid' operator='eq' value='",
        escapeXmlAttribute(solutionId),
        "'/>",
        "      </filter>",
        "    </link-entity>",
        "    <order attribute='name' />",
        "  </entity>",
        "</fetch>",
      ].join("");

      const webResourcesData = await this.dvApi.fetchXmlQuery(fetchXml);

      const webResources: WebResource[] = (webResourcesData.value as any[]).map((wr: any) => {
        const isCustomizable = wr.iscustomizable?.Value !== false;
        return new WebResource(
          wr.webresourceid,
          wr.name,
          wr.displayname || wr.name,
          typeof wr.webresourcetype === "number" ? wr.webresourcetype : parseInt(wr.webresourcetype, 10),
          wr.name,
          isCustomizable,
        );
      });

      // Check for paging cookie in response
      const pagingCookieFromResponse = webResourcesData["@Microsoft.Dynamics.CRM.fetchxmlpagingcookie"];
      if (pagingCookieFromResponse) {
        this.onLog(
          `Loaded page ${pageNumber} with ${webResources.length} web resources. Additional pages available.`,
          "info",
        );
      }

      this.onLog(`Loaded ${webResources.length} web resources`, "success");
      return {
        resources: webResources,
        pagingCookie: pagingCookieFromResponse,
      };
    } catch (err) {
      this.onLog(`Error loading web resources: ${err}`, "error");
      throw err;
    }
  }

  async getWebResourceContent(webResourceId: string): Promise<string | null> {
    this.onLog("Fetching web resource content...", "info");
    if (!this.connection) {
      throw new Error("No connection available");
    }
    const data = await this.dvApi.queryData(
      `webresourceset(${webResourceId})/Microsoft.Dynamics.CRM.RetrieveUnpublished()?$select=content`,
    );
    const content = (data as any)?.content ?? (data as any)?.value?.[0]?.content ?? null;
    if (!content) {
      this.onLog("No web resource content returned", "warning");
      return null;
    }
    this.onLog("Loaded web resource content", "success");
    return content as string;
  }

  async saveWebResourceContent(
    webResourceId: string,
    content: string,
    expectedName: string,
    contentIsBase64 = false,
  ): Promise<void> {
    try {
      await this.getWritableResource(webResourceId, expectedName);
      await this.assertActiveConnection();

      await this.dvApi.update("webresource", webResourceId, {
        content: contentIsBase64 ? content : encodeBase64(content),
      });

      this.onLog("Web resource saved successfully", "success");
    } catch (err) {
      this.onLog(`Error saving web resource: ${err}`, "error");
      throw err;
    }
  }

  async renameWebResources(changes: WebResourceRename[], signal?: AbortSignal): Promise<void> {
    if (changes.length === 0) return;

    const completed: WebResourceRename[] = [];
    let uncertainChange: string | null = null;
    try {
      for (const change of changes) {
        if (signal?.aborted) {
          throw new Error("Rename cancelled before the next resource was changed.");
        }
        await this.getWritableResource(change.id, change.oldName);
        await this.assertActiveConnection();
        if (signal?.aborted) {
          throw new Error("Rename cancelled before the next resource was changed.");
        }
        try {
          await this.dvApi.update("webresource", change.id, {
            name: change.newName,
            displayname: change.newName,
          });
        } catch (error) {
          try {
            const current = await this.getWritableResource(change.id);
            if (current.name === change.newName) {
              completed.push(change);
            } else if (current.name !== change.oldName) {
              uncertainChange = `${change.oldName}: current name is ${String(current.name)}`;
            }
          } catch (validationError) {
            uncertainChange = `${change.oldName}: current state could not be verified (${validationError})`;
          }
          throw error;
        }
        completed.push(change);
      }
      this.onLog(`Renamed ${changes.length} web resource${changes.length === 1 ? "" : "s"}`, "success");
    } catch (error) {
      if (completed.length === 0 && !uncertainChange) {
        if (signal?.aborted) {
          const message = "Rename cancelled before any resource changes were applied.";
          this.onLog(message, "warning");
          throw new Error(message, { cause: error });
        }
        this.onLog(`Rename failed: ${error}`, "error");
        throw error;
      }

      const completedCount = completed.length;
      const rollbackFailures: string[] = uncertainChange ? [uncertainChange] : [];
      for (const change of completed.reverse()) {
        try {
          const current = await this.getWritableResource(change.id, change.newName);
          await this.assertActiveConnection();
          await this.dvApi.update("webresource", change.id, {
            name: change.oldName,
            displayname: change.oldDisplayName || String(current.displayname ?? change.oldName),
          });
        } catch (rollbackError) {
          rollbackFailures.push(`${change.oldName}: ${rollbackError}`);
        }
      }

      const action = signal?.aborted ? "Rename cancelled" : "Rename failed";
      const message =
        rollbackFailures.length > 0
          ? `${action} after ${completedCount} of ${changes.length} resources. Rollback was incomplete for: ${rollbackFailures.join("; ")}`
          : `${action}. ${completedCount} completed change${completedCount === 1 ? " was" : "s were"} rolled back.`;
      this.onLog(message, rollbackFailures.length > 0 ? "error" : signal?.aborted ? "warning" : "error");
      throw new Error(message, { cause: error });
    }
  }

  async publishWebResource(webResourceId: string, expectedName: string): Promise<void> {
    this.onLog("Publishing web resource...", "info");

    try {
      await this.getWritableResource(webResourceId, expectedName);
      await this.assertActiveConnection();
      const publishXml = `<importexportxml><webresources><webresource>{${webResourceId}}</webresource></webresources></importexportxml>`;
      await this.dvApi.execute({
        operationName: "PublishXml",
        operationType: "action",
        parameters: { ParameterXml: publishXml },
      });
      this.onLog("Web resource published successfully", "success");
    } catch (err) {
      this.onLog(`Error publishing web resource: ${err}`, "error");
      throw err;
    }
  }

  async createWebResource(
    name: string,
    displayName: string,
    type: number,
    solutionId: string,
    solutionUniqueName: string,
  ): Promise<string> {
    let createdResourceId: string | null = null;
    try {
      await this.assertActiveConnection();
      const solution = await this.dvApi.retrieve("solution", solutionId, [
        "solutionid",
        "uniquename",
        "ismanaged",
      ]);
      if (solution.uniquename !== solutionUniqueName || solution.ismanaged !== false) {
        throw new Error("The selected solution changed or is not an unmanaged solution.");
      }
      await this.assertActiveConnection();
      const result = await this.dvApi.create("webresource", {
        name,
        displayname: displayName,
        webresourcetype: type,
        content: btoa(" "),
      });
      const id = (result as any)?.id ?? result;
      if (typeof id !== "string" || !id) {
        throw new Error("Dataverse did not return an ID for the created web resource.");
      }
      createdResourceId = id;

      await this.assertActiveConnection();
      const currentSolution = await this.dvApi.retrieve("solution", solutionId, [
        "solutionid",
        "uniquename",
        "ismanaged",
      ]);
      if (currentSolution.uniquename !== solutionUniqueName || currentSolution.ismanaged !== false) {
        throw new Error("The selected solution changed before the resource could be added.");
      }
      await this.assertActiveConnection();
      // Add the new resource to the solution
      await this.dvApi.execute({
        operationName: "AddSolutionComponent",
        operationType: "action",
        parameters: {
          ComponentId: id,
          ComponentType: 61, // Web Resource
          SolutionUniqueName: solutionUniqueName,
          AddRequiredComponents: false,
        },
      });

      this.onLog(`Created web resource: ${name}`, "success");
      return id;
    } catch (err) {
      if (createdResourceId) {
        try {
          await this.assertActiveConnection();
          await this.dvApi.delete("webresource", createdResourceId);
        } catch (rollbackError) {
          const message = `Failed to add ${name} to the solution, and automatic cleanup failed for created resource ${createdResourceId}: ${rollbackError}`;
          this.onLog(message, "error");
          throw new Error(message, { cause: err });
        }
      }
      this.onLog(`Error creating web resource: ${err}`, "error");
      throw err;
    }
  }

  private escapePagingCookie(cookie: string): string {
    return cookie
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}
