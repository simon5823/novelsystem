import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { splitScenes, joinScenes, wordCount } from "./text.ts";

describe("wordCount", () => {
  it("counts Chinese without whitespace", () => {
    assert.equal(wordCount("春風 又綠", "no_space"), 4);
  });
  it("includes punctuation in default mode", () => {
    assert.equal(wordCount("你好。", "no_space"), 3);
  });
  it("han_only skips punctuation", () => {
    assert.equal(wordCount("你好。", "han_only"), 2);
  });
});

describe("scenes", () => {
  it("splits on --- lines", () => {
    const parts = splitScenes("上半\n---\n下半");
    assert.equal(parts.length, 2);
    assert.equal(parts[0].trim(), "上半");
    assert.equal(parts[1].trim(), "下半");
  });
  it("roundtrips", () => {
    const joined = joinScenes(["甲", "乙"]);
    assert.deepEqual(splitScenes(joined).map((s) => s.trim()), ["甲", "乙"]);
  });
});
