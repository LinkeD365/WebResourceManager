import React, { useState } from "react";
import { WebResource } from "../../model/viewModel";
import { Button, Slider, tokens } from "@fluentui/react-components";
import { Copy24Regular } from "@fluentui/react-icons";

interface SvgViewerProps {
  resource: WebResource;
}

const copyToClipboard = (content: string) => {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(content);
  }
};

export const SvgViewer: React.FC<SvgViewerProps> = ({ resource }) => {
  const [scale, setScale] = useState<number>(200);

  if (!resource.stringContent) {
    return <p>No SVG content available</p>;
  }

  return (
    <div
      style={{
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        borderRadius: "4px",
        overflow: "hidden",
        marginTop: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          backgroundColor: tokens.colorNeutralBackground2,
          borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
          gap: "12px",
        }}
      >
        <span style={{ fontSize: "12px", fontWeight: 600, color: tokens.colorNeutralForeground1 }}>SVG</span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, maxWidth: "200px" }}>
          <Slider
            value={scale}
            onChange={(_, data) => setScale(data.value)}
            min={25}
            max={800}
            step={25}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: "11px", color: tokens.colorNeutralForeground2, minWidth: "40px" }}>{scale}%</span>
        </div>
        <Button
          appearance="subtle"
          size="small"
          icon={<Copy24Regular />}
          onClick={() => copyToClipboard(resource.stringContent || "")}
        />
      </div>
      <div
        style={{
          height: "400px",
          marginTop: "0",
          padding: "16px",
          backgroundColor: tokens.colorNeutralBackground1,
          overflow: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            transform: `scale(${scale / 100})`,
            transformOrigin: "center",
            transition: "transform 0.2s ease-out",
          }}
        >
          <div
            dangerouslySetInnerHTML={{ __html: resource.stringContent }}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
            }}
          />
        </div>
      </div>
    </div>
  );
};
