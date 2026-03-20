# Web Resource Manager

A [Power Platform ToolBox](https://powerplatformtoolbox.com) tool for browsing, editing, and publishing Dataverse web resources.

## Features

### Solution Browser

- Select from available unmanaged solutions
- Hierarchical tree view of web resources organised by folder path
- Resizable side panel (220–600px) with expand/collapse toggle
- Full-text search across resource names and paths (with 300ms debounce)

### Multi-Tab Editor

- Open multiple resources in tabs simultaneously
- Tab overflow menu when space is limited — active tab is always visible
- Closing a tab auto-switches to the nearest remaining tab
- Close button positioned on the right side of each tab

### Format-Specific Viewers

| Type  | Formats                         | Viewer        | Capabilities                                                                                                                                   |
| ----- | ------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Code  | HTML, CSS, JavaScript, XML, XSL | Ace Editor    | Syntax highlighting, line numbers, light/dark theme                                                                                            |
| Image | PNG, JPEG, GIF                  | Image preview | Zoom (25–400%), copy base64 to clipboard                                                                                                       |
| SVG   | SVG                             | Inline render | Zoom (25–800%), copy source to clipboard                                                                                                       |
| RESX  | RESX                            | Data grid     | Editable Name/Value columns, read-only Comment column (text selectable for copying), add rows, sortable, resizable & wrapping columns         |

### Resource Actions

- **Save** — save content to Dataverse without publishing
- **Save & Publish** — save and publish in a single action
- **Upload** — replace resource content from a local file (validates file extension)
- **Download** — export resource to a local file with correct extension and MIME type
- **Prettify** — format HTML, CSS, or JavaScript 
- **Minify** — minify HTML or JavaScript 
- **Edit Resources** - Modify resource files
- **Refresh** — reload the resource content from Dataverse, discarding any unsaved local changes

All editing actions are disabled for non-customizable (managed layer) resources.

### Context Menu (Tree View)

Right-click any item in the tree to access contextual actions:

- **New Resource** — create a new web resource under the selected folder
- **New Subfolder / New Root Folder** — add a virtual folder to organise resources
- **Rename** — rename a resource or folder (including bulk-rename of all resources within)
- **Refresh** — reload the selected resource's content from Dataverse

### Filtering

- **Resource types** — toggle individual types on/off (HTML, CSS, JS, XML, PNG, JPG, GIF, XSL, SVG, RESX)
- **Managed resources** — include or exclude managed resources
- **Hidden resources** — include or exclude hidden resources
- **Prefix exclusion** — comma-separated prefixes to exclude (default: `msdyn_`, `adx_`, `cc_MscrmControls`)
- Active filter summary displayed in the toolbar (e.g. _All · Not Mgd · Not Hdn_)

## License

MIT
