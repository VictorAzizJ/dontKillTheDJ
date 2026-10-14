import { describe, expect, it } from "vitest";
import {
  classifyKeyword,
  classifyWithLexicon,
  interpretFeedback,
} from "@/lib/crowd/classify";

describe("classifyKeyword", () => {
  it("maps a direct check onto the 1-5 scale", () => {
    expect(classifyKeyword("FIRE!")?.label).toBe("on fire");
    expect(classifyKeyword("cold")?.source).toBe("SMS_KEYWORD");
    expect(classifyKeyword("3")?.label).toBe("steady");
  });
});

describe("classifyWithLexicon", () => {
  it("reads too loud as intense and negative", () => {
    const reading = classifyWithLexicon("this is way too loud");
    expect(reading?.reader).toBe("lexicon");
    expect(reading?.energy).toBeGreaterThan(0.8);
    expect(reading?.sentiment).toBeLessThan(0);
    expect(reading?.label).toBe("too loud");
  });

  it("reads praise as positive", () => {
    const reading = classifyWithLexicon("this song is amazing");
    expect(reading?.sentiment).toBeGreaterThan(0);
  });

  it("ignores text with no crowd signal", () => {
    expect(classifyWithLexicon("what time is last call")).toBeNull();
  });
});

describe("interpretFeedback", () => {
  it("keeps keywords local when no model key is set", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const reading = await interpretFeedback("hot");
    expect(reading?.reader).toBe("keyword");
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  });
});
