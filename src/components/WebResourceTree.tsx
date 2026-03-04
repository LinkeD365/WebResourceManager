import React, { useEffect } from "react";
import { observer } from "mobx-react";
import { ViewModel, TreeNode } from "../model/viewModel";
import { Spinner, tokens } from "@fluentui/react-components";
import {
  FolderRegular,
  CodeRegular,
  ChevronRightRegular,
  ChevronDownRegular,
  DrawImageRegular,
  ImageRegular,
} from "@fluentui/react-icons";
import { dvService } from "../services/dataverseService";

interface WebResourceTreeProps {
  vm: ViewModel;
  dvSvc: dvService;
  onLog: (message: string, type?: "info" | "success" | "warning" | "error") => void;
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

export const WebResourceTree = observer((props: WebResourceTreeProps): React.JSX.Element => {
  const { vm, dvSvc, onLog } = props;

  const typeFilterKey = Array.from(vm.resourceTypeFilter)
    .sort((a, b) => a - b)
    .join(",");

  const prefixFilterKey = vm.prefixFilter;
  const loadManagedKey = vm.loadManaged;

  const loadWebResources = async (
    solutionId: string,
    typeFilters: number[],
    pagingCookie?: string,
    existingResources: any[] = [],
  ) => {
    if (!dvSvc) return;

    try {
      const prefixes = vm.getPrefixes();
      const result = await dvSvc.getWebResources(solutionId, typeFilters, prefixes, vm.loadManaged, pagingCookie);
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
  }, [vm.selectedSolution, vm, dvSvc, onLog, typeFilterKey, prefixFilterKey, loadManagedKey]);

  const handleTreeToggle = (nodeValue: string) => {
    vm.toggleNodeExpanded(nodeValue);
  };

  const renderTreeNode = (node: TreeNode, depth: number = 0): React.JSX.Element => {
    const isExpanded = vm.expandedNodes.has(node.value);
    const hasChildren = node.children && node.children.length > 0;
    const icon = node.isLeaf && node.webResource ? getIconForResourceType(node.webResource.type) : <FolderRegular />;
    const chevron = hasChildren ? isExpanded ? <ChevronDownRegular /> : <ChevronRightRegular /> : null;

    return (
      <div key={node.value}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "4px 0",
            cursor: "pointer",
            marginLeft: `${depth * 16}px`,
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
        >
          {chevron || <div style={{ width: "16px" }} />}
          {icon}
          <span style={{ fontSize: "13px", flex: 1 }}>{node.label}</span>
        </div>
        {hasChildren && isExpanded && <div>{node.children!.map((child) => renderTreeNode(child, depth + 1))}</div>}
      </div>
    );
  };

  return (
    <div style={{ overflowY: "auto", height: "100%" }}>
      {vm.loadingWebResources ? (
        <Spinner size="small" label="Loading web resources..." />
      ) : vm.webResources.length === 0 ? (
        <p>No web resources found in this solution</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {vm.webResourceTree.map((node) => renderTreeNode(node))}
        </div>
      )}
    </div>
  );
});
