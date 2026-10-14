/** Recent checks count more. A reading from 12 minutes ago weighs half as much. */
export const CROWD_HALF_LIFE_MS = 12 * 60 * 1000;

const WINDOW_WEIGHT_FLOOR = 0.02;
const TREND_WINDOW_MS = 3 * 60 * 1000;
const TREND_DELTA = 0.08;

export type CrowdSample = {
  energy: number;
  sentiment: number;
  label: string | null;
  reader: string;
  createdAt: Date;
};

export type CrowdPhrase = {
  label: string;
  sentiment: number;
  reader: string;
  createdAt: string;
};

export type CrowdTrend = "heating" | "steady" | "cooling";

export type CrowdBand = "cold" | "cool" | "warm" | "hot" | "fire";

export type CrowdReading = {
  temperature: number | null;
  sentiment: number | null;
  trend: CrowdTrend;
  sampleCount: number;
  band: CrowdBand | null;
  sentimentBand: "negative" | "mixed" | "positive" | null;
  headline: string;
  trendLabel: string;
  moodLabel: string | null;
  phrases: CrowdPhrase[];
};

export type LevelReading = {
  energy: number;
  sentiment: number;
  label: string;
};

const LEVELS: Record<number, LevelReading> = {
  1: { energy: 0.12, sentiment: -0.9, label: "cold" },
  2: { energy: 0.32, sentiment: -0.45, label: "cool" },
  3: { energy: 0.5, sentiment: 0, label: "steady" },
  4: { energy: 0.78, sentiment: 0.55, label: "hot" },
  5: { energy: 0.98, sentiment: 0.95, label: "on fire" },
};

export function readingFromScore(score: number): LevelReading {
  const level = LEVELS[score];
  if (!level) {
    throw new Error("Score must be from 1 to 5");
  }
  return level;
}

export function bandFromEnergy(energy: number): CrowdBand {
  if (energy < 0.2) return "cold";
  if (energy < 0.4) return "cool";
  if (energy < 0.6) return "warm";
  if (energy < 0.82) return "hot";
  return "fire";
}

export function bandHeadline(band: CrowdBand): string {
  if (band === "fire") return "On fire";
  return band.charAt(0).toUpperCase() + band.slice(1);
}

export function sentimentBand(
  sentiment: number,
): "negative" | "mixed" | "positive" {
  if (sentiment > 0.2) return "positive";
  if (sentiment < -0.2) return "negative";
  return "mixed";
}

export function feelPhrase(energy: number, sentiment: number): string {
  const heat = bandHeadline(bandFromEnergy(energy)).toLowerCase();
  return `${heat} and ${sentimentBand(sentiment)}`;
}

export function aggregateCrowd(samples: CrowdSample[], now: Date): CrowdReading {
  const nowMs = now.getTime();
  const weighted = samples
    .map((sample) => {
      const age = Math.max(0, nowMs - sample.createdAt.getTime());
      const weight = Math.pow(0.5, age / CROWD_HALF_LIFE_MS);
      return { ...sample, age, weight };
    })
    .filter((sample) => sample.weight > WINDOW_WEIGHT_FLOOR);

  const phrases = [...samples]
    .filter((sample) => sample.label && sample.label.trim().length > 0)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 3)
    .map((sample) => ({
      label: sample.label!.trim(),
      sentiment: clamp(sample.sentiment, -1, 1),
      reader: sample.reader,
      createdAt: sample.createdAt.toISOString(),
    }));

  if (weighted.length === 0) {
    return {
      temperature: null,
      sentiment: null,
      trend: "steady",
      sampleCount: 0,
      band: null,
      sentimentBand: null,
      headline: "Waiting for the room",
      trendLabel: "No checks yet",
      moodLabel: null,
      phrases,
    };
  }

  const energy = weightedMean(weighted, "energy");
  const sentiment = clamp(weightedMean(weighted, "sentiment"), -1, 1);
  const band = bandFromEnergy(energy);
  const mood = sentimentBand(sentiment);
  const trend = trendFrom(weighted);

  return {
    temperature: Math.round(clamp(energy, 0, 1) * 100),
    sentiment,
    trend,
    sampleCount: weighted.length,
    band,
    sentimentBand: mood,
    headline: bandHeadline(band),
    trendLabel: trendLabel(trend),
    moodLabel: mood.charAt(0).toUpperCase() + mood.slice(1),
    phrases,
  };
}

function trendFrom(
  weighted: Array<CrowdSample & { age: number; weight: number }>,
): CrowdTrend {
  const recent = weighted.filter((sample) => sample.age <= TREND_WINDOW_MS);
  const prior = weighted.filter(
    (sample) =>
      sample.age > TREND_WINDOW_MS && sample.age <= TREND_WINDOW_MS * 2,
  );
  if (recent.length === 0 || prior.length === 0) return "steady";

  const delta = weightedMean(recent, "energy") - weightedMean(prior, "energy");
  if (delta >= TREND_DELTA) return "heating";
  if (delta <= -TREND_DELTA) return "cooling";
  return "steady";
}

function trendLabel(trend: CrowdTrend): string {
  if (trend === "heating") return "Heating up";
  if (trend === "cooling") return "Cooling off";
  return "Holding";
}

function weightedMean(
  samples: Array<{ energy: number; sentiment: number; weight: number }>,
  key: "energy" | "sentiment",
): number {
  const total = samples.reduce((sum, sample) => sum + sample.weight, 0);
  if (total === 0) return 0;
  return samples.reduce((sum, sample) => sum + sample[key] * sample.weight, 0) / total;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
