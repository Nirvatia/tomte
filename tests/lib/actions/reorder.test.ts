import { describe, it, expect } from "vitest";

import { moveId } from "../../../src/lib/actions/reorder";

describe("moveId", () => {
  const ids = ["a", "b", "c", "d"];

  it("переносит перед целью и после неё", () => {
    expect(moveId(ids, "d", "b", "before")).toEqual(["a", "d", "b", "c"]);
    expect(moveId(ids, "a", "c", "after")).toEqual(["b", "c", "a", "d"]);
  });

  it("крайние позиции", () => {
    expect(moveId(ids, "c", "a", "before")).toEqual(["c", "a", "b", "d"]);
    expect(moveId(ids, "a", "d", "after")).toEqual(["b", "c", "d", "a"]);
  });

  it("на себя или на неизвестную цель — без изменений", () => {
    expect(moveId(ids, "b", "b", "after")).toBe(ids);
    expect(moveId(ids, "b", "zzz", "after")).toBe(ids);
  });

  it("элемент, которого не было в списке (вкладка предпросмотра), добавляется", () => {
    expect(moveId(["a", "b"], "p", "a", "after")).toEqual(["a", "p", "b"]);
  });
});
