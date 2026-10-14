export type SmsCommand =
  | { type: "help" }
  | { type: "join"; slug: string }
  | { type: "request"; title: string; artist: string }
  | { type: "request-invalid" }
  | { type: "feedback"; text: string };

export const SMS_HELP =
  "CrowdControl: text HOT, COLD, or 1-5. REQUEST Title - Artist. Or say how the room feels. JOIN event-code if more than one session is live.";

export function parseSmsCommand(body: string): SmsCommand {
  const text = body.replace(/\s+/g, " ").trim();
  if (!text) return { type: "help" };

  if (/^(help|info|\?)$/i.test(text)) return { type: "help" };

  const join = text.match(/^join\s+(\S+)$/i);
  if (join?.[1]) return { type: "join", slug: join[1].toLowerCase() };

  const request = text.match(/^request\s+(.+)$/i);
  if (request?.[1]) {
    const parsed = splitRequest(request[1]);
    if (!parsed) return { type: "request-invalid" };
    return { type: "request", title: parsed.title, artist: parsed.artist };
  }

  return { type: "feedback", text };
}

function splitRequest(value: string): { title: string; artist: string } | null {
  const byIndex = value.toLowerCase().lastIndexOf(" by ");
  if (byIndex > 0) {
    return cleanPair(value.slice(0, byIndex), value.slice(byIndex + 4));
  }

  const dash = value.split(/\s+[-–—]\s+/);
  if (dash.length >= 2) {
    const artist = dash.pop()?.trim() ?? "";
    const title = dash.join(" - ").trim();
    return cleanPair(title, artist);
  }

  return null;
}

function cleanPair(
  title: string,
  artist: string,
): { title: string; artist: string } | null {
  const cleanTitle = title.trim();
  const cleanArtist = artist.trim();
  if (!cleanTitle || !cleanArtist) return null;
  return { title: cleanTitle, artist: cleanArtist };
}
