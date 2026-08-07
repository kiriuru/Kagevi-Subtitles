import { describe, expect, it } from "vitest";
import {
  appendOverlapPhrase,
  overlapDisplayText,
  preferStableOverlapPartial,
} from "./overlap-phrase-logic";

describe("appendOverlapPhrase", () => {
  it("returns next when prefix empty", () => {
    expect(appendOverlapPhrase("", "hello world")).toBe("hello world");
  });

  it("extends when next starts with prefix", () => {
    expect(appendOverlapPhrase("hello", "hello world")).toBe("hello world");
  });

  it("keeps prefix when next is already contained", () => {
    expect(appendOverlapPhrase("hello world", "world")).toBe("hello world");
  });

  it("merges overlapping word suffix/prefix across slot restart", () => {
    expect(appendOverlapPhrase("one two three", "three four five")).toBe(
      "one two three four five",
    );
  });

  it("concatenates when there is no overlap", () => {
    expect(appendOverlapPhrase("alpha beta", "gamma")).toBe("alpha beta gamma");
  });

  it("builds display text from prefix + live interim", () => {
    expect(overlapDisplayText("hello there", "friend")).toBe("hello there friend");
  });
});

describe("preferStableOverlapPartial", () => {
  it("holds same-hypothesis catastrophic trailing trim", () => {
    const prev =
      "horizontal Abyss out for me in every direction an entirely new Panic began to form";
    expect(preferStableOverlapPartial(prev, "horizontal Abyss")).toBe(prev);
    expect(preferStableOverlapPartial(prev, "horizontal Abyss out for me in every direction an entirely new Panic began to fo")).toBe(
      "horizontal Abyss out for me in every direction an entirely new Panic began to fo",
    );
  });

  it("allows growth and unrelated shorter rewrites", () => {
    expect(preferStableOverlapPartial("hello", "hello world")).toBe("hello world");
    expect(preferStableOverlapPartial("hello wor", "hello")).toBe("hello");
    expect(preferStableOverlapPartial("long previous sentence here", "I")).toBe("I");
  });
});
