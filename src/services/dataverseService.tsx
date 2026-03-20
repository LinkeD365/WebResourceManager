import { SolutionMeta, WebResource } from "../model/viewModel";

export interface WebResourcesResult {
  resources: WebResource[];
  pagingCookie?: string;
}

interface dvServiceProps {
  connection: ToolBoxAPI.DataverseConnection | null;
  dvApi: DataverseAPI.API;
  onLog: (message: string, type?: "info" | "success" | "warning" | "error") => void;
}
export class dvService {
  connection: ToolBoxAPI.DataverseConnection | null;
  dvApi: DataverseAPI.API;
  onLog: (message: string, type?: "info" | "success" | "warning" | "error") => void;
  batchSize = 2;
  constructor(props: dvServiceProps) {
    this.connection = props.connection;
    this.dvApi = props.dvApi;
    this.onLog = props.onLog;
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
          console.log("Error processing paging cookie:", err);
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
            ...prefixes.map((p) => `      <condition attribute='name' operator='not-like' value='${p}%'/>`),
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
        solutionId,
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
    console.log(
      "Fetching content for web resource",
      `webresourceset(${webResourceId})/Microsoft.Dynamics.CRM.RetrieveUnpublished()?$select=content`,
    );
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

  async saveWebResourceContent(webResourceId: string, content: string): Promise<void> {
    if (!this.connection) {
      throw new Error("No connection available");
    }

    try {
      // Encode the string content to base64
      const encoder = new TextEncoder();
      const bytes = encoder.encode(content);
      const base64Content = btoa(String.fromCharCode(...bytes));

      await this.dvApi.update("webresource", webResourceId, {
        content: base64Content,
      });

      this.onLog("Web resource saved successfully", "success");
    } catch (err) {
      this.onLog(`Error saving web resource: ${err}`, "error");
      throw err;
    }
  }

  async renameWebResource(webResourceId: string, newName: string, newDisplayName: string): Promise<void> {
    if (!this.connection) {
      throw new Error("No connection available");
    }

    try {
      await this.dvApi.update("webresource", webResourceId, {
        name: newName,
        displayname: newDisplayName,
      });
      this.onLog("Web resource renamed successfully", "success");
    } catch (err) {
      this.onLog(`Error renaming web resource: ${err}`, "error");
      throw err;
    }
  }

  async publishWebResource(webResourceId: string): Promise<void> {
    this.onLog("Publishing web resource...", "info");
    if (!this.connection) {
      throw new Error("No connection available");
    }

    try {
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
    solutionUniqueName: string,
  ): Promise<string> {
    if (!this.connection) {
      throw new Error("No connection available");
    }

    try {
      const result = await this.dvApi.create("webresource", {
        name,
        displayname: displayName,
        webresourcetype: type,
        content: btoa(" "),
      });
      const id = (result as any)?.id ?? result;

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
      this.onLog(`Error creating web resource: ${err}`, "error");
      throw err;
    }
  }

  async deleteRelationship() {
    this.dvApi.delete("relationshipdefinition", "c8273702-1614-f111-8341-6045bd0a6647");
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
