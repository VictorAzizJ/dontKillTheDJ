import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateTwilioSignature } from "@/lib/sms/signature";

describe("validateTwilioSignature", () => {
  it("accepts HMAC-SHA1 of the url plus sorted params", () => {
    const url = "https://example.com/api/twilio/sms";
    const params = { Body: "HOT", From: "+15555550100", To: "+15555550199" };
    const authToken = "test-token";
    const payload = Object.keys(params)
      .sort()
      .reduce((acc, key) => acc + key + params[key as keyof typeof params], url);
    const signature = createHmac("sha1", authToken)
      .update(payload, "utf8")
      .digest("base64");

    expect(
      validateTwilioSignature({ authToken, signature, url, params }),
    ).toBe(true);
    expect(
      validateTwilioSignature({
        authToken,
        signature: "not-the-signature",
        url,
        params,
      }),
    ).toBe(false);
  });
});
