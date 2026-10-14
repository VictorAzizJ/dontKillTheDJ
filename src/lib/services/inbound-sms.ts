import { EventStatus, Prisma, RequestSource } from "@prisma/client";
import { interpretFeedback, loggedReply } from "@/lib/crowd/classify";
import { db } from "@/lib/db";
import { SMS_HELP, parseSmsCommand, type SmsCommand } from "@/lib/sms/commands";
import { CrowdServiceError, recordCrowdSignal } from "@/lib/services/crowd";
import { normalizeE164, upsertAudienceParticipant } from "@/lib/services/participants";
import {
  SongRequestServiceError,
  createSongRequest,
} from "@/lib/services/song-requests";

const ALREADY = "Already received that text.";

export async function handleInboundSms(input: {
  from: string;
  to: string;
  body: string;
  messageSid: string;
}): Promise<string> {
  const from = normalizeE164(input.from);
  const to = input.to.trim();
  const messageSid = input.messageSid.trim();
  if (!from || !messageSid) {
    return "Could not read that text.";
  }

  const existing = await db.twilioMessage.findUnique({ where: { messageSid } });
  if (existing) return existing.replyBody ?? ALREADY;

  const command = parseSmsCommand(input.body.slice(0, 500));
  const claimed = await claimMessage({
    messageSid,
    fromPhone: from,
    toPhone: to.slice(0, 32),
    body: input.body.slice(0, 1000),
  });
  if (!claimed) {
    const raced = await db.twilioMessage.findUnique({ where: { messageSid } });
    return raced?.replyBody ?? ALREADY;
  }

  try {
    const reply = await dispatchSms(from, command);
    await db.twilioMessage.update({
      where: { messageSid },
      data: {
        replyBody: reply.text,
        eventId: reply.eventId,
      },
    });
    return reply.text;
  } catch (error) {
    await db.twilioMessage.delete({ where: { messageSid } }).catch(() => undefined);
    throw error;
  }
}

async function dispatchSms(
  from: string,
  command: SmsCommand,
): Promise<{ text: string; eventId: string | null }> {
  if (command.type === "help") {
    return { text: SMS_HELP, eventId: null };
  }

  if (command.type === "request-invalid") {
    return {
      text: "Text REQUEST Title - Artist.",
      eventId: null,
    };
  }

  const resolved = await resolveLiveEvent(from, command);
  if (!resolved.ok) {
    return { text: resolved.reply, eventId: resolved.eventId };
  }

  if (command.type === "join") {
    return {
      text: `You're in ${resolved.event.name}. Text HOT, COLD, or REQUEST Title - Artist.`,
      eventId: resolved.event.id,
    };
  }

  if (command.type === "request") {
    try {
      const result = await createSongRequest({
        eventId: resolved.event.id,
        title: command.title,
        artist: command.artist,
        source: RequestSource.SMS,
        phoneE164: from,
      });
      if (result.created) {
        return {
          text: `Requested ${result.songRequest.title} — ${result.songRequest.artist}.`,
          eventId: resolved.event.id,
        };
      }
      if (result.upvoted) {
        return {
          text: `Added your vote for ${result.songRequest.title}.`,
          eventId: resolved.event.id,
        };
      }
      return {
        text: `${result.songRequest.title} is already on the list.`,
        eventId: resolved.event.id,
      };
    } catch (error) {
      if (error instanceof SongRequestServiceError) {
        return { text: error.message, eventId: resolved.event.id };
      }
      throw error;
    }
  }

  const feedback = await interpretFeedback(command.text);
  if (!feedback) {
    return {
      text: "Text HOT, COLD, or how the room feels.",
      eventId: resolved.event.id,
    };
  }

  try {
    await recordCrowdSignal({
      eventId: resolved.event.id,
      participantId: resolved.participantId,
      source: feedback.source,
      reader: feedback.reader,
      energy: feedback.energy,
      sentiment: feedback.sentiment,
      label: feedback.label,
    });
  } catch (error) {
    if (error instanceof CrowdServiceError && error.code === "RATE_LIMITED") {
      return {
        text: "Got it — give the room a few seconds before the next check.",
        eventId: resolved.event.id,
      };
    }
    if (error instanceof CrowdServiceError) {
      return { text: error.message, eventId: resolved.event.id };
    }
    throw error;
  }

  return {
    text: loggedReply(feedback.energy, feedback.sentiment),
    eventId: resolved.event.id,
  };
}

type ResolvedEvent =
  | {
      ok: true;
      event: { id: string; name: string };
      participantId: string;
    }
  | { ok: false; reply: string; eventId: string | null };

async function resolveLiveEvent(
  from: string,
  command: SmsCommand,
): Promise<ResolvedEvent> {
  if (command.type === "join") {
    const event = await db.event.findUnique({ where: { slug: command.slug } });
    if (!event) {
      return { ok: false, reply: "No event with that code.", eventId: null };
    }
    if (event.status !== EventStatus.LIVE) {
      return {
        ok: false,
        reply: "That session isn't live yet.",
        eventId: event.id,
      };
    }
    const participantId = await upsertAudienceParticipant({
      eventId: event.id,
      phoneE164: from,
    });
    if (!participantId) {
      return { ok: false, reply: "Could not read that number.", eventId: event.id };
    }
    return { ok: true, event, participantId };
  }

  const memberships = await db.eventParticipant.findMany({
    where: { phoneE164: from, event: { status: EventStatus.LIVE } },
    include: { event: true },
    orderBy: { updatedAt: "desc" },
  });

  if (memberships.length === 1 && memberships[0]) {
    return {
      ok: true,
      event: memberships[0].event,
      participantId: memberships[0].id,
    };
  }

  if (memberships.length > 1) {
    return {
      ok: false,
      reply: "More than one session is live. Text JOIN and the event code.",
      eventId: null,
    };
  }

  const live = await db.event.findMany({
    where: { status: EventStatus.LIVE },
    orderBy: { startedAt: "desc" },
    take: 2,
  });

  if (live.length === 1 && live[0]) {
    const participantId = await upsertAudienceParticipant({
      eventId: live[0].id,
      phoneE164: from,
    });
    if (!participantId) {
      return { ok: false, reply: "Could not read that number.", eventId: live[0].id };
    }
    return { ok: true, event: live[0], participantId };
  }

  if (live.length === 0) {
    return { ok: false, reply: "No live session right now.", eventId: null };
  }

  return {
    ok: false,
    reply: "A few sessions are live. Text JOIN and the event code from the DJ.",
    eventId: null,
  };
}

async function claimMessage(input: {
  messageSid: string;
  fromPhone: string;
  toPhone: string;
  body: string;
}): Promise<boolean> {
  try {
    await db.twilioMessage.create({
      data: {
        messageSid: input.messageSid,
        fromPhone: input.fromPhone,
        toPhone: input.toPhone,
        body: input.body,
        direction: "inbound",
      },
    });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return false;
    }
    throw error;
  }
}
