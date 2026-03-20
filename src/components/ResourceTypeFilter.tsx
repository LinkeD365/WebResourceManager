import React, { useCallback, useRef, useState } from "react";
import { observer } from "mobx-react";
import {
  Button,
  Checkbox,
  Input,
  Label,
  tokens,
  Popover,
  PopoverTrigger,
  PopoverSurface,
} from "@fluentui/react-components";
import { Settings24Regular } from "@fluentui/react-icons";
import { ViewModel } from "../model/viewModel";

interface TypeFilterSettings {
  type: number;
  label: string;
  description: string;
}

const typeFilters: TypeFilterSettings[] = [
  { type: 1, label: "HTML", description: "HTML files" },
  { type: 2, label: "CSS", description: "CSS files" },
  { type: 3, label: "JavaScript", description: "JavaScript files" },
  { type: 4, label: "XML", description: "XML files" },
  { type: 5, label: "PNG", description: "PNG images" },
  { type: 6, label: "JPG", description: "JPEG images" },
  { type: 7, label: "GIF", description: "GIF images" },
  { type: 9, label: "XSL", description: "XSL files" },
  { type: 11, label: "SVG", description: "SVG images" },
  { type: 12, label: "RESX", description: "RESX resource files" },
];

interface DraftState {
  types: Set<number>;
  loadManaged: boolean;
  showHidden: boolean;
  prefixFilter: string;
}

interface ResourceTypeFilterProps {
  vm: ViewModel;
}

export const ResourceTypeFilter: React.FC<ResourceTypeFilterProps> = observer(({ vm }) => {
  const [draft, setDraft] = useState<DraftState | null>(null);
  const draftRef = useRef<DraftState | null>(null);

  const current = draft ?? {
    types: vm.resourceTypeFilter,
    loadManaged: vm.loadManaged,
    showHidden: vm.showHidden,
    prefixFilter: vm.prefixFilter,
  };

  const isTypeChecked = (type: number) => current.types.has(type);
  const selectedCount = typeFilters.filter((f) => isTypeChecked(f.type)).length;
  const isAllSelected = selectedCount === typeFilters.length;
  const isMixed = selectedCount > 0 && selectedCount < typeFilters.length;
  const selectedLabels = typeFilters.filter((f) => isTypeChecked(f.type)).map((f) => f.label);
  const filterSummary = isAllSelected ? "All" : selectedLabels.length > 0 ? selectedLabels.join(", ") : "None";
  const managedLabel = current.loadManaged ? "Inc Mgd" : "Not Mgd";
  const hiddenLabel = current.showHidden ? "Inc Hdn" : "Not Hdn";

  const updateDraft = useCallback(
    (updater: (prev: DraftState) => DraftState) => {
      setDraft((prev) => {
        const base: DraftState =
          prev ?? {
            types: new Set(vm.resourceTypeFilter),
            loadManaged: vm.loadManaged,
            showHidden: vm.showHidden,
            prefixFilter: vm.prefixFilter,
          };
        const next = updater(base);
        draftRef.current = next;
        return next;
      });
    },
    [vm],
  );

  const handleOpenChange = useCallback(
    (_: any, data: { open: boolean }) => {
      if (data.open) {
        const initial: DraftState = {
          types: new Set(vm.resourceTypeFilter),
          loadManaged: vm.loadManaged,
          showHidden: vm.showHidden,
          prefixFilter: vm.prefixFilter,
        };
        draftRef.current = initial;
        setDraft(initial);
      } else {
        const d = draftRef.current;
        if (d) {
          // Apply type filter changes
          typeFilters.forEach((f) => {
            const inVm = vm.isTypeFilteredIn(f.type);
            const inDraft = d.types.has(f.type);
            if (inVm !== inDraft) vm.toggleTypeFilter(f.type);
          });
          vm.setLoadManaged(d.loadManaged);
          vm.setShowHidden(d.showHidden);
          vm.setPrefixFilter(d.prefixFilter);
          vm.buildWebResourceTree();
        }
        draftRef.current = null;
        setDraft(null);
      }
    },
    [vm],
  );

  const handleToggleAll = (nextChecked: boolean) => {
    updateDraft((prev) => {
      const types = new Set(prev.types);
      typeFilters.forEach((f) => {
        if (nextChecked) types.add(f.type);
        else types.delete(f.type);
      });
      return { ...prev, types };
    });
  };

  const handleTypeToggle = (type: number) => {
    updateDraft((prev) => {
      const types = new Set(prev.types);
      if (types.has(type)) types.delete(type);
      else types.add(type);
      return { ...prev, types };
    });
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalSNudge }}>
      <span style={{ fontSize: "9px", color: tokens.colorNeutralForeground3 }}>
        {filterSummary} · {managedLabel} · {hiddenLabel}
      </span>
      <Popover inline positioning="below-end" onOpenChange={handleOpenChange}>
        <PopoverTrigger disableButtonEnhancement>
          <Button appearance="subtle" icon={<Settings24Regular />} aria-label="Settings" />
        </PopoverTrigger>
        <PopoverSurface
          style={{
            backgroundColor: tokens.colorNeutralBackground1,
            padding: tokens.spacingVerticalM,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: tokens.spacingVerticalS,
              minWidth: "160px",
            }}
          >
            <div
              style={{
                paddingBottom: tokens.spacingVerticalS,
                borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
              }}
            >
              <Checkbox
                checked={isAllSelected ? true : isMixed ? "mixed" : false}
                onChange={(_, data) => handleToggleAll(!!data.checked)}
                label="All"
                style={{ fontWeight: 600 }}
              />
            </div>
            {typeFilters.map((filter) => (
              <Checkbox
                key={filter.type}
                checked={isTypeChecked(filter.type)}
                onChange={() => handleTypeToggle(filter.type)}
                label={filter.label}
              />
            ))}
            <div
              style={{
                paddingTop: tokens.spacingVerticalS,
                borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
                display: "flex",
                flexDirection: "column",
                gap: tokens.spacingVerticalXS,
              }}
            >
              <Checkbox
                checked={current.loadManaged}
                onChange={(_, data) => updateDraft((prev) => ({ ...prev, loadManaged: !!data.checked }))}
                label="Load Managed"
              />
              <Checkbox
                checked={current.showHidden}
                onChange={(_, data) => updateDraft((prev) => ({ ...prev, showHidden: !!data.checked }))}
                label="Show Hidden"
              />
              <Label size="small">Exclude prefixes (comma-separated)</Label>
              <Input
                size="small"
                placeholder="e.g. contoso_, fabrikam_"
                value={current.prefixFilter}
                onChange={(_, data) => updateDraft((prev) => ({ ...prev, prefixFilter: data.value }))}
              />
            </div>
          </div>
        </PopoverSurface>
      </Popover>
    </div>
  );
});
