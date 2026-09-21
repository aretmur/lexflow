import { describe, expect, it } from "vitest";
import { firmSigningEmailIdentity } from "@/lib/email/identity";

describe("firm signing email identity", () => {
  it("uses firm-level sender name and reply-to when present", () => {
    expect(
      firmSigningEmailIdentity({
        name: "Lexflow Tenant",
        practice_name: "Practice Pty Ltd",
        signing_sender_name: "Octagon Legal",
        signing_reply_to_email: "intake@octagonlegal.au",
      }),
    ).toEqual({
      displayName: "Octagon Legal",
      replyTo: "intake@octagonlegal.au",
    });
  });

  it("falls back to the practice or firm name", () => {
    expect(
      firmSigningEmailIdentity({
        name: "Example Law",
        practice_name: "Example Practice",
        signing_sender_name: null,
        signing_reply_to_email: "  ",
      }),
    ).toEqual({
      displayName: "Example Practice",
      replyTo: null,
    });
  });
});
