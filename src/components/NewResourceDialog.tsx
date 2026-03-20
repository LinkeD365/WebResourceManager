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
  Spinner,
} from "@fluentui/react-components";
import { dvService } from "../services/dataverseService";

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

    const handleCreate = useCallback(async () => {
      if (!name.trim() || !vm.selectedSolution) return;
      setCreating(true);
      try {
        const ext = extensionForType[type] ?? "";
        const nameWithExt = name.endsWith(ext) ? name : name + ext;
        const fullName = folder ? `${folder}/${nameWithExt}` : nameWithExt;
        const id = await dvSvc.createWebResource(
          fullName,
          displayName || nameWithExt,
          type,
          vm.selectedSolution.uniqueName,
        );
        const resource = new WebResource(id, fullName, displayName || nameWithExt, type, fullName, true);
        resource.stringContent = " ";
        resource.originalContent = " ";
        vm.addWebResource(resource);
        onLog(`Created web resource: ${fullName}`, "success");
        onClose();
      } catch (err) {
        onLog(`Failed to create web resource: ${err}`, "error");
      } finally {
        setCreating(false);
      }
    }, [name, displayName, type, folder, vm, dvSvc, onLog, onClose]);

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
      <Dialog open={open} onOpenChange={handleOpenChange}>
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
              <Button appearance="primary" onClick={handleCreate} disabled={!name.trim() || creating}>
                {creating ? <Spinner size="extra-tiny" /> : "Create"}
              </Button>
              <Button appearance="secondary" onClick={onClose} disabled={creating}>
                Cancel
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    );
  },
);
