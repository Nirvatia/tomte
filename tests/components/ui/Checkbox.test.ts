// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import "@testing-library/jest-dom/vitest";
import { createRawSnippet } from "svelte";
import Checkbox from "../../../src/components/ui/Checkbox.svelte";

/**
 * Хелпер для создания текстового snippet в тестах.
 * Позволяет не создавать отдельные .svelte-компоненты-обёртки.
 */
function createTextSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe("Checkbox", () => {
  describe("Рендеринг состояний", () => {
    it("рендерится в unchecked состоянии по умолчанию", () => {
      render(Checkbox);

      const input = screen.getByRole("checkbox");

      expect(input).not.toBeChecked();
    });

    it("рендерится в checked состоянии при передаче checked=true", () => {
      render(Checkbox, {
        props: {
          checked: true,
        },
      });

      const input = screen.getByRole("checkbox");

      expect(input).toBeChecked();
    });

    it("отображает SVG-галочку когда checked=true", () => {
      const { container } = render(Checkbox, {
        props: {
          checked: true,
        },
      });

      const polyline = container.querySelector("polyline");

      expect(polyline).toBeInTheDocument();
      expect(polyline?.getAttribute("points")).toBe("3.5 8.5 6.5 11.5 12.5 4.5");
    });

    it("отображает SVG-линию когда indeterminate=true", () => {
      const { container } = render(Checkbox, {
        props: {
          indeterminate: true,
        },
      });

      const line = container.querySelector("line");

      expect(line).toBeInTheDocument();
      expect(line?.getAttribute("x1")).toBe("4");
      expect(line?.getAttribute("x2")).toBe("12");
    });

    it("не отображает иконки, когда checked=false и indeterminate=false", () => {
      const { container } = render(Checkbox);

      const svg = container.querySelector("svg");

      expect(svg).toBeNull();
    });

    it("устанавливает свойство indeterminate на HTMLInputElement", async () => {
      render(Checkbox, {
        props: {
          indeterminate: true,
        },
      });

      const input = screen.getByRole("checkbox") as HTMLInputElement;

      // Ждём, пока $effect отработает
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(input.indeterminate).toBe(true);
    });
  });

  describe("Взаимодействие и события", () => {
    it("вызывает onToggle при клике на чекбокс", async () => {
      const onToggle = vi.fn();

      render(Checkbox, {
        props: {
          onToggle,
        },
      });

      const input = screen.getByRole("checkbox");

      await fireEvent.click(input);

      expect(onToggle).toHaveBeenCalledTimes(1);
      expect(onToggle).toHaveBeenCalledWith(expect.any(Event));
    });

    it("не вызывает onToggle, когда компонент disabled", async () => {
      const onToggle = vi.fn();

      render(Checkbox, {
        props: {
          onToggle,
          disabled: true,
        },
      });

      const input = screen.getByRole("checkbox");

      await fireEvent.click(input);

      expect(onToggle).not.toHaveBeenCalled();
    });

    it("input имеет атрибут disabled при disabled=true", () => {
      render(Checkbox, {
        props: {
          disabled: true,
        },
      });

      const input = screen.getByRole("checkbox");

      expect(input).toBeDisabled();
    });
  });

  describe("Доступность (a11y)", () => {
    it("устанавливает aria-label при передаче ariaLabel", () => {
      render(Checkbox, {
        props: {
          ariaLabel: "Выбрать элемент",
        },
      });

      const input = screen.getByRole("checkbox");

      expect(input).toHaveAttribute("aria-label", "Выбрать элемент");
    });

    it("не устанавливает aria-label, если он пустой", () => {
      render(Checkbox, {
        props: {
          ariaLabel: "",
        },
      });

      const input = screen.getByRole("checkbox");

      expect(input).not.toHaveAttribute("aria-label");
    });

    it("устанавливает aria-disabled='true' на wrapper при disabled", () => {
      const { container } = render(Checkbox, {
        props: {
          disabled: true,
        },
      });

      const wrapper = container.querySelector(".checkbox-wrapper");

      expect(wrapper).toHaveAttribute("aria-disabled", "true");
    });

    it("добавляет класс checkbox-disabled к wrapper при disabled", () => {
      const { container } = render(Checkbox, {
        props: {
          disabled: true,
        },
      });

      const wrapper = container.querySelector(".checkbox-wrapper");

      expect(wrapper?.className).toContain("checkbox-disabled");
    });
  });

  describe("Children (Snippet)", () => {
    it("рендерит переданный children-snippet", () => {
      render(Checkbox, {
        props: {
          children: createTextSnippet("Текст лейбла"),
        },
      });

      expect(screen.getByText("Текст лейбла")).toBeInTheDocument();
    });

    it("оборачивает children в span с классом checkbox-label", () => {
      const { container } = render(Checkbox, {
        props: {
          children: createTextSnippet("Label"),
        },
      });

      const labelSpan = container.querySelector(".checkbox-label");

      expect(labelSpan).toBeInTheDocument();
      expect(labelSpan?.textContent).toBe("Label");
    });

    it("не рендерит контейнер для children, если children не передан", () => {
      const { container } = render(Checkbox);

      const labelSpan = container.querySelector(".checkbox-label");

      expect(labelSpan).toBeNull();
    });
  });
});