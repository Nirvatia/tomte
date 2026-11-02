// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import "@testing-library/jest-dom/vitest";

import StatusBar from "../../../src/components/layout/StatusBar.svelte";
import {
  activeProject,
  editorHtml,
  selectedFileIds,
  selectedProjectFiles,
} from "../../../src/stores";
import { tokenLimitSetting } from "../../../src/lib/tokenLimit";
import type { Project } from "../../../src/types";

function project(attachmentContent = ""): Project {
  return {
    id: "p",
    name: "Проект",
    files: [],
    attachments: attachmentContent
      ? [
          {
            id: "a",
            name: "a.txt",
            size: 1,
            type: "text",
            content: attachmentContent,
          },
        ]
      : [],
    totalSize: 0,
    createdAt: "",
    updatedAt: "",
  };
}

const tokenButton = () => screen.getByRole("button", { name: /≈/ });

describe("StatusBar: токены", () => {
  beforeEach(() => {
    selectedFileIds.set(new Set());
    selectedProjectFiles.set([]);
    editorHtml.set("");
    tokenLimitSetting.set({ modelId: "custom", customTokens: 100 });
  });

  it("разбивает оценку на промпт и вложения", async () => {
    activeProject.set(project("x".repeat(40))); // ≈ 10 токенов
    selectedFileIds.set(new Set(["a"]));
    editorHtml.set(`<p>${"y".repeat(80)}</p>`); // ≈ 20 токенов
    render(StatusBar);

    await waitFor(() => expect(tokenButton()).toHaveTextContent("≈ 30 / 100"));
    await fireEvent.click(tokenButton());

    const panel = screen.getByRole("dialog", { name: "Токены и лимит модели" });
    expect(panel).toHaveTextContent(/Промпт\s*20/);
    expect(panel).toHaveTextContent(/Вложения\s*10/);
    expect(panel).toHaveTextContent(/Всего\s*30/);
  });

  it("жёлтый с 80% и красный при превышении", async () => {
    activeProject.set(project());
    editorHtml.set(`<p>${"y".repeat(340)}</p>`); // ≈ 85 токенов
    render(StatusBar);

    await waitFor(() => expect(tokenButton()).toHaveTextContent("85%"));
    expect(tokenButton().className).toContain("--warning");

    editorHtml.set(`<p>${"y".repeat(480)}</p>`); // ≈ 120 токенов
    await waitFor(() => expect(tokenButton().className).toContain("--error"));
    await fireEvent.click(tokenButton());
    expect(
      screen.getByText(/больше контекста модели на 20/),
    ).toBeInTheDocument();
  });

  it("смена модели меняет лимит", async () => {
    activeProject.set(project());
    render(StatusBar);
    await fireEvent.click(tokenButton());

    await fireEvent.change(screen.getByLabelText("Модель"), {
      target: { value: "claude-haiku" },
    });

    expect(tokenButton()).toHaveTextContent("/ 200K");
  });
});
