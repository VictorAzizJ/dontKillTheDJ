import { describe, expect, it } from "vitest";
import {
  CROWD_HALF_LIFE_MS,
  aggregateCrowd,
  bandFromEnergy,
  feelPhrase,
  readingFromScore,
  type CrowdSample,
} from "@/lib/crowd/reading";

const now = new Date("2026-10-14T04:00:00.000Z");

function sample(
  minutesAgo: number,
  energy: number,
  sentiment: number,
  label: string,
): CrowdSample {
  return {
    energy,
    sentiment,
    label,
    reader: "vote",
    createdAt: new Date(now.getTime() - minutesAgo * 60 * 1000),
  };
}

describe("readingFromScore", () => {
  it("keeps a loud complaint distinct from applause", () => {
    expect(readingFromScore(1).sentiment).toBeLessThan(0);
    expect(readingFromScore(5).energy).toBeGreaterThan(readingFromScore(1).energy);
    expect(readingFromScore(5).sentiment).toBeGreaterThan(0);
  });
});

describe("aggregateCrowd", () => {
  it("waits when the window is empty", () => {
    const reading = aggregateCrowd([], now);
    expect(reading.temperature).toBeNull();
    expect(reading.headline).toBe("Waiting for the room");
    expect(reading.sampleCount).toBe(0);
  });

  it("weighs a fresh check more than one a half-life old", () => {
    const fresh = readingFromScore(5);
    const older = readingFromScore(1);
    const reading = aggregateCrowd(
      [
        sample(0, fresh.energy, fresh.sentiment, fresh.label),
        sample(CROWD_HALF_LIFE_MS / 60000, older.energy, older.sentiment, older.label),
      ],
      now,
    );

    const expectedEnergy = (fresh.energy * 1 + older.energy * 0.5) / 1.5;
    expect(reading.temperature).toBe(Math.round(expectedEnergy * 100));
    expect(reading.band).toBe(bandFromEnergy(expectedEnergy));
    expect(reading.phrases[0]?.label).toBe("on fire");
  });

  it("calls a rising room heating up", () => {
    const reading = aggregateCrowd(
      [
        sample(1, 0.95, 0.8, "on fire"),
        sample(4, 0.2, -0.4, "cold"),
      ],
      now,
    );
    expect(reading.trend).toBe("heating");
    expect(reading.trendLabel).toBe("Heating up");
  });
});

describe("feelPhrase", () => {
  it("names heat and approval separately", () => {
    expect(feelPhrase(0.92, -0.7)).toBe("on fire and negative");
    expect(feelPhrase(0.98, 0.95)).toBe("on fire and positive");
  });
});
