import React, { useState, useRef } from "react";
import { WebResource } from "../../model/viewModel";
import AceEditor from "react-ace";
import type { IAceEditor } from "react-ace/lib/types";
import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/mode-css";
import "ace-builds/src-noconflict/mode-html";
import "ace-builds/src-noconflict/mode-xml";
import "ace-builds/src-noconflict/theme-chrome";
import "ace-builds/src-noconflict/theme-monokai";
// @ts-ignore
import beautify from "js-beautify";

const beautifyHtml = beautify.html;
const beautifyCss = beautify.css;
const beautifyJs = beautify.js;

interface CodeViewerProps {
  resource: WebResource;
}

const getModeFromType = (type: number): string => {
  const modeMap: { [key: number]: string } = {
    1: "html",
    2: "css",
    3: "javascript",
    4: "xml",
    9: "xsl",
  };
  return modeMap[type] || "text";
};

export const prettifyCode = (code: string, type: number): string => {
  try {
    if (type === 1) {
      return beautifyHtml(code, { indent_size: 2 });
    } else if (type === 2) {
      return beautifyCss(code, { indent_size: 2 });
    } else if (type === 3) {
      return beautifyJs(code, { indent_size: 2 });
    } else {
      return code;
    }
  } catch (err) {
    console.error("Beautify error:", err);
    return code;
  }
};

const getCurrentTheme = (): string => {
  const dataTheme = document.body.getAttribute("data-theme");
  const isDark = dataTheme === "dark";
  return isDark ? "monokai" : "chrome";
};

export const CodeViewer: React.FC<CodeViewerProps> = ({ resource }) => {
  const mode = getModeFromType(resource.type);
  const [formattedContent, setFormattedContent] = useState<string | null>(null);
  const theme = getCurrentTheme();
  const editorRef = useRef<IAceEditor | null>(null);

  const handleEditorChange = (newContent: string) => {
    setFormattedContent(newContent);
    resource.stringContent = newContent;
  };

  const displayContent = formattedContent || resource.stringContent;

  if (!resource.stringContent) {
    return <p>No content available</p>;
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {!resource.isCustomizable && (
        <div style={{ padding: "6px 12px", fontSize: "12px", fontStyle: "italic", color: "#888" }}>
          This file is not customizable
        </div>
      )}
      <AceEditor
        mode={mode}
        theme={theme}
        value={displayContent || ""}
        onChange={handleEditorChange}
        readOnly={!resource.isCustomizable || resource.isSaving}
        onLoad={(editor) => {
          editorRef.current = editor;
        }}
        width="100%"
        height="100%"
        fontSize={12}
        showPrintMargin={false}
        setOptions={{
          useWorker: false,
          displayIndentGuides: true,
        }}
      />
    </div>
  );
};
