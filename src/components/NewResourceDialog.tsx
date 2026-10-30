import React, { useState, useCallback } from "react";
import { observer } from "mobx-react";
import { ViewModel, WebResource } from "../model/viewModel";
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Input,
  Dropdown,
  Option,
  Label,
} from "@fluentui/react-components";
import { dvService } from "../services/dataverseService";
import { isSameWriteTarget, WriteConfirmationDialog, WriteReviewTarget } from "./WriteConfirmationDialog";

interface PendingCreate {
  name: string;
  displayName: string;
  type: number;
  solutionId: string;
  solutionUniqueName: string;
  solutionName: string;
  target: WriteReviewTarget;
}

const resourceTypeOptions = [
  { type: 1, label: "HTML" },
  { type: 2, label: "CSS" },
  { type: 3, label: "JavaScript" },
  { type: 4, label: "XML" },
  { type: 5, label: "PNG" },
  { type: 6, label: "JPG" },
  { type: 7, label: "GIF" },
  { type: 9, label: "XSL" },
  { type: 11, label: "SVG" },
  { type: 12, label: "RESX" },
];

const extensionForType: Record<number, string> = {
  1: ".html",
  2: ".css",
  3: ".js",
  4: ".xml",
  5: ".png",
  6: ".jpg",
  7: ".gif",
  9: ".xsl",
  11: ".svg",
  12: ".resx",
};

interface NewResourceDialogProps {
  open: boolean;
  folder: string;
  vm: ViewModel;
  dvSvc: dvService;
  onLog: (message: string, type?: "info" | "success" | "warning" | "error") => void;
  onClose: () => void;
}

export const NewResourceDialog: React.FC<NewResourceDialogProps> = observer(
  ({ open, folder, vm, dvSvc, onLog, onClose }) => {
    const [name, setName] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [type, setType] = useState<number>(3);
    const [creating, setCreating] = useState(false);
    const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(null);

    const handleCreate = useCallback(() => {
      if (!name.trim() || !vm.selectedSolution) return;
      const connection = dvSvc.connection;
      if (!connection) return;
      const ext = extensionForType[type] ?? "";
      const nameWithExt = name.endsWith(ext) ? name : name + ext;
      const fullName = folder ? `${folder}/${nameWithExt}` : nameWithExt;
      setPendingCreate({
        name: fullName,
        displayName: displayName || nameWithExt,
        type,
        solutionId: vm.selectedSolution.id,
        solutionUniqueName: vm.selectedSolution.uniqueName,
        solutionName: vm.selectedSolution.name,
        target: {
          id: connection.id,
          name: connection.name,
          url: connection.url,
          environment: connection.environment,
        },
      });
    }, [name, displayName, type, folder, vm, dvSvc]);

    const confirmCreate = useCallback(async () => {
      if (!pendingCreate) return;
      setCreating(true);
      try {
        if (!isSameWriteTarget(dvSvc.connection, pendingCreate.target)) {
          throw new Error("The active connection changed. Review the operation again before creating a resource.");
        }
        const id = await dvSvc.createWebResource(
          pendingCreate.name,
          pendingCreate.displayName,
          pendingCreate.type,
          pendingCreate.solutionId,
          pendingCreate.solutionUniqueName,
        );
        const resource = new WebResource(
          id,
          pendingCreate.name,
          pendingCreate.displayName,
          pendingCreate.type,
          pendingCreate.name,
          true,
        );
        resource.stringContent = " ";
        resource.originalContent = " ";
        vm.addWebResource(resource);
        onLog(`Created web resource: ${pendingCreate.name}`, "success");
        setPendingCreate(null);
        onClose();
      } catch (err) {
        onLog(`Failed to create web resource: ${err}`, "error");
        await window.toolboxAPI.utils.showNotification({
          title: "Create Failed",
          body: `Failed to create web resource: ${err}`,
          type: "error",
        });
      } finally {
        setCreating(false);
      }
    }, [pendingCreate, dvSvc, vm, onLog, onClose]);

    const handleOpenChange = (_: any, data: { open: boolean }) => {
      if (!data.open) {
        onClose();
      }
    };

    // Reset fields when dialog opens
    React.useEffect(() => {
      if (open) {
        setName("");
        setDisplayName("");
        setType(3);
      }
    }, [open]);

    return (
      <>
      <Dialog open={open && !pendingCreate} onOpenChange={handleOpenChange}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>New Web Resource</DialogTitle>
            <DialogContent>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingTop: "8px" }}>
                <div>
                  <Label>Folder</Label>
                  <Input value={folder} readOnly style={{ width: "100%" }} />
                </div>
                <div>
                  <Label required>Name</Label>
                  <Input
                    value={name}
                    onChange={(_, d) => setName(d.value)}
                    placeholder="myresource"
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <Label>Display Name</Label>
                  <Input
                    value={displayName}
                    onChange={(_, d) => setDisplayName(d.value)}
                    placeholder="My Resource"
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <Label required>Type</Label>
                  <Dropdown
                    value={resourceTypeOptions.find((o) => o.type === type)?.label ?? ""}
                    onOptionSelect={(_, d) => {
                      const opt = resourceTypeOptions.find((o) => o.label === d.optionText);
                      if (opt) setType(opt.type);
                    }}
                    style={{ width: "100%" }}
                    inlinePopup
                  >
                    {resourceTypeOptions.map((o) => (
                      <Option key={o.type} text={o.label}>
                        {o.label}
                      </Option>
                    ))}
                  </Dropdown>
                </div>
              </div>
            </DialogContent>
            <DialogActions>
              <Button
                appearance="primary"
                onClick={handleCreate}
                disabled={!name.trim() || !vm.selectedSolution || !dvSvc.connection || creating}
              >
                Review
              </Button>
              <Button appearance="secondary" onClick={onClose} disabled={creating}>
                Cancel
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      {pendingCreate && (
        <WriteConfirmationDialog
          open={open}
          title="Review new web resource"
          actionLabel={creating ? "Creating..." : "Confirm create"}
          target={pendingCreate.target}
          connectionMatches={isSameWriteTarget(dvSvc.connection, pendingCreate.target)}
          changes={[
            `Create ${pendingCreate.name} (${resourceTypeOptions.find((option) => option.type === pendingCreate.type)?.label ?? "web resource"})`,
            `Add it to solution ${pendingCreate.solutionName} (${pendingCreate.solutionUniqueName})`,
          ]}
          rollbackNotice="If adding the resource to the solution fails, the tool attempts to delete the newly created resource. There is no automatic undo after creation succeeds."
          onConfirm={confirmCreate}
          onClose={() => setPendingCreate(null)}
          isBusy={creating}
        />
      )}
      </>
    );
  },
);
