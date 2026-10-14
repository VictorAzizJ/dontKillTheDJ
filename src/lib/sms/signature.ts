import { createHmac, timingSafeEqual } from "node:crypto";

/** Twilio signs URL + sorted POST params with HMAC-SHA1, base64. */
export function validateTwilioSignature(input: {
  authToken: string;
  signature: string;
  url: string;
  params: Record<string, string>;
}): boolean {
  const payload = Object.keys(input.params)
    .sort()
    .reduce((acc, key) => acc + key + input.params[key], input.url);

  const expected = createHmac("sha1", input.authToken)
    .update(payload, "utf8")
    .digest("base64");

  const actual = input.signature.trim();
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(actual);
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

export function publicWebhookUrl(request: Request): string {
  const configured = process.env.TWILIO_WEBHOOK_URL?.trim();
  if (configured) return configured;

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (!forwardedHost) return request.url;

  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const url = new URL(request.url);
  return `${forwardedProto}://${forwardedHost}${url.pathname}${url.search}`;
}
