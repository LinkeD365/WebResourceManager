import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react";
import { WebResource } from "../../model/viewModel";
import { ViewModel } from "../../model/viewModel";
import { tokens } from "@fluentui/react-components";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, type ColDef } from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

let nextEntryId = 1;

interface ResxEntry {
  _id: number;
  key: string;
  value: string;
  comment: string;
  isNew?: boolean;
}

const parseResx = (xml: string): ResxEntry[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  const dataElements = doc.querySelectorAll("data");
  const entries: ResxEntry[] = [];

  dataElements.forEach((dataEl) => {
    const key = dataEl.getAttribute("name") || "";
    const valueEl = dataEl.querySelector("value");
    const commentEl = dataEl.querySelector("comment");
    entries.push({
      _id: nextEntryId++,
      key,
      value: valueEl?.textContent || "",
      comment: commentEl?.textContent || "",
    });
  });

  return entries;
};

const serializeResx = (entries: ResxEntry[], originalXml: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(originalXml, "application/xml");

  // Remove all existing <data> elements
  const existingData = doc.querySelectorAll("data");
  existingData.forEach((el) => el.parentNode?.removeChild(el));

  const root = doc.documentElement;

  entries.forEach((entry) => {
    const dataEl = doc.createElement("data");
    dataEl.setAttribute("name", entry.key);
    dataEl.setAttribute("xml:space", "preserve");

    const valueEl = doc.createElement("value");
    valueEl.textContent = entry.value;
    dataEl.appendChild(valueEl);

    if (entry.comment) {
      const commentEl = doc.createElement("comment");
      commentEl.textContent = entry.comment;
      dataEl.appendChild(commentEl);
    }

    root.appendChild(dataEl);
  });

  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
};

interface ResxViewerProps {
  resource: WebResource;
  vm: ViewModel;
}

export const ResxViewer: React.FC<ResxViewerProps> = observer(({ resource, vm }) => {
  const [entries, setEntries] = useState<ResxEntry[]>(() =>
    resource.stringContent ? parseResx(resource.stringContent) : [],
  );

  const isReadOnly = !resource.isCustomizable || resource.isSaving;
  const lastTriggerRef = useRef(vm.resxAddRowTrigger);
  const gridRef = useRef<AgGridReact>(null);
  const newRowIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (vm.resxAddRowTrigger > lastTriggerRef.current) {
      lastTriggerRef.current = vm.resxAddRowTrigger;
      const newId = nextEntryId++;
      newRowIdRef.current = newId;
      setEntries((prev) => {
        const updated = [...prev, { _id: newId, key: "", value: "", comment: "", isNew: true }];
        if (resource.stringContent) {
          resource.stringContent = serializeResx(updated, resource.originalContent || resource.stringContent);
        }
        return updated;
      });
    }
  }, [vm.resxAddRowTrigger]);

  useEffect(() => {
    if (newRowIdRef.current === null) return;
    const api = gridRef.current?.api;
    if (!api) return;
    const rowNode = api.getRowNode(String(newRowIdRef.current));
    if (rowNode) {
      api.ensureNodeVisible(rowNode, "bottom");
      api.startEditingCell({ rowIndex: rowNode.rowIndex!, colKey: "key" });
      newRowIdRef.current = null;
    }
  }, [entries]);

  const handleCellValueChanged = useCallback(() => {
    // AG Grid already mutated the row data in-place; just serialize to XML
    if (resource.stringContent) {
      resource.stringContent = serializeResx(entries, resource.originalContent || resource.stringContent);
    }
  }, [entries, resource]);

  const getRowId = useCallback((params: any) => String(params.data._id), []);

  const columnDefs = useMemo<ColDef<ResxEntry>[]>(
    () => [
      {
        field: "key",
        headerName: "Name",
        editable: (params) => !isReadOnly && !!params.data?.isNew,
        minWidth: 150,
        flex: 1,
        sortable: true,
      },
      {
        field: "value",
        headerName: "Value",
        editable: !isReadOnly,
        minWidth: 200,
        flex: 1.5,
        sortable: true,
      },
      {
        field: "comment",
        headerName: "Comment",
        editable: false,
        minWidth: 150,
        flex: 1,
        sortable: true,
      },
    ],
    [isReadOnly],
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      resizable: true,
      wrapText: true,
      autoHeight: true,
    }),
    [],
  );

  if (!resource.stringContent) {
    return <p>No content available</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: tokens.spacingVerticalS }}>
      <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
        <AgGridReact<ResxEntry>
          ref={gridRef}
          rowData={entries}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={getRowId}
          onCellValueChanged={handleCellValueChanged}
          quickFilterText={vm.resxSearchFilter}
          enableCellTextSelection
          singleClickEdit
          stopEditingWhenCellsLoseFocus
        />
      </div>
    </div>
  );
});
