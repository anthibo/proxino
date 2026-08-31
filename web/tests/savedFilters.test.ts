import { describe, it, expect, beforeEach } from "vitest";
import { listSaved, saveFilter, removeFilter, toggleFav } from "../src/savedFilters";

beforeEach(() => localStorage.clear());

describe("savedFilters", () => {
  it("save then list", () => {
    saveFilter("Errors", "status:>=400");
    expect(listSaved()).toEqual([{ name: "Errors", query: "status:>=400", fav: false }]);
  });
  it("upsert by name", () => {
    saveFilter("A", "x"); saveFilter("A", "y");
    expect(listSaved()).toHaveLength(1);
    expect(listSaved()[0].query).toBe("y");
  });
  it("toggle favorite and remove", () => {
    saveFilter("A", "x"); toggleFav("A");
    expect(listSaved()[0].fav).toBe(true);
    removeFilter("A");
    expect(listSaved()).toEqual([]);
  });
  it("corrupt storage yields empty list", () => {
    localStorage.setItem("proxino.savedFilters", "{bad");
    expect(listSaved()).toEqual([]);
  });
});
