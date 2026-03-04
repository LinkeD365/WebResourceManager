import React, { useCallback, useEffect, useRef, useState } from "react";

import { observer } from "mobx-react";
import { SolutionMeta, ViewModel } from "../model/viewModel";
import { dvService } from "../services/dataverseService";
import {
  Dropdown,
  Option,
  Spinner,
  NavDrawer,
  NavDrawerBody,
  NavDrawerHeader,
  SearchBox,
  Toolbar,
  ToolbarGroup,
  ToolbarDivider,
  ToolbarButton,
} from "@fluentui/react-components";
import { WebResourceTree } from "./WebResourceTree";
import { WebResourceDetails } from "./WebResourceDetails";
import { ResourceTypeFilter } from "./ResourceTypeFilter";
import { prettifyCode } from "./viewers/CodeViewer";
import {
  CodeColor,
  FolderZipRegular,
  SaveRegular,
  CloudArrowUpRegular,
  ArrowUploadRegular,
  ArrowDownloadRegular,
} from "@fluentui/react-icons";
import { minify } from "terser";

interface WebResourceManagerProps {
  connection: ToolBoxAPI.DataverseConnection | null;
  dvSvc: dvService;
  vm: ViewModel;
  onLog: (message: string, type?: "info" | "success" | "warning" | "error") => void;
}
export const WebResourceManager = observer((props: WebResourceManagerProps): React.JSX.Element => {
  const { connection, dvSvc, vm, onLog } = props;
  const [loadingSolutions, setLoadingSolutions] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [drawerWidth, setDrawerWidth] = useState(320);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback(
    (_: any, data: { value: string }) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        vm.setSearchFilter(data.value);
      }, 300);
    },
    [vm],
  );

  useEffect(() => {
    if (!dvSvc || !connection) return;
    setLoadingSolutions(true);
    dvSvc
      .getSolutions(false)
      .then((solutions) => {
        vm.setSolutions(solutions);
        onLog(`Loaded ${solutions.length} solutions`, "success");
      })
      .catch((err) => {
        onLog(`Error loading solutions: ${err}`, "error");
      })
      .finally(() => setLoadingSolutions(false));
  }, [dvSvc, connection, onLog]);

  const handleSolutionSelect = (_: any, data: { optionValue?: string }) => {
    if (!data.optionValue) {
      vm.selectedSolution = null;
      return;
    }
    const selected = vm.solutions.find((s: SolutionMeta) => s.id === data.optionValue) ?? null;
    vm.selectedSolution = selected;
  };

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const nextWidth = Math.min(600, Math.max(220, event.clientX - rect.left));
      setDrawerWidth(nextWidth);
    };

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      document.body.style.cursor = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const selectedType = vm.selectedResource?.type ?? null;
  const isCodeViewerResource = selectedType !== null && [1, 2, 3, 4, 9].includes(selectedType);
  const isImageResource = selectedType !== null && [5, 6, 7].includes(selectedType);
  const isSvgResource = selectedType === 11;
  const canTransferFile = isCodeViewerResource || isImageResource || isSvgResource;
  const isCustomizable = vm.selectedResource?.isCustomizable ?? false;
  const canSaveResource = (isCodeViewerResource || isImageResource || isSvgResource) && isCustomizable;
  const canSave = (vm.selectedResource?.isDirty ?? false) && isCustomizable;
  const canPrettify = selectedType !== null && [1, 2, 3].includes(selectedType);
  const canMinify = selectedType !== null && [1, 3].includes(selectedType);

  const handlePrettify = () => {
    if (!vm.selectedResource || !vm.selectedResource.stringContent) return;
    const formatted = prettifyCode(vm.selectedResource.stringContent, vm.selectedResource.type);
    vm.selectedResource.stringContent = formatted;
  };

  const handleMinify = async () => {
    if (!vm.selectedResource || !vm.selectedResource.stringContent) return;
    try {
      const result = await minify(vm.selectedResource.stringContent);
      if (result.code) {
        vm.selectedResource.stringContent = result.code;
      }
    } catch (err) {
      onLog(`Failed to minify: ${err}`, "error");
    }
  };

  const getResourceFileConfig = (type: number) => {
    if ([5, 6, 7].includes(type)) {
      const imageConfigMap: {
        [key: number]: { extension: string; mimeType: string; label: string; acceptedExtensions: string[] };
      } = {
        5: { extension: "png", mimeType: "image/png", label: "PNG", acceptedExtensions: ["png"] },
        6: { extension: "jpg", mimeType: "image/jpeg", label: "JPG", acceptedExtensions: ["jpg", "jpeg"] },
        7: { extension: "gif", mimeType: "image/gif", label: "GIF", acceptedExtensions: ["gif"] },
      };
      return (
        imageConfigMap[type] ?? {
          extension: "png",
          mimeType: "image/png",
          label: "Image",
          acceptedExtensions: ["png"],
        }
      );
    }

    if (type === 11) {
      return { extension: "svg", mimeType: "image/svg+xml", label: "SVG", acceptedExtensions: ["svg"] };
    }

    const codeConfigMap: {
      [key: number]: { extension: string; mimeType: string; label: string; acceptedExtensions: string[] };
    } = {
      1: { extension: "html", mimeType: "text/html", label: "HTML", acceptedExtensions: ["html", "htm"] },
      2: { extension: "css", mimeType: "text/css", label: "CSS", acceptedExtensions: ["css"] },
      3: { extension: "js", mimeType: "application/javascript", label: "JavaScript", acceptedExtensions: ["js"] },
      4: { extension: "xml", mimeType: "application/xml", label: "XML", acceptedExtensions: ["xml"] },
      9: { extension: "xsl", mimeType: "application/xml", label: "XSL", acceptedExtensions: ["xsl", "xslt"] },
    };

    return (
      codeConfigMap[type] ?? { extension: "txt", mimeType: "text/plain", label: "Text", acceptedExtensions: ["txt"] }
    );
  };

  const handleUploadFile = async () => {
    if (!vm.selectedResource) return;

    const config = getResourceFileConfig(vm.selectedResource.type);

    try {
      const filePath = await window.toolboxAPI.fileSystem.selectPath({
        type: "file",
        title: `Select ${config.label} File`,
        filters: [
          { name: `${config.label} Files`, extensions: [config.extension] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (!filePath) return;

      const fileExtension = filePath.substring(filePath.lastIndexOf(".") + 1).toLowerCase();
      if (!config.acceptedExtensions.includes(fileExtension)) {
        onLog(`Please select one of: ${config.acceptedExtensions.map((ext) => `.${ext}`).join(", ")}.`, "error");
        return;
      }

      if (isImageResource) {
        const binary = await window.toolboxAPI.fileSystem.readBinary(filePath);
        vm.selectedResource.stringContent = binary.toString("base64");
      } else {
        const content = await window.toolboxAPI.fileSystem.readText(filePath);
        vm.selectedResource.stringContent = content;
      }

      const fileName = filePath.substring(filePath.lastIndexOf("\\") + 1);
      onLog(`Uploaded ${fileName}`, "success");
    } catch (err) {
      onLog(`Error uploading file: ${err}`, "error");
    }
  };

  const handleSave = async () => {
    if (!vm.selectedResource || !vm.selectedResource.stringContent) return;
    try {
      const resourceLabel = isImageResource ? "image" : "web resource";
      onLog(`Saving ${resourceLabel}...`, "info");
      await dvSvc.saveWebResourceContent(vm.selectedResource.id, vm.selectedResource.stringContent);
      vm.selectedResource.markClean();
      onLog(`Saved ${vm.selectedResource.name}`, "success");
      await window.toolboxAPI.utils.showNotification({
        title: "Save Successful",
        body: `Saved ${vm.selectedResource.name}`,
        type: "success",
      });
    } catch (err) {
      onLog(`Failed to save: ${err}`, "error");
      await window.toolboxAPI.utils.showNotification({
        title: "Save Failed",
        body: `Failed to save: ${err}`,
        type: "error",
      });
    }
  };

  const handleSaveAndPublish = async () => {
    if (!vm.selectedResource || !vm.selectedResource.stringContent) return;
    try {
      const resourceLabel = isImageResource ? "image" : "web resource";
      onLog(`Saving and publishing ${resourceLabel}...`, "info");
      await dvSvc.saveWebResourceContent(vm.selectedResource.id, vm.selectedResource.stringContent);
      vm.selectedResource.markClean();
      await dvSvc.publishWebResource(vm.selectedResource.id);
      onLog(`Saved and published ${vm.selectedResource.name}`, "success");
      await window.toolboxAPI.utils.showNotification({
        title: "Saved and Published",
        body: `Saved and published ${vm.selectedResource.name}`,
        type: "success",
      });
    } catch (err) {
      onLog(`Failed to save and publish: ${err}`, "error");
      await window.toolboxAPI.utils.showNotification({
        title: "Save and Publish Failed",
        body: `Failed to save and publish: ${err}`,
        type: "error",
      });
    }
  };

  const handleDownloadFile = () => {
    if (!vm.selectedResource || !vm.selectedResource.stringContent) return;

    const config = getResourceFileConfig(vm.selectedResource.type);
    const fileName = `${vm.selectedResource.name}.${config.extension}`;

    const element = document.createElement("a");
    if (isImageResource) {
      element.href = `data:${config.mimeType};base64,${vm.selectedResource.stringContent}`;
    } else {
      const file = new Blob([vm.selectedResource.stringContent], { type: config.mimeType });
      element.href = URL.createObjectURL(file);
    }

    element.download = fileName;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    if (!isImageResource) {
      URL.revokeObjectURL(element.href);
    }

    onLog(`Downloaded ${fileName}`, "success");
  };

  const toolBar = (
    <div>
      <Toolbar style={{ justifyContent: "space-between" }}>
        <ToolbarGroup>
          {loadingSolutions ? (
            <Spinner size="tiny" label="Loading solutions..." />
          ) : (
            <Dropdown
              placeholder="Select a solution..."
              onOptionSelect={handleSolutionSelect}
              value={vm.selectedSolution?.name ?? ""}
              disabled={vm.solutions.length === 0}
              inlinePopup
            >
              {vm.solutions.map((solution: SolutionMeta) => (
                <Option key={solution.id} value={solution.id} text={solution.name}>
                  {solution.name}
                </Option>
              ))}
            </Dropdown>
          )}

          {canTransferFile && (
            <>
              <ToolbarDivider />
              {canSaveResource && (
                <>
                  <ToolbarButton disabled={!canSave} onClick={handleSave} aria-label="Save" icon={<SaveRegular />} />
                  <ToolbarButton
                    disabled={!canSave}
                    onClick={handleSaveAndPublish}
                    aria-label="Save and Publish"
                    icon={<CloudArrowUpRegular />}
                  />
                </>
              )}
              {canTransferFile && (
                <>
                  <ToolbarButton
                    disabled={!isCustomizable}
                    onClick={handleUploadFile}
                    aria-label="Upload file"
                    icon={<ArrowUploadRegular />}
                  />
                  <ToolbarButton
                    onClick={handleDownloadFile}
                    aria-label="Download file"
                    icon={<ArrowDownloadRegular />}
                  />
                </>
              )}
              {isCodeViewerResource && (
                <>
                  <ToolbarDivider />
                  <ToolbarButton
                    disabled={!canPrettify}
                    onClick={handlePrettify}
                    aria-label="Prettify Code"
                    icon={<CodeColor />}
                  />
                  <ToolbarButton
                    disabled={!canMinify}
                    onClick={handleMinify}
                    aria-label="Minify Code"
                    icon={<FolderZipRegular />}
                  />
                </>
              )}
            </>
          )}
        </ToolbarGroup>
        <ToolbarGroup style={{ marginLeft: "auto" }}>
          <div>
            <ResourceTypeFilter vm={vm} />
          </div>
        </ToolbarGroup>
      </Toolbar>
    </div>
  );

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      {toolBar}
      <div ref={containerRef} style={{ height: "94vh", display: "flex" }}>
        {drawerOpen && (
          <div style={{ width: `${drawerWidth}px`, minWidth: "220px", maxWidth: "600px", position: "relative" }}>
            <NavDrawer open type="inline" style={{ width: "100%", height: "100%" }}>
              <NavDrawerHeader>
                <SearchBox
                  placeholder="Search web resources"
                  size="small"
                  onChange={handleSearchChange}
                  style={{ width: "100%" }}
                />
              </NavDrawerHeader>
              <NavDrawerBody>
                <div style={{ padding: "16px", overflowY: "auto", height: "100%" }}>
                  {vm.selectedSolution ? (
                    <WebResourceTree vm={vm} dvSvc={dvSvc} onLog={onLog} />
                  ) : (
                    <p>Select a solution to view web resources</p>
                  )}
                </div>
              </NavDrawerBody>
            </NavDrawer>
            <div
              onMouseDown={() => {
                isDraggingRef.current = true;
                document.body.style.cursor = "col-resize";
              }}
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: "6px",
                height: "100%",
                cursor: "col-resize",
              }}
            />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <WebResourceDetails
            vm={vm}
            dvSvc={dvSvc}
            onLog={onLog}
            drawerOpen={drawerOpen}
            onToggleDrawer={() => setDrawerOpen((open) => !open)}
          />
        </div>
      </div>
    </div>
  );
});
