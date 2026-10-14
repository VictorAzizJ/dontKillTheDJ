import { describe, expect, it } from "vitest";
import { parseSmsCommand } from "@/lib/sms/commands";

describe("parseSmsCommand", () => {
  it("parses join, request, and feedback", () => {
    expect(parseSmsCommand("JOIN Neon-Room-Friday")).toEqual({
      type: "join",
      slug: "neon-room-friday",
    });
    expect(parseSmsCommand("REQUEST Blinding Lights - The Weeknd")).toEqual({
      type: "request",
      title: "Blinding Lights",
      artist: "The Weeknd",
    });
    expect(parseSmsCommand("REQUEST Stand By Me by Ben E. King")).toEqual({
      type: "request",
      title: "Stand By Me",
      artist: "Ben E. King",
    });
    expect(parseSmsCommand("REQUEST just a title")).toEqual({
      type: "request-invalid",
    });
    expect(parseSmsCommand("this is way too loud")).toEqual({
      type: "feedback",
      text: "this is way too loud",
    });
    expect(parseSmsCommand("help")).toEqual({ type: "help" });
  });
});
