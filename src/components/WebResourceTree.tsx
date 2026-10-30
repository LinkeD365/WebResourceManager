import React, { useEffect, useState, useCallback, useRef } from "react";
import { observer } from "mobx-react";
import { ViewModel, TreeNode, WebResource } from "../model/viewModel";
import { Button, Spinner, tokens } from "@fluentui/react-components";
import {
  FolderRegular,
  FolderAddRegular,
  CodeRegular,
  ChevronRightRegular,
  ChevronDownRegular,
  DrawImageRegular,
  ImageRegular,
} from "@fluentui/react-icons";
import { dvService } from "../services/dataverseService";
import { NewResourceDialog } from "./NewResourceDialog";
import { ContextMenu } from "./ContextMenu";
import { isSameWriteTarget, WriteConfirmationDialog } from "./WriteConfirmationDialog";
import type { WriteReviewTarget } from "./WriteConfirmationDialog";
import type { WebResourceRename } from "../services/dataverseService";

const MAX_RESOURCE_PAGES = 100;

interface PendingRename {
  kind: "resource" | "folder";
  changes: WebResourceRename[];
  target: WriteReviewTarget;
  summary: string[];
  oldFolderPath?: string;
  newFolderPath?: string;
}

const getIconForResourceType = (type: number): React.ReactNode => {
  switch (type) {
    case 3: // JavaScript
      return <CodeRegular />;
    case 11: // SVG
      return <DrawImageRegular />;
    case 5: // PNG
    case 6: // JPEG
    case 7: // GIF
      return <ImageRegular />;
    default:
      return <CodeRegular />;
  }
};

interface WebResourceTreeProps {
  vm: ViewModel;
  dvSvc: dvService | null;
  onLog: (message: string, type?: "info" | "success" | "warning" | "error") => void;
}

export const WebResourceTree = observer((props: WebResourceTreeProps): React.JSX.Element => {
  const { vm, dvSvc, onLog } = props;

  const [newResDialogOpen, setNewResDialogOpen] = useState(false);
  const [newResFolder, setNewResFolder] = useState("");
  const [contextTarget, setContextTarget] = useState<{ x: number; y: number } | null>(null);
  const [contextFolder, setContextFolder] = useState<string>("");
  const [contextNode, setContextNode] = useState<{ isFolder: boolean; resource?: WebResource } | null>(null);
  const [newSubfolderParent, setNewSubfolderParent] = useState<string | null>(null);
  const [newSubfolderName, setNewSubfolderName] = useState<string>("");
  const [renamingResource, setRenamingResource] = useState<WebResource | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState<string>("");
  const [pendingRename, setPendingRename] = useState<PendingRename | null>(null);
  const [renaming, setRenaming] = useState(false);
  const renameAbortControllerRef = useRef<AbortController | null>(null);

  const typeFilterKey = Array.from(vm.resourceTypeFilter)
    .sort((a, b) => a - b)
    .join(",");

  const prefixFilterKey = vm.prefixFilter;
  const loadManagedKey = vm.loadManaged;
  const showHiddenKey = vm.showHidden;

  const loadWebResources = async (
    solutionId: string,
    typeFilters: number[],
    pagingCookie?: string,
    existingResources: WebResource[] = [],
    pagesLoaded = 0,
    seenPagingCookies = new Set<string>(),
  ) => {
    if (!dvSvc) return;

    if (pagesLoaded >= MAX_RESOURCE_PAGES) {
      vm.loadingWebResources = false;
      onLog(`Stopped loading after ${MAX_RESOURCE_PAGES} pages. Refine the filters to load fewer resources.`, "warning");
      return;
    }

    try {
      const prefixes = vm.getPrefixes();
      const result = await dvSvc.getWebResources(
        solutionId,
        typeFilters,
        prefixes,
        vm.loadManaged,
        vm.showHidden,
        pagingCookie,
      );
      const resourcesById = new Map(existingResources.map((resource) => [resource.id, resource]));
      for (const resource of result.resources) {
        if (!resourcesById.has(resource.id)) resourcesById.set(resource.id, resource);
      }
      const allResources = [...resourcesById.values()];

      // Update the tree immediately with resources loaded so far
      vm.setWebResources(allResources);
      onLog(`Loaded ${result.resources.length} web resources (total: ${allResources.length})`, "info");

      // If there's a paging cookie, fetch the next page
      if (result.pagingCookie) {
        if (seenPagingCookies.has(result.pagingCookie)) {
          vm.loadingWebResources = false;
          onLog("Stopped loading because Dataverse repeated a paging cookie.", "error");
          return;
        }
        const nextSeenPagingCookies = new Set(seenPagingCookies);
        nextSeenPagingCookies.add(result.pagingCookie);
        if (pagesLoaded + 1 >= MAX_RESOURCE_PAGES) {
          vm.loadingWebResources = false;
          onLog(
            `Stopped loading after ${MAX_RESOURCE_PAGES} pages. Refine the filters to load fewer resources.`,
            "warning",
          );
          return;
        }
        onLog(`Fetching more web resources...`, "info");
        vm.loadingWebResources = false;
        await loadWebResources(
          solutionId,
          typeFilters,
          result.pagingCookie,
          allResources,
          pagesLoaded + 1,
          nextSeenPagingCookies,
        );
      } else {
        // All pages loaded
        onLog(`Loaded all ${allResources.length} web resources`, "success");
        vm.loadingWebResources = false;
      }
    } catch (err) {
      onLog(`Error loading web resources: ${err}`, "error");
      vm.loadingWebResources = false;
    }
  };

  useEffect(() => {
    const fetchWebResources = async () => {
      if (vm.selectedSolution) {
        const typeFilters = Array.from(vm.resourceTypeFilter);
        if (typeFilters.length === 0) {
          vm.setWebResources([]);
          return;
        }
        await loadWebResources(vm.selectedSolution.id, typeFilters);
      }
    };
    fetchWebResources();
  }, [vm.selectedSolution, vm, dvSvc, onLog, typeFilterKey, prefixFilterKey, loadManagedKey, showHiddenKey]);

  const handleTreeToggle = (nodeValue: string) => {
    vm.toggleNodeExpanded(nodeValue);
  };

  const handleFolderContextMenu = useCallback((e: React.MouseEvent, folderPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextTarget({ x: e.clientX, y: e.clientY });
    setContextFolder(folderPath);
    setContextNode({ isFolder: true });
  }, []);

  const handleResourceContextMenu = useCallback((e: React.MouseEvent, resource: WebResource) => {
    e.preventDefault();
    e.stopPropagation();
    setContextTarget({ x: e.clientX, y: e.clientY });
    setContextNode({ isFolder: false, resource });
  }, []);

  const handleOpenNewResourceDialog = useCallback(() => {
    setNewResFolder(contextFolder);
    setContextTarget(null);
    setContextNode(null);
    setNewResDialogOpen(true);
  }, [contextFolder]);

  const handleRootContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setContextTarget({ x: e.clientX, y: e.clientY });
    setContextFolder("");
    setContextNode({ isFolder: true });
  }, []);

  const handleStartNewSubfolder = useCallback(() => {
    setNewSubfolderParent(contextFolder);
    setNewSubfolderName("");
    setContextTarget(null);
    // Ensure the parent folder is expanded so the input is visible (skip for root)
    if (contextFolder && !vm.expandedNodes.has(contextFolder)) {
      vm.toggleNodeExpanded(contextFolder);
    }
  }, [contextFolder, vm]);

  const handleConfirmSubfolder = useCallback(() => {
    const name = newSubfolderName.trim();
    if (name && newSubfolderParent !== null) {
      const fullPath = newSubfolderParent ? `${newSubfolderParent}/${name}` : name;
      vm.addVirtualFolder(fullPath);
      if (!vm.expandedNodes.has(fullPath)) {
        vm.toggleNodeExpanded(fullPath);
      }
    }
    setNewSubfolderParent(null);
    setNewSubfolderName("");
  }, [newSubfolderName, newSubfolderParent, vm]);

  const handleStartRename = useCallback(() => {
    if (contextNode?.isFolder) {
      setRenamingFolder(contextFolder);
      const parts = contextFolder.split("/");
      setRenameFolderValue(parts[parts.length - 1]);
    } else if (contextNode?.resource) {
      setRenamingResource(contextNode.resource);
      setRenameValue(contextNode.resource.name);
    }
    setContextTarget(null);
  }, [contextNode, contextFolder]);

  const handleRefreshResource = useCallback(() => {
    if (contextNode?.resource) {
      contextNode.resource.triggerRefresh();
      onLog(`Refreshing ${contextNode.resource.fileName}...`, "info");
    }
    setContextTarget(null);
    setContextNode(null);
  }, [contextNode, onLog]);

  const handleConfirmRename = useCallback(() => {
    if (!renamingResource || !dvSvc) return;
    const newName = renameValue.trim();
    if (!newName || newName === renamingResource.name) {
      setRenamingResource(null);
      setRenameValue("");
      return;
    }
    const connection = dvSvc.connection;
    if (!connection) {
      onLog("No active connection is available to rename this resource.", "error");
      return;
    }
    setPendingRename({
      kind: "resource",
      changes: [
        {
          id: renamingResource.id,
          oldName: renamingResource.name,
          oldDisplayName: renamingResource.displayName,
          newName,
        },
      ],
      target: {
        id: connection.id,
        name: connection.name,
        url: connection.url,
        environment: connection.environment,
      },
      summary: [`Rename ${renamingResource.name} to ${newName}`],
    });
    setRenamingResource(null);
    setRenameValue("");
  }, [renamingResource, renameValue, dvSvc, onLog]);

  const handleConfirmFolderRename = useCallback(() => {
    if (!renamingFolder || !dvSvc) return;
    const newLabel = renameFolderValue.trim();
    if (!newLabel) {
      setRenamingFolder(null);
      setRenameFolderValue("");
      return;
    }
    const parts = renamingFolder.split("/");
    const oldLabel = parts[parts.length - 1];
    if (newLabel === oldLabel) {
      setRenamingFolder(null);
      setRenameFolderValue("");
      return;
    }
    parts[parts.length - 1] = newLabel;
    const newFolderPath = parts.join("/");
    const oldPrefix = renamingFolder + "/";
    const newPrefix = newFolderPath + "/";

    // Find all resources under this folder
    const affected = vm.webResources.filter((wr) => wr.name === renamingFolder || wr.name.startsWith(oldPrefix));

    // Stage the rename plan so local state is only mutated after all remote calls succeed
    const renamePlan = affected.map((wr) => ({
      id: wr.id,
      oldName: wr.name,
      oldDisplayName: wr.displayName,
      newName: wr.name === renamingFolder ? newFolderPath : newPrefix + wr.name.slice(oldPrefix.length),
    }));

    if (renamePlan.length === 0) {
      renameVirtualFolders(renamingFolder, newFolderPath, oldPrefix, newPrefix);
      setRenamingFolder(null);
      setRenameFolderValue("");
      return;
    }

    const connection = dvSvc.connection;
    if (!connection) {
      onLog("No active connection is available to rename this folder.", "error");
      return;
    }

    const preview = renamePlan.slice(0, 10).map((change) => `${change.oldName} -> ${change.newName}`);
    if (renamePlan.length > preview.length) {
      preview.push(`and ${renamePlan.length - preview.length} more web resources`);
    }
    setPendingRename({
      kind: "folder",
      changes: renamePlan,
      target: {
        id: connection.id,
        name: connection.name,
        url: connection.url,
        environment: connection.environment,
      },
      summary: [
        `Rename folder ${renamingFolder} to ${newFolderPath}`,
        `${renamePlan.length} web resource${renamePlan.length === 1 ? "" : "s"} will be renamed`,
        ...preview,
      ],
      oldFolderPath: renamingFolder,
      newFolderPath,
    });
    setRenamingFolder(null);
    setRenameFolderValue("");
  }, [renamingFolder, renameFolderValue, dvSvc, vm, onLog]);

  const renameVirtualFolders = (oldPath: string, newPath: string, oldPrefix: string, newPrefix: string) => {
    const replacements: string[] = [];
    vm.virtualFolders.forEach((folder) => {
      if (folder === oldPath || folder.startsWith(oldPrefix)) {
        vm.virtualFolders.delete(folder);
        replacements.push(folder === oldPath ? newPath : newPrefix + folder.slice(oldPrefix.length));
      }
    });
    replacements.forEach((folder) => vm.virtualFolders.add(folder));
    vm.buildWebResourceTree();
  };

  const confirmPendingRename = useCallback(async () => {
    if (!pendingRename || !dvSvc) return;
    if (!isSameWriteTarget(dvSvc.connection, pendingRename.target)) {
      onLog("The active connection changed. Review the rename again before applying it.", "error");
      return;
    }

    const abortController = new AbortController();
    renameAbortControllerRef.current = abortController;
    setRenaming(true);
    try {
      await dvSvc.renameWebResources(pendingRename.changes, abortController.signal);
      for (const change of pendingRename.changes) {
        const resource = vm.webResources.find((item) => item.id === change.id);
        resource?.rename(change.newName);
      }
      if (pendingRename.oldFolderPath && pendingRename.newFolderPath) {
        const oldPrefix = `${pendingRename.oldFolderPath}/`;
        const newPrefix = `${pendingRename.newFolderPath}/`;
        renameVirtualFolders(
          pendingRename.oldFolderPath,
          pendingRename.newFolderPath,
          oldPrefix,
          newPrefix,
        );
      }
      vm.buildWebResourceTree();
      onLog(
        `Renamed ${pendingRename.kind === "folder" ? "folder" : "web resource"} successfully`,
        "success",
      );
      setPendingRename(null);
    } catch (error) {
      const cancelled = abortController.signal.aborted;
      onLog(`${cancelled ? "Rename cancelled" : "Failed to rename"}: ${error}`, cancelled ? "warning" : "error");
      try {
        const states = await dvSvc.getWebResourceNameStates(pendingRename.changes.map((change) => change.id));
        const statesById = new Map(states.map((state) => [state.id, state]));
        for (const resource of vm.webResources) {
          const state = statesById.get(resource.id);
          if (!state) continue;
          resource.name = state.name;
          resource.path = state.name;
          resource.displayName = state.displayName ?? state.name;
        }
        vm.buildWebResourceTree();
      } catch (reconcileError) {
        onLog(`Could not reconcile resource names after the rename failure: ${reconcileError}`, "error");
        await window.toolboxAPI.utils.showNotification({
          title: "Rename Reconciliation Failed",
          body: `The rename failed and the tree may not match Dataverse. Refresh the solution before trying again: ${reconcileError}`,
          type: "error",
        });
      }
      await window.toolboxAPI.utils.showNotification({
        title: cancelled ? "Rename Cancelled" : "Rename Failed",
        body: `${cancelled ? "Rename cancelled" : "Failed to rename"}: ${error}`,
        type: cancelled ? "warning" : "error",
      });
      setPendingRename(null);
    } finally {
      renameAbortControllerRef.current = null;
      setRenaming(false);
    }
  }, [pendingRename, dvSvc, onLog, vm]);

  // Returns "dirty" | "saved" | null for a tree node, propagating up from children
  const getNodeStatus = (node: TreeNode): "dirty" | "saved" | null => {
    if (node.isLeaf && node.webResource) {
      if (node.webResource.isDirty) return "dirty";
      if (node.webResource.isSavedNotPublished) return "saved";
      return null;
    }
    if (node.children) {
      let hasSaved = false;
      for (const child of node.children) {
        const status = getNodeStatus(child);
        if (status === "dirty") return "dirty";
        if (status === "saved") hasSaved = true;
      }
      if (hasSaved) return "saved";
    }
    return null;
  };

  const renderTreeNode = (node: TreeNode, depth: number = 0): React.JSX.Element => {
    const isExpanded = vm.expandedNodes.has(node.value);
    const hasChildren = node.children && node.children.length > 0;
    const icon = node.isLeaf && node.webResource ? getIconForResourceType(node.webResource.type) : <FolderRegular />;
    const chevron = hasChildren ? isExpanded ? <ChevronDownRegular /> : <ChevronRightRegular /> : null;
    const nodeStatus = getNodeStatus(node);

    const isFolder = !node.isLeaf;

    return (
      <div key={node.value}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "4px 0",
            cursor: "pointer",
            marginLeft: `${depth * 4}px`,

            backgroundColor:
              vm.selectedResource?.id === node.webResource?.id ? tokens.colorSubtleBackgroundSelected : "transparent",
            borderRadius: "4px",
            paddingLeft: "8px",
          }}
          onClick={() => {
            if (hasChildren) {
              handleTreeToggle(node.value);
            }
            if (node.webResource) {
              vm.openTab(node.webResource);
            }
          }}
          onContextMenu={
            isFolder
              ? (e) => handleFolderContextMenu(e, node.value)
              : node.webResource
                ? (e) => handleResourceContextMenu(e, node.webResource!)
                : undefined
          }
        >
          <span
            style={{
              width: "16px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {chevron || null}
          </span>
          <span
            style={{
              width: "16px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {icon}
          </span>
          {renamingFolder === node.value ? (
            <>
              <input
                autoFocus
                value={renameFolderValue}
                onChange={(e) => setRenameFolderValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmFolderRename();
                  if (e.key === "Escape") {
                    setRenamingFolder(null);
                    setRenameFolderValue("");
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  fontSize: "13px",
                  padding: "2px 6px",
                  border: `1px solid ${tokens.colorNeutralStroke1}`,
                  borderRadius: "3px",
                  backgroundColor: tokens.colorNeutralBackground1,
                  color: tokens.colorNeutralForeground1,
                  outline: "none",
                  flex: 1,
                }}
              />
              <Button size="small" onClick={handleConfirmFolderRename}>
                Review
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setRenamingFolder(null);
                  setRenameFolderValue("");
                }}
              >
                Cancel
              </Button>
            </>
          ) : renamingResource && renamingResource.id === node.webResource?.id ? (
            <>
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmRename();
                  if (e.key === "Escape") {
                    setRenamingResource(null);
                    setRenameValue("");
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  fontSize: "13px",
                  padding: "2px 6px",
                  border: `1px solid ${tokens.colorNeutralStroke1}`,
                  borderRadius: "3px",
                  backgroundColor: tokens.colorNeutralBackground1,
                  color: tokens.colorNeutralForeground1,
                  outline: "none",
                  flex: 1,
                }}
              />
              <Button size="small" onClick={handleConfirmRename}>
                Review
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setRenamingResource(null);
                  setRenameValue("");
                }}
              >
                Cancel
              </Button>
            </>
          ) : (
            <span style={{ fontSize: "13px", flex: 1 }}>{node.label}</span>
          )}
          {nodeStatus && (
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: nodeStatus === "dirty" ? "#e74c3c" : "#9b59b6",
                display: "inline-block",
                marginRight: "8px",
                flexShrink: 0,
              }}
            />
          )}
        </div>
        {hasChildren && isExpanded && <div>{node.children!.map((child) => renderTreeNode(child, depth + 1))}</div>}
        {isFolder && isExpanded && newSubfolderParent === node.value && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "4px 0",
              marginLeft: `${(depth + 1) * 4}px`,
              paddingLeft: "8px",
            }}
          >
            <span style={{ width: "16px", flexShrink: 0 }} />
            <FolderAddRegular style={{ flexShrink: 0 }} />
            <input
              autoFocus
              value={newSubfolderName}
              onChange={(e) => setNewSubfolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmSubfolder();
                if (e.key === "Escape") {
                  setNewSubfolderParent(null);
                  setNewSubfolderName("");
                }
              }}
              onBlur={handleConfirmSubfolder}
              placeholder="Folder name"
              style={{
                fontSize: "13px",
                padding: "2px 6px",
                border: `1px solid ${tokens.colorNeutralStroke1}`,
                borderRadius: "3px",
                backgroundColor: tokens.colorNeutralBackground1,
                color: tokens.colorNeutralForeground1,
                outline: "none",
                flex: 1,
                maxWidth: "200px",
              }}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div style={{ overflowY: "auto", height: "100%" }} onContextMenu={handleRootContextMenu}>
        {vm.loadingWebResources ? (
          <Spinner size="small" label="Loading web resources..." />
        ) : vm.webResources.length === 0 ? (
          <div style={{ height: "100%", minHeight: "100px" }} onContextMenu={handleRootContextMenu}>
            <p>No web resources found in this solution</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {newSubfolderParent === "" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "4px 0",
                  paddingLeft: "8px",
                }}
              >
                <span style={{ width: "16px", flexShrink: 0 }} />
                <FolderAddRegular style={{ flexShrink: 0 }} />
                <input
                  autoFocus
                  value={newSubfolderName}
                  onChange={(e) => setNewSubfolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmSubfolder();
                    if (e.key === "Escape") {
                      setNewSubfolderParent(null);
                      setNewSubfolderName("");
                    }
                  }}
                  onBlur={handleConfirmSubfolder}
                  placeholder="Folder name"
                  style={{
                    fontSize: "13px",
                    padding: "2px 6px",
                    border: `1px solid ${tokens.colorNeutralStroke1}`,
                    borderRadius: "3px",
                    backgroundColor: tokens.colorNeutralBackground1,
                    color: tokens.colorNeutralForeground1,
                    outline: "none",
                    flex: 1,
                    maxWidth: "200px",
                  }}
                />
              </div>
            )}
            {vm.webResourceTree.map((node) => renderTreeNode(node))}
          </div>
        )}
      </div>

      {contextTarget && contextNode && (
        <ContextMenu
          target={contextTarget}
          onClose={() => {
            setContextTarget(null);
            setContextNode(null);
          }}
          onNewResource={contextNode.isFolder ? handleOpenNewResourceDialog : undefined}
          onNewSubfolder={contextNode.isFolder ? handleStartNewSubfolder : undefined}
          newSubfolderLabel={contextFolder === "" ? "New Root Folder" : "New Subfolder"}
          onRename={contextNode.isFolder && contextFolder === "" ? undefined : handleStartRename}
          onRefresh={!contextNode.isFolder ? handleRefreshResource : undefined}
        />
      )}

      <NewResourceDialog
        open={newResDialogOpen}
        folder={newResFolder}
        vm={vm}
        dvSvc={dvSvc}
        onLog={onLog}
        onClose={() => setNewResDialogOpen(false)}
      />
      {pendingRename && (
        <WriteConfirmationDialog
          open
          title={pendingRename.kind === "folder" ? "Review folder rename" : "Review resource rename"}
          actionLabel={renaming ? "Renaming..." : "Confirm rename"}
          target={pendingRename.target}
          connectionMatches={!!dvSvc && isSameWriteTarget(dvSvc.connection, pendingRename.target)}
          changes={pendingRename.summary}
          rollbackNotice="The tool attempts to roll back completed renames if a later resource fails. If rollback is incomplete, the failure message identifies that outcome; no separate backup is created."
          onConfirm={confirmPendingRename}
          onClose={() => setPendingRename(null)}
          onCancelBusy={() => renameAbortControllerRef.current?.abort()}
          isBusy={renaming}
        />
      )}
    </>
  );
});
