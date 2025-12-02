import { describe, it, expect } from "vitest";
import {
  getPrecedingContext,
  getTrailingContext,
  getPrecedingContextFromCsvRow,
  getTrailingContextFromCsvRow,
  getPassageWithSurroundingContext,
  getContextForHighlightSuggestions,
  constructFewShotExamplesString,
} from "./passageUtils.ts";
import type { Passage, Code, PassageId, CodeId } from "../../../../context/WorkflowContext.tsx";

const RS = "\u001E";

// Helpers to build Passage/Code objects
const makePassage = (
  idNum: number,
  order: number,
  text: string
): Passage => ({
  id: `passage-${idNum}` as PassageId,
  order,
  text,
  isHighlighted: false,
  codeIds: [],
  codeSuggestions: [],
  autocompleteSuggestions: [],
  nextHighlightSuggestion: null,
});

const makeBasePassage = (idNum: number, order: number, text: string): Passage => ({
  id: `passage-${idNum}` as PassageId,
  order,
  text,
  isHighlighted: false,
  codeIds: [],
  codeSuggestions: [],
  autocompleteSuggestions: [],
  nextHighlightSuggestion: null,
});

const makeCodedPassage = (idNum: number, order: number, text: string, codeIds: CodeId[]): Passage => ({
  id: `passage-${idNum}` as PassageId,
  order,
  text,
  isHighlighted: true,
  codeIds,
  codeSuggestions: [],
  autocompleteSuggestions: [],
  nextHighlightSuggestion: null,
});

const makeCodes = (pairs: Array<{ id: CodeId; passageId: PassageId; code: string }>): Code[] =>
  pairs.map(({ id, passageId, code }) => ({ id, passageId, code }));

describe("getPrecedingContext", () => {
  it("returns text unchanged when shorter than minimumLength", () => {
    expect(getPrecedingContext("short", 10, 50)).toBe("short");
  });

  it("includes minimumLength and cuts on line break if present", () => {
    const text = "aaa\nbbb\ncccddd";
    const res = getPrecedingContext(text, 5, 5);
    // Should prefer the first line break that occurs after minimumLength
    expect(res).toContain("cccddd");
    expect(res.endsWith("cccddd")).toBe(true); // windowed tail
  });

  it("cuts on sentence end if no line break", () => {
    const text = "Alpha beta. Gamma delta epsilon zeta";
    const res = getPrecedingContext(text, 8, 20);
    expect(res.includes("beta.")).toBe(false); // Should cut after sentence end
    expect(res.endsWith("Gamma delta epsilon zeta")).toBe(true);
  });

  it("falls back to ellipsis when no cut point found", () => {
    const text = "abcdefghijklmnopqrstu"; // no line breaks or sentence end
    const res = getPrecedingContext(text, 10, 5);
    expect(res.startsWith("...")).toBe(true);
  });
});

describe("getTrailingContext", () => {
  it("returns text unchanged when shorter than minimumLength", () => {
    expect(getTrailingContext("short", 10, 50)).toBe("short");
  });

  it("includes minimumLength and cuts on line break if present", () => {
    const text = "aaa\nbbb\ncccddd";
    const res = getTrailingContext(text, 3, 10);
    expect(res.startsWith("aaa\n")).toBe(true);
  });

  it("cuts on earliest sentence end if found", () => {
    const text = "Alpha beta! Gamma? Delta.";
    const res = getTrailingContext(text, 6, 10);
    // Should include up to the first sentence end in cutWindow
    expect(res.includes("beta!")).toBe(true);
  });

  it("falls back to ellipsis when no cut point found", () => {
    const text = "abcdefghijklmnopqrstuvwxyz";
    const res = getTrailingContext(text, 10, 5);
    expect(res.endsWith("...")).toBe(true);
  });
});

describe("CSV row-aware context helpers", () => {
  const passages: Passage[] = [
    makePassage(1, 0, "colA_row1 " + RS),
    makePassage(2, 1, "colB_row1 " + RS),
    makePassage(3, 2, "colA_row2 part1. "),
    makePassage(4, 3, "colA_row2 part2" + RS),
    makePassage(5, 4, "colB_row2 " + RS),
    makePassage(6, 5, "colA_row3 " + RS),
  ];

  it("getPrecedingContextFromCsvRow returns preceding within the same row only", () => {
    // For passage order 3 (colA_row2 part2), preceding should start after last RS before it
    const res = getPrecedingContextFromCsvRow(passages[3], passages);
    // preceding text before "colA_row2 part2" in same row is "colA_row2 part1. "
    expect(res).toBe("colA_row2 part1. ");
  });

  it("getTrailingContextFromCsvRow returns trailing within the same row only", () => {
    // For passage order 3 ("colA_row2 part1. "), trailing should go up to first RS after it
    const res = getTrailingContextFromCsvRow(passages[2], passages);
    // trailing until first RS after it in same row is "colA_row2 part2"
    expect(res).toBe("colA_row2 part2");
  });
});

describe("getPassageWithSurroundingContext", () => {
  it("limits CSV context to same row; adds no trailing when passage ends with RS", () => {
    const passages: Passage[] = [
      makePassage(1, 0, "A1 " + RS),
      makePassage(2, 1, "B1 " + RS),
      makePassage(3, 2, "A2 "),
      makePassage(4, 3, "B2 " + RS),
    ];
    const res = getPassageWithSurroundingContext(passages[0], passages, 70, 30, true, true);
    expect(res.includes("<<<A1 " + RS + ">>>")).toBe(true);
    // Passage ends with RS, so no trailing context from the same row should be appended
    const trailingPart = res.split(">>>")[1] ?? "";
    expect(trailingPart).toBe(""); // nothing after the marked passage
  });

  it("includes both preceding and trailing for non-CSV data", () => {
    const passages: Passage[] = [
      makePassage(1, 0, "Hello "),
      makePassage(2, 1, "world."),
      makePassage(3, 2, " How are you?"),
    ];
    const res = getPassageWithSurroundingContext(passages[1], passages, 70, 30, true, false);
    expect(res).toContain("<<<world.>>>");
    expect(res).toContain("Hello ");
    expect(res).toContain(" How are you?");
  });

  it("does not mark when markPassageInResult=false", () => {
    const passages: Passage[] = [makePassage(1, 0, "Hi ")];
    const res = getPassageWithSurroundingContext(passages[0], passages, 70, 30, false, false);
    expect(res.includes("<<<")).toBe(false);
  });
});

describe("getContextForHighlightSuggestions", () => {
  it("returns sliced single-passage context w.r.t. searchStartIndex", () => {
    const passages: Passage[] = [makePassage(1, 0, "abcdef")];
    const res = getContextForHighlightSuggestions(passages[0], passages, 2, 1000, false);
    expect(res.precedingText).toBe("ab");
    expect(res.searchArea).toBe("cdef");
  });

  it("CSV: preceding limited to same row, search area cut to target size", () => {
    const passages: Passage[] = [
      makePassage(1, 0, "A1 " + RS),
      makePassage(2, 1, "B1 " + RS),
      makePassage(3, 2, "A2 "),
      makePassage(4, 3, "B2 " + RS),
      makePassage(5, 4, "A3 "),
    ];
    const start = passages[2]; // "A2 "
    const res = getContextForHighlightSuggestions(start, passages, 1, 50, true);
    expect(res.precedingText.endsWith("A2 ".slice(0, 1))).toBe(true);
    // searchArea should not cross RS immediately after B2; trailing context limited by getTrailingContext
    expect(res.searchArea.includes(RS)).toBe(true); // trailing part likely contains RS at row end
  });

  it("non-CSV: splits context into preceding and search area windows", () => {
    const passages: Passage[] = [
      makePassage(1, 0, "Hello "),
      makePassage(2, 1, "world, "),
      makePassage(3, 2, "this is a test."),
    ];
    const res = getContextForHighlightSuggestions(passages[1], passages, 3, 40, false);
    expect(res.precedingText.length).toBeGreaterThan(0);
    expect(res.searchArea.length).toBeGreaterThan(0);
  });

  it("stops searchArea before the first following highlighted passage (non-CSV)", () => {
    const passages: Passage[] = [
      makePassage(1, 0, "P0 "),
      makePassage(2, 1, "Start "),
      makePassage(3, 2, "next "),
      makeCodedPassage(4, 3, "H ", ["code-23" as CodeId]), // highlighted -> should be excluded
      makePassage(5, 4, "after "),
    ];
    const start = passages[1]; // "Start "
    const res = getContextForHighlightSuggestions(start, passages, 0, 1000, false);

    expect(res.precedingText).toBe("P0 "); // empty since searchStartIndex=0
    expect(res.searchArea).toBe("Start next "); // excludes "H " and "after "
    expect(res.searchArea.includes("H ")).toBe(false);
    expect(res.searchArea.includes("after ")).toBe(false);
  });

  it("CSV: stops searchArea before the first following highlighted passage", () => {
    const passages: Passage[] = [
      makePassage(1, 0, "row 1, start " + RS + "\n"),            // start

      // row 2 split across multiple passages
      makePassage(2, 1, " "),                 // edge case: leading space
      makePassage(3, 2, "row 2 " + RS),                 
      makeCodedPassage(4, 3, "row 3 highlight", ["code-1" as CodeId]), // highlighted -> excluded and everything after excluded
      makePassage(6, 5, "row 3 rest" + RS),            // would be next in row 2, but must be excluded

      // row 3
      makePassage(7, 6, "r3a " + RS),
    ];

    const start = passages[0]; // "r1a "
    const res = getContextForHighlightSuggestions(start, passages, 7, 1000, true);

    expect(res.precedingText).toBe("row 1, ");
    expect(res.searchArea).toBe("start " + RS + "\n" + " " + "row 2 " + RS);
    expect(res.searchArea.includes("row 3 highlight")).toBe(false);
    expect(res.searchArea.includes("row 3 rest")).toBe(false);
  });
});

describe("constructFewShotExamplesString (CSV behavior)", () => {
  it("surroundingContext equals the entire row (up to RS) when the passage does not span the whole row", () => {
    // Row 1
    const p1 = makeBasePassage(1, 0, "R1A " + RS);
    // Row 2 split across multiple passages
    const p2 = makeCodedPassage(2, 1, "R2A1 ", ["code-2-0" as unknown as CodeId]);
    const p3 = makeBasePassage(3, 2, "R2A2 ");
    const p4 = makeBasePassage(4, 3, "R2B" + RS);
    // Some extra content after
    const p5 = makeBasePassage(5, 4, "R3A " + RS);

    const passages: Passage[] = [p1, p2, p3, p4, p5];
    const codes: Code[] = makeCodes([
      { id: p2.codeIds[0], passageId: p2.id, code: "X" },
    ]);

    // Exclude some other passage so p2 stays in examples
    const excluded = p1;
    const dataIsCSV = true;

    const res = constructFewShotExamplesString(excluded, passages, codes, dataIsCSV);
    expect(res).toBeTruthy();

    // Only one coded passage => res is a single JSON object string
    const obj = JSON.parse(res as string) as {
      passage: string;
      surroundingContext: string;
      codes: string[];
    };

    // Expected entire row 2 content up to the RS marker
    const expectedRowUpToRS = "R2A1 R2A2 R2B";
    expect(obj.passage).toBe(p2.text);
    expect(obj.surroundingContext).toBe(expectedRowUpToRS);
    expect(obj.codes).toEqual(["X"]);
  });

  it('surroundingContext is "None" when the passage spans the entire row (trimmed)', () => {
    // Single whole-row passage (includes RS)
    const p1 = makeCodedPassage(1, 0, "WHOLE_ROW" + RS, ["code-1-0" as unknown as CodeId]);
    const passages: Passage[] = [p1];
    const codes: Code[] = makeCodes([{ id: p1.codeIds[0], passageId: p1.id, code: "A" }]);

    // Exclude a different passage (not in list) so p1 remains included
    const excluded: Passage = makeBasePassage(999, 999, "excluded");
    const dataIsCSV = true;

    const res = constructFewShotExamplesString(excluded, passages, codes, dataIsCSV);
    expect(res).toBeTruthy();

    const obj = JSON.parse(res as string) as {
      passage: string;
      surroundingContext: string;
      codes: string[];
    };

    expect(obj.passage).toBe("WHOLE_ROW" + RS);
    // Because surroundingContext equals passage.trim() (RS isn't trimmed), the function returns "None"
    expect(obj.surroundingContext).toBe("None");
    expect(obj.codes).toEqual(["A"]);
  });
});

describe("constructFewShotExamplesString (plain text behavior)", () => {
  it("surroundingContext equals full surrounding text when neighbors exist", () => {
    // Build a tiny document: "A " + "B" + " C"
    const p1 = makeBasePassage(1, 0, "A ");
    const p2 = makeCodedPassage(2, 1, "B", ["code-2-0" as unknown as CodeId]);
    const p3 = makeBasePassage(3, 2, " C");
    const passages: Passage[] = [p1, p2, p3];
    const codes: Code[] = makeCodes([{ id: p2.codeIds[0], passageId: p2.id, code: "K" }]);

    const excluded = makeBasePassage(999, 999, "excluded"); // not in list, so nothing excluded
    const dataIsCSV = false;

    const res = constructFewShotExamplesString(excluded, passages, codes, dataIsCSV);
    expect(res).toBeTruthy();

    const obj = JSON.parse(res as string) as {
      passage: string;
      surroundingContext: string;
      codes: string[];
    };

    // With wide window, preceding+passage+trailing should equal the whole string
    expect(obj.passage).toBe("B");
    expect(obj.surroundingContext).toBe("A B C");
    expect(obj.codes).toEqual(["K"]);
  });

  it('surroundingContext is "None" when equal to passage.text', () => {
    // Only one passage in the document; no surrounding context
    const p1 = makeCodedPassage(1, 0, "Solo", ["code-1-0" as unknown as CodeId]);
    const passages: Passage[] = [p1];
    const codes: Code[] = makeCodes([{ id: p1.codeIds[0], passageId: p1.id, code: "S" }]);

    const excluded = makeBasePassage(999, 999, "excluded"); // not in list
    const dataIsCSV = false;

    const res = constructFewShotExamplesString(excluded, passages, codes, dataIsCSV);
    expect(res).toBeTruthy();

    const obj = JSON.parse(res as string) as {
      passage: string;
      surroundingContext: string;
      codes: string[];
    };

    expect(obj.passage).toBe("Solo");
    // No neighbors -> surroundingContext equals passage.text -> function returns "None"
    expect(obj.surroundingContext).toBe("None");
    expect(obj.codes).toEqual(["S"]);
  });
});