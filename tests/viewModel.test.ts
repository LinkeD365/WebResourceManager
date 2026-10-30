import { describe, expect, it } from "vitest";
import { SolutionMeta, ViewModel, WebResource } from "../src/model/viewModel";

const resource = (id: string, name: string, type = 3) =>
  new WebResource(id, name, name, type, name, true);

describe("ViewModel", () => {
  it("filters resources by type, name, display name, and path", () => {
    const vm = new ViewModel();
    const script = resource("1", "folder/sample.js");
    script.displayName = "Sample app";
    vm.setWebResources([script, resource("2", "folder/style.css", 2)]);
    vm.setSearchFilter("sample");

    expect(vm.getFilteredWebResources()).toEqual([script]);
    vm.toggleTypeFilter(3);
    expect(vm.getFilteredWebResources()).toEqual([]);
  });

  it("builds sorted nested folders and includes virtual folders", () => {
    const vm = new ViewModel();
    vm.setWebResources([resource("2", "z.js"), resource("1", "folder/a.js")]);
    vm.addVirtualFolder("empty/nested");

    expect(vm.webResourceTree.map((node) => node.label)).toEqual(["empty", "folder", "z.js"]);
    expect(vm.webResourceTree[0].children?.[0].label).toBe("nested");
    expect(vm.webResourceTree[1].children?.[0].webResource?.id).toBe("1");
  });

  it("keeps tabs unique and selects the nearest remaining tab when closing", () => {
    const vm = new ViewModel();
    const first = resource("1", "first.js");
    const second = resource("2", "second.js");
    const third = resource("3", "third.js");

    vm.openTab(first);
    vm.openTab(second);
    vm.openTab(third);
    vm.openTab(second);
    vm.closeTab("2");

    expect(vm.openTabs).toHaveLength(2);
    expect(vm.activeTabId).toBe("1");
    expect(vm.selectedResource).toBe(first);
    vm.closeTab("3");
    expect(vm.selectedResource).toBe(first);
  });

  it("tracks dirty and saved-but-unpublished states", () => {
    const item = resource("1", "file.js");
    item.stringContent = "changed";
    item.originalContent = "original";
    expect(item.isDirty).toBe(true);

    item.markClean();
    expect(item.isDirty).toBe(false);
    expect(item.isSavedNotPublished).toBe(true);
    item.markPublished();
    expect(item.isSavedNotPublished).toBe(false);
  });

  it("tracks prefixes, solution selection, and virtual-folder insertion", () => {
    const vm = new ViewModel();
    const solution = new SolutionMeta("Sample", "sample", "solution-id", false);
    vm.setSolutions([solution]);
    vm.selectedSolution = solution;
    vm.setPrefixFilter("abc_, def_, ");
    const item = resource("1", "new.js");
    vm.addWebResource(item);

    expect(vm.getPrefixes()).toEqual(["abc_", "def_"]);
    expect(vm.selectedSolution?.id).toBe("solution-id");
    expect(vm.selectedResource).toBe(item);
  });
});
