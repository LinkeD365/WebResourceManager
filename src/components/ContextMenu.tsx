import React from "react";
import { createPortal } from "react-dom";
import { tokens, useThemeClassName } from "@fluentui/react-components";
import { AddRegular, ArrowClockwiseRegular, FolderAddRegular, RenameRegular } from "@fluentui/react-icons";

interface ContextMenuProps {
  target: { x: number; y: number };
  onClose: () => void;
  onNewResource?: () => void;
  onNewSubfolder?: () => void;
  newSubfolderLabel?: string;
  onRename?: () => void;
  onRefresh?: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  target,
  onClose,
  onNewResource,
  onNewSubfolder,
  newSubfolderLabel = "New Subfolder",
  onRename,
  onRefresh,
}) => {
  const themeClassName = useThemeClassName();

  return createPortal(
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9999 }}
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        className={themeClassName}
        style={{
          position: "fixed",
          left: target.x,
          top: target.y,
          zIndex: 10000,
          width: "fit-content",
          height: "fit-content",
          backgroundColor: tokens.colorNeutralBackground1,
          border: `1px solid ${tokens.colorNeutralStroke1}`,
          borderRadius: "4px",
          boxShadow: tokens.shadow8,
          padding: "4px 0",
          minWidth: "160px",
        }}
      >
        {onNewResource && (
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
              padding: "6px 12px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: "13px",
              color: tokens.colorNeutralForeground1,
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = tokens.colorNeutralBackground1Hover)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            onClick={onNewResource}
          >
            <AddRegular />
            New Resource
          </button>
        )}
        {onNewSubfolder && (
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
              padding: "6px 12px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: "13px",
              color: tokens.colorNeutralForeground1,
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = tokens.colorNeutralBackground1Hover)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            onClick={onNewSubfolder}
          >
            <FolderAddRegular />
            {newSubfolderLabel}
          </button>
        )}
        {onRename && (
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
              padding: "6px 12px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: "13px",
              color: tokens.colorNeutralForeground1,
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = tokens.colorNeutralBackground1Hover)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            onClick={onRename}
          >
            <RenameRegular />
            Rename
          </button>
        )}
        {onRefresh && (
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
              padding: "6px 12px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: "13px",
              color: tokens.colorNeutralForeground1,
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = tokens.colorNeutralBackground1Hover)}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            onClick={onRefresh}
          >
            <ArrowClockwiseRegular />
            Refresh
          </button>
        )}
      </div>
    </>,
    document.body,
  );
};
