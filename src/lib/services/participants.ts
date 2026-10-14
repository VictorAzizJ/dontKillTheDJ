import { db } from "@/lib/db";

export function normalizeE164(value: string | null | undefined): string | null {
  const raw = value?.trim() ?? "";
  if (!/^\+[1-9]\d{7,14}$/.test(raw)) return null;
  return raw;
}

export async function upsertAudienceParticipant(input: {
  eventId: string;
  sessionToken?: string | null;
  phoneE164?: string | null;
}): Promise<string | null> {
  const phone = normalizeE164(input.phoneE164);
  if (phone) {
    const participant = await db.eventParticipant.upsert({
      where: {
        eventId_phoneE164: { eventId: input.eventId, phoneE164: phone },
      },
      create: { eventId: input.eventId, phoneE164: phone },
      update: {},
    });
    return participant.id;
  }

  const token = input.sessionToken?.trim();
  if (!token || token.length < 8 || token.length > 128) return null;

  const participant = await db.eventParticipant.upsert({
    where: {
      eventId_sessionToken: { eventId: input.eventId, sessionToken: token },
    },
    create: {
      eventId: input.eventId,
      sessionToken: token,
      displayLabel: "Guest",
    },
    update: {},
  });
  return participant.id;
}
