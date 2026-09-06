// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
} from "@testing-library/svelte";
import "@testing-library/jest-dom/vitest";
import { tick } from "svelte";
import { get } from "svelte/store";
import ProjectTreeSidebar from "../../../src/components/project-tree/ProjectTreeSidebar.svelte";
import {
  activeProject,
  isProjectTreeOpen,
  previewFileFromTree,
  projectTreeNodes,
} from "../../../src/stores";

vi.mock("$app/environment", () => ({
  browser: true,
}));

vi.mock("$lib/actions/dropzone", () => ({
  dropzone: vi.fn(() => ({})),
}));

vi.mock("$lib/actions/directoryPicker", () => ({
  directoryPicker: vi.fn(() => ({})),
}));

vi.mock("../../../src/stores/confirm", () => ({
  requestConfirm: vi.fn(),
  requestAlert: vi.fn(),
}));

vi.mock("../../../src/utils/files", () => ({
  processFile: vi.fn(),
}));

vi.mock("../../../src/utils/index", () => ({
  getErrorMessage: vi.fn((_error, fallback) => fallback),
  pluralize: vi.fn(() => "файл"),
}));

vi.mock("../../../src/utils/github", () => ({
  fetchGithubFileContent: vi.fn(),
}));

vi.mock("../../../src/utils/projectActions", () => ({
  addAttachmentsToProject: vi.fn(),
  removeAttachmentFromProject: vi.fn(),
  removeAttachmentsFromProject: vi.fn(),
  clearGithubConfig: vi.fn(),
  restoreGithubTree: vi.fn(),
  setProjectTreeSource: vi.fn(),
  createPromptFile: vi.fn(),
  deletePromptFile: vi.fn(),
  pinPromptFile: vi.fn(),
  previewPromptFile: vi.fn(),
  renamePromptFile: vi.fn(),
}));

vi.mock("../../../src/utils/projectTree", () => ({
  calculateStats: vi.fn(() => ({
    totalFiles: 0,
    totalDirs: 0,
    rootName: "",
  })),
  hasFileSystemAccess: vi.fn(() => false),
  readDirectoryRecursive: vi.fn(),
  readDirectoryViaInput: vi.fn(),
}));

vi.mock(
  "../../../src/components/attachments/FileItem.svelte",
  async () => {
    const { default: FileItemMock } = await import(
      "../../mocks/FileItem.mock.svelte"
    );

    return {
      default: FileItemMock,
    };
  },
);

vi.mock(
  "../../../src/components/attachments/FilePreviewModal.svelte",
  async () => {
    const { default: FilePreviewModalMock } = await import(
      "../../mocks/FilePreviewModal.mock.svelte"
    );

    return {
      default: FilePreviewModalMock,
    };
  },
);

vi.mock(
  "../../../src/components/project-tree/GithubConnectModal.svelte",
  async () => {
    const { default: GithubConnectModalMock } = await import(
      "../../mocks/GithubConnectModal.mock.svelte"
    );

    return {
      default: GithubConnectModalMock,
    };
  },
);

describe("ProjectTreeSidebar", () => {
  beforeEach(() => {
    localStorage.clear();

    activeProject.set(null);
    projectTreeNodes.set([]);
    previewFileFromTree.set(null);
    isProjectTreeOpen.set(true);

    vi.clearAllMocks();
  });

  it("рендерит основные секции", async () => {
    render(ProjectTreeSidebar);

    expect(await screen.findByText("Explorer")).toBeInTheDocument();

    expect(screen.getAllByText("Prompts").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Attachments").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Project").length).toBeGreaterThan(0);
  });

  it("показывает кнопку изменения ширины, когда панель открыта", () => {
    render(ProjectTreeSidebar);

    expect(
      screen.getByRole("button", {
        name: "Изменить ширину панели",
      }),
    ).toBeInTheDocument();
  });

  it("закрывает панель по Escape", async () => {
    isProjectTreeOpen.set(true);

    render(ProjectTreeSidebar);

    await fireEvent.keyDown(window, { key: "Escape" });

    expect(get(isProjectTreeOpen)).toBe(false);
  });

  it("восстанавливает ширину панели из localStorage", async () => {
    localStorage.setItem("projectTreeWidth", "350");

    const { container } = render(ProjectTreeSidebar);

    await tick();

    const aside = container.querySelector("aside");

    expect(aside?.getAttribute("style")).toContain("width: 350px");
  });
});