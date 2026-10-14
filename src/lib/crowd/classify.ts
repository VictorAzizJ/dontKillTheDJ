import { feelPhrase, readingFromScore } from "@/lib/crowd/reading";

export type FeedbackReading = {
  source: "SMS_KEYWORD" | "SMS_AGENT";
  reader: "keyword" | "lexicon" | "model";
  energy: number;
  sentiment: number;
  label: string;
};

const KEYWORDS: Record<string, { score: number }> = {
  "1": { score: 1 },
  dead: { score: 1 },
  freezing: { score: 1 },
  icy: { score: 1 },
  "2": { score: 2 },
  cold: { score: 2 },
  meh: { score: 2 },
  "3": { score: 3 },
  ok: { score: 3 },
  okay: { score: 3 },
  fine: { score: 3 },
  steady: { score: 3 },
  "4": { score: 4 },
  hot: { score: 4 },
  "5": { score: 5 },
  fire: { score: 5 },
  "on fire": { score: 5 },
};

const POSITIVE = new Set([
  "love",
  "amazing",
  "great",
  "good",
  "perfect",
  "yes",
  "banger",
  "slaps",
  "slap",
  "encore",
  "dance",
  "dancing",
  "hype",
  "fun",
  "awesome",
  "best",
  "lit",
]);

const NEGATIVE = new Set([
  "boring",
  "bad",
  "hate",
  "stop",
  "skip",
  "trash",
  "sucks",
  "terrible",
  "worst",
  "annoying",
  "no",
  "nah",
  "asleep",
  "dead",
  "awful",
]);

const HIGH = new Set([
  "loud",
  "drop",
  "bass",
  "scream",
  "hype",
  "dance",
  "dancing",
  "energy",
  "crazy",
  "wild",
  "lit",
]);

const LOW = new Set([
  "slow",
  "quiet",
  "dead",
  "sleepy",
  "chill",
  "boring",
  "asleep",
  "mellow",
]);

export function classifyKeyword(text: string): FeedbackReading | null {
  const key = normalizeKeyword(text);
  const match = KEYWORDS[key];
  if (!match) return null;
  const level = readingFromScore(match.score);
  return {
    source: "SMS_KEYWORD",
    reader: "keyword",
    energy: level.energy,
    sentiment: level.sentiment,
    label: level.label,
  };
}

export function classifyWithLexicon(text: string): FeedbackReading | null {
  const phrase = specialPhrase(text);
  if (phrase) return phrase;

  const tokens = tokenize(text);
  if (tokens.length === 0) return null;

  let positive = 0;
  let negative = 0;
  let high = 0;
  let low = 0;
  for (const token of tokens) {
    if (POSITIVE.has(token)) positive += 1;
    if (NEGATIVE.has(token)) negative += 1;
    if (HIGH.has(token)) high += 1;
    if (LOW.has(token)) low += 1;
  }

  if (positive + negative + high + low === 0) return null;

  const sentiment = clamp(
    (positive - negative) / Math.max(1, positive + negative),
    -1,
    1,
  );
  const energy = clamp(0.5 + 0.28 * (high - low) + 0.12 * sentiment, 0, 1);
  const label = excerpt(text);

  return {
    source: "SMS_AGENT",
    reader: "lexicon",
    energy,
    sentiment,
    label,
  };
}

/**
 * Keywords stay local. Free text uses a model when OPENAI_API_KEY is set,
 * and the word reader when it is not or the call fails.
 */
export async function interpretFeedback(
  text: string,
): Promise<FeedbackReading | null> {
  const keyword = classifyKeyword(text);
  if (keyword) return keyword;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (apiKey) {
    const modeled = await classifyWithModel(text, apiKey);
    if (modeled && modeled !== "skip") return modeled;
  }

  return classifyWithLexicon(text);
}

export function loggedReply(energy: number, sentiment: number): string {
  return `Logged — room feels ${feelPhrase(energy, sentiment)}.`;
}

async function classifyWithModel(
  text: string,
  apiKey: string,
): Promise<FeedbackReading | "skip" | null> {
  const base = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Score one SMS about a live DJ set. Reply with JSON only: {"energy":0 to 1,"sentiment":-1 to 1,"label":"short phrase"} or {"skip":true} when it is not crowd feedback. Energy is intensity. Sentiment is approval. "too loud" is high energy and negative.',
          },
          { role: "user", content: text.slice(0, 280) },
        ],
      }),
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return null;
    return parseModelReading(content);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseModelReading(content: string): FeedbackReading | "skip" | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  if (record.skip === true) return "skip";
  if (typeof record.energy !== "number" || typeof record.sentiment !== "number") {
    return null;
  }
  const label =
    typeof record.label === "string" && record.label.trim()
      ? excerpt(record.label)
      : "from the room";
  return {
    source: "SMS_AGENT",
    reader: "model",
    energy: clamp(record.energy, 0, 1),
    sentiment: clamp(record.sentiment, -1, 1),
    label,
  };
}

function specialPhrase(text: string): FeedbackReading | null {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  const phrases: Array<{ test: RegExp; energy: number; sentiment: number; label: string }> =
    [
      { test: /\btoo loud\b/, energy: 0.92, sentiment: -0.7, label: "too loud" },
      { test: /\btoo slow\b/, energy: 0.28, sentiment: -0.65, label: "too slow" },
      { test: /\btoo quiet\b/, energy: 0.22, sentiment: -0.45, label: "too quiet" },
      {
        test: /\bplay something we know\b/,
        energy: 0.4,
        sentiment: -0.25,
        label: "play something we know",
      },
    ];

  for (const phrase of phrases) {
    if (phrase.test.test(normalized)) {
      return {
        source: "SMS_AGENT",
        reader: "lexicon",
        energy: phrase.energy,
        sentiment: phrase.sentiment,
        label: phrase.label,
      };
    }
  }
  return null;
}

function normalizeKeyword(text: string): string {
  return text
    .toLowerCase()
    .replace(/[!?.]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function excerpt(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 48) return clean;
  return `${clean.slice(0, 47).trimEnd()}…`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
