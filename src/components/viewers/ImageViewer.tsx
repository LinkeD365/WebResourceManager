import React, { useState } from "react";
import { WebResource } from "../../model/viewModel";
import { Button, Slider, tokens } from "@fluentui/react-components";
import { Copy24Regular } from "@fluentui/react-icons";

interface ImageViewerProps {
  resource: WebResource;
}

const getImageType = (type: number): string => {
  const typeMap: { [key: number]: string } = {
    5: "png",
    6: "jpg",
    7: "gif",
  };
  return typeMap[type] || "image";
};

const getImageMimeType = (type: number): string => {
  const typeMap: { [key: number]: string } = {
    5: "image/png",
    6: "image/jpeg",
    7: "image/gif",
  };
  return typeMap[type] || "image/*";
};

const copyToClipboard = (content: string) => {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(content);
  }
};

export const ImageViewer: React.FC<ImageViewerProps> = ({ resource }) => {
  const [scale, setScale] = useState<number>(100);
  const imageType = getImageType(resource.type);
  const imageMimeType = getImageMimeType(resource.type);

  if (!resource.stringContent) {
    return <p>No image content available</p>;
  }

  const imageDataUrl = `data:${imageMimeType};base64,${resource.stringContent}`;

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
        <span style={{ fontSize: "12px", fontWeight: 600, color: tokens.colorNeutralForeground1 }}>
          {imageType.toUpperCase()}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, maxWidth: "200px" }}>
          <Slider
            value={scale}
            onChange={(_, data) => setScale(data.value)}
            min={25}
            max={400}
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
          <img
            src={imageDataUrl}
            alt={`${imageType} preview`}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              display: "block",
            }}
          />
        </div>
      </div>
    </div>
  );
};
