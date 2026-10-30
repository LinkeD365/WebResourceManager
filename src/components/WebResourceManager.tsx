import React, { useCallback, useEffect, useRef, useState } from "react";

import { observer } from "mobx-react";
import { SolutionMeta, ViewModel, WebResource } from "../model/viewModel";
import { dvService } from "../services/dataverseService";
import {
  Combobox,
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
  AddRegular,
  ArrowClockwiseRegular,
  SearchRegular,
} from "@fluentui/react-icons";
import { minify } from "terser";
import { isSameWriteTarget, WriteConfirmationDialog, WriteReviewTarget } from "./WriteConfirmationDialog";

type PendingWrite = {
  action: "save" | "save-publish" | "publish";
  resource: WebResource;
  target: WriteReviewTarget;
};

interface WebResourceManagerProps {
  connection: ToolBoxAPI.DataverseConnection | null;
  dvSvc: dvService | null;
  vm: ViewModel;
  onLog: (message: string, type?: "info" | "success" | "warning" | "error") => void;
}
export const WebResourceManager = observer((props: WebResourceManagerProps): React.JSX.Element => {
  const { connection, dvSvc, vm, onLog } = props;
  const [loadingSolutions, setLoadingSolutions] = useState(false);
  const [solutionSearch, setSolutionSearch] = useState("");
  const [codeSearchTrigger, setCodeSearchTrigger] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [drawerWidth, setDrawerWidth] = useState(320);
  const [pendingWrite, setPendingWrite] = useState<PendingWrite | null>(null);
  const [isConfirmingWrite, setIsConfirmingWrite] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backupServerContentsRef = useRef(new Map<string, string>());

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
      setSolutionSearch("");
      return;
    }
    const selected = vm.solutions.find((s: SolutionMeta) => s.id === data.optionValue) ?? null;
    vm.selectedSolution = selected;
    setSolutionSearch(selected?.name ?? "");
  };

  const normalizedSolutionSearch = solutionSearch.trim().toLowerCase();
  const filteredSolutions =
    !normalizedSolutionSearch || normalizedSolutionSearch === vm.selectedSolution?.name.toLowerCase()
      ? vm.solutions
      : vm.solutions.filter(
          (solution) =>
            solution.name.toLowerCase().includes(normalizedSolutionSearch) ||
            solution.uniqueName.toLowerCase().includes(normalizedSolutionSearch),
        );

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
  const isResxResource = selectedType === 12;
  const canTransferFile = isCodeViewerResource || isImageResource || isSvgResource || isResxResource;
  const isCustomizable = vm.selectedResource?.isCustomizable ?? false;
  const canSaveResource =
    (isCodeViewerResource || isImageResource || isSvgResource || isResxResource) && isCustomizable;
  const isSaving = vm.selectedResource?.isSaving ?? false;
  const canSave = (vm.selectedResource?.isDirty ?? false) && isCustomizable && !isSaving;
  const canPrettify = selectedType !== null && [1, 2, 3].includes(selectedType) && !isSaving;
  const canMinify = selectedType !== null && [1, 3].includes(selectedType) && !isSaving;

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

    if (type === 12) {
      return { extension: "resx", mimeType: "application/xml", label: "RESX", acceptedExtensions: ["resx"] };
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

  const requestWriteConfirmation = (action: PendingWrite["action"]) => {
    if (!connection || !vm.selectedResource) return;
    backupServerContentsRef.current.delete(vm.selectedResource.id);
    setPendingWrite({
      action,
      resource: vm.selectedResource,
      target: {
        id: connection.id,
        name: connection.name,
        url: connection.url,
        environment: connection.environment,
      },
    });
  };

  const exportOriginalBackup = async (resource: WebResource): Promise<string | null> => {
    if (!dvSvc) throw new Error("No active Dataverse connection is available to create a backup.");
    if (resource.originalContent === null) {
      throw new Error("The original resource content is unavailable; a backup cannot be created.");
    }

    const serverContent = await dvSvc.getWebResourceContent(resource.id);
    if (serverContent === null) {
      throw new Error("Dataverse returned no current content; a backup cannot be created.");
    }

    const isBinary = [5, 6, 7].includes(resource.type);
    let currentContent = serverContent;
    if (!isBinary) {
      try {
        const bytes = Uint8Array.from(atob(serverContent), (character) => character.charCodeAt(0));
        currentContent = new TextDecoder("utf-8").decode(bytes);
      } catch {
        throw new Error("Dataverse returned content that could not be decoded; no backup was created.");
      }
    }
    if (currentContent !== resource.originalContent) {
      throw new Error(
        "The web resource changed since it was loaded. Refresh it before creating a backup or saving.",
      );
    }

    const config = getResourceFileConfig(resource.type);
    const content = isBinary
      ? Uint8Array.from(atob(serverContent), (character) => character.charCodeAt(0))
      : currentContent;
    const defaultName = `${resource.fileName}.backup.${config.extension}`;
    const backupPath = await window.toolboxAPI.fileSystem.saveFile(defaultName, content, [
      { name: `${config.label} backup`, extensions: [config.extension] },
    ]);
    if (backupPath) backupServerContentsRef.current.set(resource.id, serverContent);
    return backupPath;
  };

  const confirmPendingWrite = async () => {
    if (!pendingWrite || !dvSvc) return;
    if (!isSameWriteTarget(connection, pendingWrite.target)) {
      onLog("The active connection changed. Review the operation again before writing.", "error");
      return;
    }

    const { action, resource } = pendingWrite;
    const expectedServerContent = backupServerContentsRef.current.get(resource.id);
    if (resource.stringContent === null) {
      onLog("Resource content is unavailable. No Dataverse change was made.", "error");
      setPendingWrite(null);
      return;
    }

    setIsConfirmingWrite(true);
    resource.isSaving = true;
    try {
      if (action === "save" || (action === "save-publish" && resource.isDirty)) {
        if (expectedServerContent === undefined) {
          throw new Error("Create a fresh backup before saving this resource.");
        }
        await dvSvc.saveWebResourceContent(
          resource.id,
          resource.stringContent,
          resource.name,
          [5, 6, 7].includes(resource.type),
          expectedServerContent,
        );
        resource.markClean();
      }
      if (action !== "save") {
        await dvSvc.publishWebResource(resource.id, resource.name);
        resource.markPublished();
      }

      const body =
        action === "save"
          ? `Saved ${resource.name}`
          : action === "save-publish"
            ? `Saved and published ${resource.name}`
            : `Published ${resource.name}`;
      onLog(body, "success");
      await window.toolboxAPI.utils.showNotification({
        title: action === "save" ? "Save Successful" : "Publish Successful",
        body,
        type: "success",
      });
    } catch (error) {
      onLog(`Failed to ${action}: ${error}`, "error");
      await window.toolboxAPI.utils.showNotification({
        title: action === "save" ? "Save Failed" : "Publish Failed",
        body: `Failed to ${action}: ${error}`,
        type: "error",
      });
    } finally {
      resource.isSaving = false;
      setIsConfirmingWrite(false);
      setPendingWrite(null);
      backupServerContentsRef.current.delete(resource.id);
    }
  };

  const handleDownloadFile = () => {
    if (!vm.selectedResource || !vm.selectedResource.stringContent) return;

    const config = getResourceFileConfig(vm.selectedResource.type);
    const fileName = vm.selectedResource.fileName;
    const normalizedFileName = fileName.toLowerCase().endsWith(`.${config.extension}`)
      ? fileName
      : `${fileName}.${config.extension}`;

    const element = document.createElement("a");
    if (isImageResource) {
      element.href = `data:${config.mimeType};base64,${vm.selectedResource.stringContent}`;
    } else {
      const file = new Blob([vm.selectedResource.stringContent], { type: config.mimeType });
      element.href = URL.createObjectURL(file);
    }

    element.download = normalizedFileName;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    if (!isImageResource) {
      setTimeout(() => URL.revokeObjectURL(element.href), 0);
    }

    onLog(`Downloaded ${normalizedFileName}`, "success");
  };

  const toolBar = (
    <div>
      <Toolbar style={{ justifyContent: "space-between" }}>
        <ToolbarGroup>
          {loadingSolutions ? (
            <Spinner size="tiny" label="Loading solutions..." />
          ) : (
            <Combobox
              placeholder="Select a solution..."
              onOptionSelect={handleSolutionSelect}
              onChange={(event) => setSolutionSearch(event.target.value)}
              value={solutionSearch}
              selectedOptions={vm.selectedSolution ? [vm.selectedSolution.id] : []}
              disabled={vm.solutions.length === 0}
              inlinePopup
              aria-label="Search and select a solution"
              style={{ minWidth: `${drawerWidth - 16}px` }}
            >
              {filteredSolutions.map((solution: SolutionMeta) => (
                <Option key={solution.id} value={solution.id} text={solution.name}>
                  {solution.name}
                </Option>
              ))}
              {filteredSolutions.length === 0 && <Option disabled>No solutions found</Option>}
            </Combobox>
          )}

          {vm.selectedResource && (
            <>
              <ToolbarDivider />
              <ToolbarButton
                onClick={() => vm.selectedResource?.triggerRefresh()}
                aria-label="Refresh"
                icon={<ArrowClockwiseRegular />}
              />
            </>
          )}
          {canTransferFile && (
            <>
              <ToolbarDivider />
              {canSaveResource && (
                <>
                  <ToolbarButton
                    disabled={!canSave}
                    onClick={() => requestWriteConfirmation("save")}
                    aria-label="Save"
                    icon={<SaveRegular />}
                  />
                  <ToolbarButton
                    disabled={isSaving || (!canSave && !(vm.selectedResource?.isSavedNotPublished && isCustomizable))}
                    onClick={() =>
                      requestWriteConfirmation(vm.selectedResource?.isDirty ? "save-publish" : "publish")
                    }
                    aria-label="Save and Publish"
                    icon={<CloudArrowUpRegular />}
                  />
                </>
              )}
              {canTransferFile && (
                <>
                  <ToolbarButton
                    disabled={!isCustomizable || isSaving}
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
                    disabled={vm.selectedResource?.stringContent === null}
                    onClick={() => setCodeSearchTrigger((trigger) => trigger + 1)}
                    aria-label="Search code"
                    icon={<SearchRegular />}
                  />
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
              {isResxResource && (
                <>
                  <ToolbarDivider />
                  <ToolbarButton
                    disabled={!isCustomizable || isSaving}
                    onClick={() => vm.triggerResxAddRow()}
                    aria-label="Add Row"
                    icon={<AddRegular />}
                  />
                  <SearchBox
                    size="small"
                    placeholder="Search resources..."
                    value={vm.resxSearchFilter}
                    onChange={(_, data) => vm.setResxSearchFilter(data.value)}
                    style={{ minWidth: "150px" }}
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
              <NavDrawerHeader style={{ padding: "8px 8px 0 8px" }}>
                <SearchBox
                  placeholder="Search web resources"
                  size="small"
                  onChange={handleSearchChange}
                  style={{ width: "100%" }}
                />
              </NavDrawerHeader>
              <NavDrawerBody>
                <div style={{ overflowY: "auto", height: "100%" }}>
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
          {dvSvc && (
            <WebResourceDetails
              vm={vm}
              dvSvc={dvSvc}
              onLog={onLog}
              drawerOpen={drawerOpen}
              onToggleDrawer={() => setDrawerOpen((open) => !open)}
              codeSearchTrigger={codeSearchTrigger}
            />
          )}
        </div>
      </div>
      {pendingWrite && (
        <WriteConfirmationDialog
          open
          title={
            pendingWrite.action === "save"
              ? "Review content save"
              : pendingWrite.action === "save-publish"
                ? "Review save and publish"
                : "Review publish"
          }
          actionLabel={
            pendingWrite.action === "save"
              ? "Confirm save"
              : pendingWrite.action === "save-publish"
                ? "Confirm save and publish"
                : "Confirm publish"
          }
          target={pendingWrite.target}
          connectionMatches={
            isSameWriteTarget(connection, pendingWrite.target) &&
            !!dvSvc &&
            isSameWriteTarget(dvSvc.connection, pendingWrite.target)
          }
          changes={[
            `${pendingWrite.resource.name} (web resource ID ${pendingWrite.resource.id})`,
            pendingWrite.action === "publish"
              ? "Publish the saved content to users."
              : "Replace the saved content with the editor contents.",
          ]}
          rollbackNotice={
            pendingWrite.action === "publish"
              ? "Publishing affects users of this environment. It is not automatically reversible."
              : "The current content must be exported before the write. Rollback is manual: restore the exported backup and publish it if needed."
          }
          requiresBackup={
            pendingWrite.resource.isDirty &&
            (pendingWrite.action === "save" || pendingWrite.action === "save-publish")
          }
          onExportBackup={() => exportOriginalBackup(pendingWrite.resource)}
          onConfirm={confirmPendingWrite}
          onClose={() => setPendingWrite(null)}
          isBusy={isConfirmingWrite}
        />
      )}
    </div>
  );
});
