import { describe, it, expect } from "vitest";

import {
  findVariables,
  substituteVariables,
  rememberValues,
  rememberedValues,
} from "../../src/utils/templates";

describe("шаблоны с переменными (10.2)", () => {
  it("находит переменные в порядке появления, без повторов", () => {
    const html = "<p>{{task}} и {{ lang }} и снова {{task}}, {{язык}}</p>";
    expect(findVariables(html)).toEqual(["task", "lang", "язык"]);
  });

  it("не находит переменных в обычном тексте", () => {
    expect(findVariables("<p>просто текст {в фигурных} скобках</p>")).toEqual(
      [],
    );
  });

  it("подставляет значения с экранированием HTML", () => {
    const html = "<p>Задача: {{task}}</p>";
    expect(substituteVariables(html, { task: "<b>текст</b> & Co" })).toBe(
      "<p>Задача: &lt;b&gt;текст&lt;/b&gt; &amp; Co</p>",
    );
  });

  it("оставляет незаполненные переменные как есть", () => {
    const html = "<p>{{task}} / {{lang}}</p>";
    expect(substituteVariables(html, { task: "X" })).toBe(
      "<p>X / {{lang}}</p>",
    );
  });

  it("помнит значения в пределах сессии", () => {
    rememberValues({ task: "Перевести README" });
    expect(rememberedValues(["task", "lang"])).toEqual({
      task: "Перевести README",
    });
  });
});
