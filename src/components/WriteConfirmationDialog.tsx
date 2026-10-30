import React, { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  MessageBar,
  MessageBarBody,
} from "@fluentui/react-components";

export interface WriteReviewTarget {
  id: string;
  name: string;
  url: string;
  environment: string;
}

export const isSameWriteTarget = (
  connection: ToolBoxAPI.DataverseConnection | null | undefined,
  target: WriteReviewTarget,
): boolean => {
  const normalizeUrl = (url: string) => url.replace(/\/+$/, "").toLowerCase();
  return (
    connection?.id === target.id &&
    normalizeUrl(connection.url) === normalizeUrl(target.url) &&
    connection.environment === target.environment
  );
};

interface WriteConfirmationDialogProps {
  open: boolean;
  title: string;
  actionLabel: string;
  target: WriteReviewTarget;
  connectionMatches: boolean;
  changes: string[];
  rollbackNotice: string;
  requiresBackup?: boolean;
  onExportBackup?: () => Promise<string | null>;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  onCancelBusy?: () => void;
  isBusy?: boolean;
}

export const WriteConfirmationDialog: React.FC<WriteConfirmationDialogProps> = ({
  open,
  title,
  actionLabel,
  target,
  connectionMatches,
  changes,
  rollbackNotice,
  requiresBackup = false,
  onExportBackup,
  onConfirm,
  onClose,
  onCancelBusy,
  isBusy = false,
}) => {
  const [backupPath, setBackupPath] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setBackupPath(null);
      setBackupError(null);
    }
  }, [open, target.id, changes.join("|")]);

  const exportBackup = async () => {
    if (!onExportBackup) return;
    setBackupError(null);
    try {
      const path = await onExportBackup();
      if (path) {
        setBackupPath(path);
      } else {
        setBackupError("No backup was saved. The Dataverse change has not been made.");
      }
    } catch (error) {
      setBackupError(`Backup export failed. The Dataverse change has not been made. ${String(error)}`);
    }
  };

  const handleClose = () => {
    if (isBusy) {
      onCancelBusy?.();
      return;
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && handleClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent>
            <dl>
              <dt>
                <strong>Target environment</strong>
              </dt>
              <dd>
                {target.name} ({target.environment})
              </dd>
              <dt>
                <strong>Environment URL</strong>
              </dt>
              <dd>{target.url}</dd>
              <dt>
                <strong>Scope</strong>
              </dt>
              <dd>
                <ul>
                  {changes.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              </dd>
            </dl>
            <MessageBar intent="warning">
              <MessageBarBody>{rollbackNotice}</MessageBarBody>
            </MessageBar>
            {!connectionMatches && (
              <MessageBar intent="error">
                <MessageBarBody>
                  The active connection changed after this review. Cancel and review the operation against the new
                  connection.
                </MessageBarBody>
              </MessageBar>
            )}
            {requiresBackup && (
              <div>
                <p>Export the current resource before replacing its content. The write stays disabled until export succeeds.</p>
                {backupPath ? (
                  <p role="status">Backup saved to: {backupPath}</p>
                ) : (
                  <Button onClick={exportBackup} disabled={isBusy}>
                    Export backup
                  </Button>
                )}
                {backupError && <p role="alert">{backupError}</p>}
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              appearance="primary"
              onClick={() => void onConfirm()}
              disabled={
                isBusy ||
                !connectionMatches ||
                (requiresBackup && !backupPath)
              }
            >
              {actionLabel}
            </Button>
            <Button
              appearance="secondary"
              onClick={handleClose}
              disabled={isBusy && !onCancelBusy}
            >
              {isBusy && onCancelBusy ? "Cancel operation" : "Cancel"}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
