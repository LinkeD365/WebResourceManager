import React, { useEffect } from "react";
import { observer } from "mobx-react";
import { ViewModel } from "../model/viewModel";
import { dvService } from "../services/dataverseService";
import {
  Button,
  TabList,
  Tab,
  tokens,
  Overflow,
  OverflowItem,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  makeStyles,
  useIsOverflowItemVisible,
  useOverflowMenu,
} from "@fluentui/react-components";
import {
  ChevronLeft24Regular,
  ChevronRight24Regular,
  Dismiss16Regular,
  MoreHorizontalRegular,
} from "@fluentui/react-icons";
import { CodeViewer } from "./viewers/CodeViewer";
import { SvgViewer } from "./viewers/SvgViewer";
import { ImageViewer } from "./viewers/ImageViewer";

interface WebResourceDetailsProps {
  vm: ViewModel;
  dvSvc: dvService;
  onLog: (message: string, type?: "info" | "success" | "warning" | "error") => void;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
}

const decodeBase64ToString = (value: string): string => {
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return value;
  }
};

const useOverflowMenuStyles = makeStyles({
  menu: {
    backgroundColor: tokens.colorNeutralBackground1,
  },
  menuPopover: {
    backgroundColor: tokens.colorNeutralBackground1,
    zIndex: 1000,
  },
  menuButton: {
    alignSelf: "center",
  },
});

interface OverflowMenuItemProps {
  tabId: string;
  tabName: string;
  onTabSelect: (tabId: string) => void;
}

const OverflowMenuItem = React.forwardRef<HTMLButtonElement, OverflowMenuItemProps>(
  ({ tabId, tabName, onTabSelect }, _ref) => {
    const isVisible = useIsOverflowItemVisible(tabId);

    if (isVisible) {
      return null;
    }

    return (
      <MenuItem key={tabId} onClick={() => onTabSelect(tabId)}>
        <div>{tabName}</div>
      </MenuItem>
    );
  },
);

OverflowMenuItem.displayName = "OverflowMenuItem";

interface OverflowMenuProps {
  tabs: Array<{ id: string; name: string; displayName?: string }>;
  onTabSelect: (tabId: string) => void;
}

const OverflowMenuTrigger = ({ tabs, onTabSelect }: OverflowMenuProps) => {
  const { ref, isOverflowing } = useOverflowMenu<HTMLButtonElement>();
  const styles = useOverflowMenuStyles();

  if (!isOverflowing) {
    return null;
  }

  return (
    <Menu hasIcons inline>
      <MenuTrigger disableButtonEnhancement>
        <Button
          appearance="transparent"
          className={styles.menuButton}
          ref={ref}
          icon={<MoreHorizontalRegular />}
          aria-label="More tabs"
          role="tab"
        />
      </MenuTrigger>
      <MenuPopover className={styles.menuPopover}>
        <MenuList className={styles.menu}>
          {tabs.map((tab) => (
            <OverflowMenuItem
              key={tab.id}
              tabId={tab.id}
              tabName={tab.displayName || tab.name}
              onTabSelect={onTabSelect}
            />
          ))}
        </MenuList>
      </MenuPopover>
    </Menu>
  );
};

export const WebResourceDetails = observer(
  ({ vm, dvSvc, onLog, drawerOpen, onToggleDrawer }: WebResourceDetailsProps): React.JSX.Element => {
    useEffect(() => {
      let isActive = true;
      const resource = vm.selectedResource;
      if (!resource || resource.stringContent) return;

      const loadContent = async () => {
        try {
          const base64 = await dvSvc.getWebResourceContent(resource.id);
          if (!isActive || !base64) return;
          // Keep binary image formats as base64, decode text types to UTF-8 string
          const isImage = [5, 6, 7].includes(resource.type);
          const decodedContent = isImage ? base64 : decodeBase64ToString(base64);
          resource.stringContent = decodedContent;
          resource.originalContent = decodedContent;
        } catch (err) {
          onLog(`Error loading web resource content: ${err}`, "error");
        }
      };

      loadContent();
      return () => {
        isActive = false;
      };
    }, [dvSvc, onLog, vm.selectedResource]);

    const handleTabSelect = (_: any, data: { value: unknown }) => {
      vm.setActiveTab(data.value as string);
    };

    const handleCloseTab = (e: React.MouseEvent, resourceId: string) => {
      e.stopPropagation();
      vm.closeTab(resourceId);
    };

    const handleOverflowMenuSelect = (tabId: string) => {
      vm.setActiveTab(tabId);
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div
          style={{
            paddingLeft: "16px",
            paddingRight: "16px",
            borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
            display: "flex",
            alignItems: "center",
            minWidth: 0,
          }}
        >
          <Button
            appearance="subtle"
            icon={drawerOpen ? <ChevronLeft24Regular /> : <ChevronRight24Regular />}
            aria-label={drawerOpen ? "Hide tree" : "Show tree"}
            onClick={onToggleDrawer}
          />
          {vm.openTabs.length > 0 && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <Overflow minimumVisible={1}>
                <TabList selectedValue={vm.activeTabId || undefined} onTabSelect={handleTabSelect} size="small">
                  {vm.openTabs.map((tab) => (
                    <OverflowItem key={tab.id} id={tab.id} priority={tab.id === vm.activeTabId ? 2 : 1}>
                      <Tab
                        value={tab.id}
                        icon={
                          <Button
                            appearance="subtle"
                            size="small"
                            icon={<Dismiss16Regular />}
                            onClick={(e) => handleCloseTab(e, tab.id)}
                            style={{ minWidth: "20px", padding: "2px" }}
                          />
                        }
                      >
                        {tab.displayName || tab.name}
                      </Tab>
                    </OverflowItem>
                  ))}
                  <OverflowMenuTrigger tabs={vm.openTabs} onTabSelect={handleOverflowMenuSelect} />
                </TabList>
              </Overflow>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          {vm.selectedResource ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", height: "100%" }}>
              {vm.selectedResource.stringContent !== null &&
                (() => {
                  const type = vm.selectedResource.type;
                  if (type === 11) return <SvgViewer resource={vm.selectedResource} />;
                  if ([5, 6, 7].includes(type)) return <ImageViewer resource={vm.selectedResource} />;
                  return <CodeViewer resource={vm.selectedResource} />;
                })()}
            </div>
          ) : (
            <p>Select a web resource to view details</p>
          )}
        </div>
      </div>
    );
  },
);
