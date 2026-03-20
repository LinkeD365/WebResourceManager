import { makeAutoObservable } from "mobx";

export class SolutionMeta {
  name: string;
  uniqueName: string;
  id: string;
  managed: boolean = false;

  constructor(name: string, uniqueName: string, id: string, managed: boolean) {
    this.name = name;
    this.uniqueName = uniqueName;
    this.id = id;
    this.managed = managed;
    makeAutoObservable(this);
  }
}

export class WebResource {
  id: string;
  name: string;
  displayName: string;
  type: number;
  path: string;
  isCustomizable: boolean;
  stringContent: string | null = null;
  originalContent: string | null = null;
  isSavedNotPublished: boolean = false;
  isSaving: boolean = false;
  refreshTrigger: number = 0;

  constructor(
    id: string,
    name: string,
    displayName: string,
    type: number,
    path: string,
    isCustomizable: boolean = true,
  ) {
    this.id = id;
    this.name = name;
    this.displayName = displayName;
    this.type = type;
    this.path = path;
    this.isCustomizable = isCustomizable;
    makeAutoObservable(this);
  }

  get isDirty(): boolean {
    return this.originalContent !== null && this.stringContent !== this.originalContent;
  }

  get fileName(): string {
    const parts = this.name.split("/");
    return parts[parts.length - 1];
  }

  markClean() {
    this.originalContent = this.stringContent;
    this.isSavedNotPublished = true;
  }

  markPublished() {
    this.isSavedNotPublished = false;
  }

  triggerRefresh() {
    this.stringContent = null;
    this.originalContent = null;
    this.isSavedNotPublished = false;
    this.refreshTrigger++;
  }

  rename(newName: string) {
    this.name = newName;
    this.displayName = newName;
    const parts = newName.split("/");
    this.path = parts.slice(1).join("/") || newName;
  }
}

export interface TreeNode {
  value: string;
  label: string;
  children?: TreeNode[];
  webResource?: WebResource;
  isLeaf?: boolean;
}

export class ViewModel {
  solutions: SolutionMeta[] = [];
  selectedSolution: SolutionMeta | null = null;
  selectedResource: WebResource | null = null;
  webResources: WebResource[] = [];
  webResourceTree: TreeNode[] = [];
  expandedNodes: Set<string> = new Set();
  loadingWebResources: boolean = false;
  resourceTypeFilter: Set<number> = new Set([1, 2, 3, 4, 5, 6, 7, 9, 11, 12]); // All types by default
  searchFilter: string = "";
  prefixFilter: string = "msdyn_,adx_,cc_MscrmControls";
  loadManaged: boolean = true;
  showHidden: boolean = false;
  resxAddRowTrigger: number = 0;
  resxSearchFilter: string = "";
  openTabs: WebResource[] = [];
  activeTabId: string | null = null;
  virtualFolders: Set<string> = new Set();

  constructor() {
    makeAutoObservable(this);
  }

  setSolutions(solutions: SolutionMeta[]) {
    this.solutions = solutions;
  }

  setWebResources(resources: WebResource[]) {
    this.webResources = resources;
    this.buildWebResourceTree();
  }

  buildWebResourceTree() {
    const root: Map<string, TreeNode> = new Map();

    // Sort resources by path and filter by type
    const sortedResources = [...this.getFilteredWebResources()].sort((a, b) => a.path.localeCompare(b.path));
    console.log("Building web resource tree from", sortedResources.length, "resources");

    sortedResources.forEach((resource) => {
      const pathParts = resource.path.split("/");
      let currentPath = "";
      let currentLevel = root;

      pathParts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isLastPart = index === pathParts.length - 1;

        if (!currentLevel.has(part)) {
          const newNode: TreeNode = {
            value: currentPath,
            label: part,
            children: [],
          };
          currentLevel.set(part, newNode);
        }

        const node = currentLevel.get(part)!;

        // If this is the last part, it's a web resource (leaf)
        if (isLastPart) {
          node.webResource = resource;
          node.isLeaf = true;
        } else {
          // For non-leaf nodes, ensure children array exists
          if (!node.children) {
            node.children = [];
          }
          // Create/get the map for the next level
          // We need to maintain a Map for each node's children
          if (!(node as any).childrenMap) {
            (node as any).childrenMap = new Map<string, TreeNode>();
          }
          currentLevel = (node as any).childrenMap;
        }
      });
    });

    // Ensure virtual folders exist in the tree
    this.virtualFolders.forEach((folderPath) => {
      const pathParts = folderPath.split("/");
      let currentPath = "";
      let currentLevel = root;

      pathParts.forEach((part) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (!currentLevel.has(part)) {
          const newNode: TreeNode = {
            value: currentPath,
            label: part,
            children: [],
          };
          currentLevel.set(part, newNode);
        }

        const node = currentLevel.get(part)!;
        if (!node.children) {
          node.children = [];
        }
        if (!(node as any).childrenMap) {
          (node as any).childrenMap = new Map<string, TreeNode>();
        }
        currentLevel = (node as any).childrenMap;
      });
    });

    // Convert root map to array and populate children arrays
    const populateChildren = (parentMap: Map<string, TreeNode>): TreeNode[] => {
      const nodes: TreeNode[] = [];
      parentMap.forEach((node) => {
        if ((node as any).childrenMap) {
          node.children = populateChildren((node as any).childrenMap);
          delete (node as any).childrenMap;
        }
        nodes.push(node);
      });
      // Sort: folders first, then files, both alphabetically
      nodes.sort((a, b) => {
        const aIsFolder = !a.isLeaf;
        const bIsFolder = !b.isLeaf;
        if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
        return a.label.localeCompare(b.label);
      });
      return nodes;
    };

    this.webResourceTree = populateChildren(root);
    console.log("Web resource tree built with", this.webResourceTree.length, "root nodes");
  }

  toggleNodeExpanded(value: string) {
    if (this.expandedNodes.has(value)) {
      this.expandedNodes.delete(value);
    } else {
      this.expandedNodes.add(value);
    }
  }

  setSelectedResource(resource: WebResource | null) {
    this.selectedResource = resource;
  }

  openTab(resource: WebResource) {
    // Check if tab is already open
    const existingTab = this.openTabs.find((tab) => tab.id === resource.id);
    if (existingTab) {
      this.activeTabId = resource.id;
      this.selectedResource = resource;
      return;
    }
    // Add to tabs and set as active
    this.openTabs.push(resource);
    this.activeTabId = resource.id;
    this.selectedResource = resource;
  }

  closeTab(resourceId: string) {
    const tabIndex = this.openTabs.findIndex((tab) => tab.id === resourceId);
    if (tabIndex === -1) return;

    this.openTabs.splice(tabIndex, 1);

    // If closing the active tab, switch to another tab
    if (this.activeTabId === resourceId) {
      if (this.openTabs.length > 0) {
        // Switch to the previous tab, or the first tab if we closed the first one
        const newIndex = Math.max(0, tabIndex - 1);
        this.activeTabId = this.openTabs[newIndex].id;
        this.selectedResource = this.openTabs[newIndex];
      } else {
        this.activeTabId = null;
        this.selectedResource = null;
      }
    }
  }

  setActiveTab(resourceId: string) {
    const tab = this.openTabs.find((tab) => tab.id === resourceId);
    if (tab) {
      this.activeTabId = resourceId;
      this.selectedResource = tab;
    }
  }

  toggleTypeFilter(type: number) {
    if (this.resourceTypeFilter.has(type)) {
      this.resourceTypeFilter.delete(type);
    } else {
      this.resourceTypeFilter.add(type);
    }
  }

  isTypeFilteredIn(type: number): boolean {
    return this.resourceTypeFilter.has(type);
  }

  setSearchFilter(value: string) {
    this.searchFilter = value;
    this.buildWebResourceTree();
  }

  setPrefixFilter(value: string) {
    this.prefixFilter = value;
  }

  setLoadManaged(value: boolean) {
    this.loadManaged = value;
  }

  setShowHidden(value: boolean) {
    this.showHidden = value;
  }

  triggerResxAddRow() {
    this.resxAddRowTrigger++;
  }

  setResxSearchFilter(value: string) {
    this.resxSearchFilter = value;
  }

  addWebResource(resource: WebResource) {
    this.webResources.push(resource);
    this.buildWebResourceTree();
    this.openTab(resource);
  }

  addVirtualFolder(path: string) {
    this.virtualFolders.add(path);
    this.buildWebResourceTree();
  }

  getPrefixes(): string[] {
    return this.prefixFilter
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  getFilteredWebResources(): WebResource[] {
    const search = this.searchFilter.toLowerCase();
    return this.webResources.filter((wr) => {
      if (!this.resourceTypeFilter.has(wr.type)) return false;
      if (
        search &&
        !wr.name.toLowerCase().includes(search) &&
        !wr.displayName.toLowerCase().includes(search) &&
        !wr.path.toLowerCase().includes(search)
      )
        return false;
      return true;
    });
  }
}
