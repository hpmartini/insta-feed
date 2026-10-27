import { describe, expect, test } from "bun:test";
import { typewriterFrames } from "./typewriter";

describe("typewriterFrames", () => {
  test("yields increasing prefixes", () => {
    const frames = [...typewriterFrames("Hallo Welt")];
    expect(frames.length).toBe(10);
    frames.forEach((f, i) => {
      expect(f.length).toBe(i + 1);
      if (i > 0) expect(f.startsWith(frames[i - 1])).toBe(true);
    });
  });

  test("final frame equals collapsed text", () => {
    const frames = [...typewriterFrames("  Ein \n\n Text\tmit   Lücken ")];
    expect(frames.at(-1)).toBe("Ein Text mit Lücken");
  });

  test("empty text yields nothing", () => {
    expect([...typewriterFrames("")]).toEqual([]);
    expect([...typewriterFrames(" \n\t ")]).toEqual([]);
  });
});
