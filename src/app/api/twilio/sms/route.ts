import { handleInboundSms } from "@/lib/services/inbound-sms";
import { publicWebhookUrl, validateTwilioSignature } from "@/lib/sms/signature";
import { twimlMessage } from "@/lib/sms/twiml";

export async function POST(request: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!authToken) {
    return new Response("Twilio is not configured", { status: 503 });
  }

  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") params[key] = value;
  }

  const signature = request.headers.get("x-twilio-signature") ?? "";
  const valid = validateTwilioSignature({
    authToken,
    signature,
    url: publicWebhookUrl(request),
    params,
  });
  if (!valid) {
    return new Response("Invalid signature", { status: 403 });
  }

  try {
    const reply = await handleInboundSms({
      from: params.From ?? "",
      to: params.To ?? "",
      body: params.Body ?? "",
      messageSid: params.MessageSid ?? "",
    });
    return new Response(twimlMessage(reply), {
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    });
  } catch (error) {
    console.error("Twilio SMS webhook failed", error);
    return new Response("Could not handle that text", { status: 500 });
  }
}
