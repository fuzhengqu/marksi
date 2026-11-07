import { describe, expect, it } from "vitest";
import {
  isTaskMarker,
  taskMarkerChecked,
  toggleTaskMarker,
} from "../src/lib/taskList";

describe("task list markers", () => {
  it("recognizes unchecked, checked, and uppercase markers", () => {
    expect(isTaskMarker("[ ]")).toBe(true);
    expect(isTaskMarker("[x]")).toBe(true);
    expect(isTaskMarker("[X]")).toBe(true);
    expect(isTaskMarker("[y]")).toBe(false);
    expect(isTaskMarker("[]")).toBe(false);
    expect(isTaskMarker("[  ]")).toBe(false);
  });

  it("reads the checked state", () => {
    expect(taskMarkerChecked("[ ]")).toBe(false);
    expect(taskMarkerChecked("[x]")).toBe(true);
    expect(taskMarkerChecked("[X]")).toBe(true);
  });

  it("toggles only valid three-character markers", () => {
    expect(toggleTaskMarker("[ ]")).toBe("[x]");
    expect(toggleTaskMarker("[x]")).toBe("[ ]");
    expect(toggleTaskMarker("[X]")).toBe("[ ]");
    expect(toggleTaskMarker("[y]")).toBeNull();
    expect(toggleTaskMarker("[ ] extra")).toBeNull();
  });
});
