import React, { useEffect, useState, useCallback } from "react";
import { observer } from "mobx-react";
import { ViewModel, TreeNode, WebResource } from "../model/viewModel";
import { Spinner, tokens } from "@fluentui/react-components";
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
  dvSvc: dvService;
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
    existingResources: any[] = [],
  ) => {
    if (!dvSvc) return;

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
      const allResources = [...existingResources, ...result.resources];

      // Update the tree immediately with resources loaded so far
      vm.setWebResources(allResources);
      onLog(`Loaded ${result.resources.length} web resources (total: ${allResources.length})`, "info");

      // If there's a paging cookie, fetch the next page
      if (result.pagingCookie) {
        onLog(`Fetching more web resources...`, "info");
        vm.loadingWebResources = false;
        await loadWebResources(solutionId, typeFilters, result.pagingCookie, allResources);
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

  const handleConfirmRename = useCallback(async () => {
    if (!renamingResource || !dvSvc) return;
    const newName = renameValue.trim();
    if (!newName || newName === renamingResource.name) {
      setRenamingResource(null);
      setRenameValue("");
      return;
    }
    try {
      await dvSvc.renameWebResource(renamingResource.id, newName, newName);
      renamingResource.rename(newName);
      vm.buildWebResourceTree();
      onLog(`Renamed to ${newName}`, "success");
    } catch {
      onLog("Failed to rename web resource", "error");
    }
    setRenamingResource(null);
    setRenameValue("");
  }, [renamingResource, renameValue, dvSvc, vm, onLog]);

  const handleConfirmFolderRename = useCallback(async () => {
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
    try {
      for (const wr of affected) {
        const newName = wr.name === renamingFolder ? newFolderPath : newPrefix + wr.name.slice(oldPrefix.length);
        await dvSvc.renameWebResource(wr.id, newName, newName);
        wr.rename(newName);
      }
      // Update virtual folders too
      const vfToAdd: string[] = [];
      vm.virtualFolders.forEach((vf) => {
        if (vf === renamingFolder || vf.startsWith(oldPrefix)) {
          vm.virtualFolders.delete(vf);
          vfToAdd.push(vf === renamingFolder ? newFolderPath : newPrefix + vf.slice(oldPrefix.length));
        }
      });
      vfToAdd.forEach((vf) => vm.virtualFolders.add(vf));

      vm.buildWebResourceTree();
      onLog(`Renamed folder to ${newLabel}`, "success");
    } catch {
      onLog("Failed to rename folder", "error");
    }
    setRenamingFolder(null);
    setRenameFolderValue("");
  }, [renamingFolder, renameFolderValue, dvSvc, vm, onLog]);

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
              onBlur={handleConfirmFolderRename}
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
          ) : renamingResource && renamingResource.id === node.webResource?.id ? (
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
              onBlur={handleConfirmRename}
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
    </>
  );
});
