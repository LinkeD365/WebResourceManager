import React from "react";
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

interface ResourceTypeFilterProps {
  vm: ViewModel;
}

export const ResourceTypeFilter: React.FC<ResourceTypeFilterProps> = observer(({ vm }) => {
  const selectedCount = typeFilters.filter((f) => vm.isTypeFilteredIn(f.type)).length;
  const isAllSelected = selectedCount === typeFilters.length;
  const isMixed = selectedCount > 0 && selectedCount < typeFilters.length;
  const selectedLabels = typeFilters.filter((f) => vm.isTypeFilteredIn(f.type)).map((f) => f.label);
  const filterSummary = isAllSelected ? "All" : selectedLabels.length > 0 ? selectedLabels.join(", ") : "None";

  const handleToggleAll = (nextChecked: boolean) => {
    if (!nextChecked) {
      typeFilters.forEach((f) => {
        if (vm.isTypeFilteredIn(f.type)) {
          vm.toggleTypeFilter(f.type);
        }
      });
    } else {
      typeFilters.forEach((f) => {
        if (!vm.isTypeFilteredIn(f.type)) {
          vm.toggleTypeFilter(f.type);
        }
      });
    }
    vm.buildWebResourceTree();
  };

  const handleTypeToggle = (type: number) => {
    vm.toggleTypeFilter(type);
    vm.buildWebResourceTree();
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalSNudge }}>
      <span style={{ fontSize: "9px", color: tokens.colorNeutralForeground3 }}>{filterSummary}</span>
      <Popover inline positioning="below-end">
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
                checked={vm.isTypeFilteredIn(filter.type)}
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
                checked={vm.loadManaged}
                onChange={(_, data) => vm.setLoadManaged(!!data.checked)}
                label="Load Managed"
              />
              <Label size="small">Exclude prefixes (comma-separated)</Label>
              <Input
                size="small"
                placeholder="e.g. contoso_, fabrikam_"
                value={vm.prefixFilter}
                onChange={(_, data) => vm.setPrefixFilter(data.value)}
              />
            </div>
          </div>
        </PopoverSurface>
      </Popover>
    </div>
  );
});
