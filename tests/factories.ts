import { vi } from "vitest";
import { ViewModel, WebResource } from "../src/model/viewModel";
import type { dvService } from "../src/services/dataverseService";
import type { WriteReviewTarget } from "../src/components/WriteConfirmationDialog";

export const testConnection: ToolBoxAPI.DataverseConnection = {
  id: "connection-1",
  name: "Development",
  url: "https://example.crm.dynamics.com",
  environment: "Dev",
};

export const testTarget: WriteReviewTarget = {
  id: testConnection.id,
  name: testConnection.name,
  url: testConnection.url,
  environment: testConnection.environment,
};

export const createResource = (
  id = "resource-1",
  name = "sample.js",
  type = 3,
  content: string | null = "original",
): WebResource => {
  const resource = new WebResource(id, name, name, type, name, true);
  resource.stringContent = content;
  resource.originalContent = content;
  return resource;
};

export const createViewModel = () => {
  const vm = new ViewModel();
  vm.selectedSolution = {
    name: "Customizations",
    uniqueName: "customizations",
    id: "solution-1",
    managed: false,
  } as ViewModel["selectedSolution"];
  return vm;
};

export const createDvService = (overrides: Partial<dvService> = {}) =>
  ({
    connection: testConnection,
    getSolutions: vi.fn().mockResolvedValue([]),
    getWebResources: vi.fn().mockResolvedValue({ resources: [] }),
    getWebResourceContent: vi.fn().mockResolvedValue(null),
    saveWebResourceContent: vi.fn().mockResolvedValue(undefined),
    publishWebResource: vi.fn().mockResolvedValue(undefined),
    createWebResource: vi.fn().mockResolvedValue("created-resource"),
    renameWebResources: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as dvService;

export const installToolboxApi = (
  overrides: Partial<ToolBoxAPI.API> = {},
): ToolBoxAPI.API => {
  const toolboxAPI = {
    fileSystem: {
      selectPath: vi.fn().mockResolvedValue(null),
      readText: vi.fn().mockResolvedValue(""),
      readBinary: vi.fn().mockResolvedValue(new Uint8Array()),
      saveFile: vi.fn().mockResolvedValue("/tmp/backup.js"),
    },
    utils: {
      showNotification: vi.fn().mockResolvedValue(undefined),
      getCurrentTheme: vi.fn().mockResolvedValue("light"),
    },
    connections: {
      getActiveConnection: vi.fn().mockResolvedValue(testConnection),
    },
    events: {
      on: vi.fn(),
    },
    ...overrides,
  } as unknown as ToolBoxAPI.API;
  Object.defineProperty(window, "toolboxAPI", { configurable: true, value: toolboxAPI });
  return toolboxAPI;
};
