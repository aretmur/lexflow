import { describe, expect, it } from "vitest";
import { signingLinkEmail, signingOtpEmail } from "@/lib/email/templates";

describe("signing emails", () => {
  it("includes the secure signing URL and firm display name", () => {
    const message = signingLinkEmail({
      clientName: "Aret",
      firmName: "Octagon Legal",
      signingUrl: "http://localhost:3000/sign/abc",
    });
    expect(message.subject).toBe("Please review and sign your costs agreement");
    expect(message.text).toContain("Hi Aret,");
    expect(message.text).toContain("Octagon Legal has prepared a costs agreement");
    expect(message.text).toContain("http://localhost:3000/sign/abc");
    expect(message.text).toContain("You do not need a Lexflow account.");
    expect(message.text).toContain("Powered by Lexflow");
  });

  it("does not include sensitive matter details", () => {
    const message = signingLinkEmail({
      clientName: "Aret",
      firmName: "Octagon Legal",
      signingUrl: "http://localhost:3000/sign/abc",
    });
    expect(message.text).not.toMatch(/assault|theft|homicide|fee|GST|disbursement|instruction/i);
    expect(message.text).not.toContain("$");
  });

  it("puts the OTP in the verification email without matter details", () => {
    const message = signingOtpEmail({
      clientName: "Aret",
      firmName: "Octagon Legal",
      code: "123456",
    });
    expect(message.subject).toBe("Your Lexflow verification code");
    expect(message.text).toContain("123456");
    expect(message.text).toContain("expires in 10 minutes");
    expect(message.text).not.toMatch(/assault|theft|matter|fee|GST/i);
  });
});
