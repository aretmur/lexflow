export function signingLinkEmail(input: {
  clientName: string;
  firmName: string;
  signingUrl: string;
}) {
  return {
    subject: "Please review and sign your costs agreement",
    text: `Hi ${input.clientName},

${input.firmName} has prepared a costs agreement for you to review and sign.

Review and sign your agreement:

${input.signingUrl}

You do not need a Lexflow account.

For your security, this link is unique to you and may expire.

If you have any questions about the agreement, please contact ${input.firmName}.

Regards,

${input.firmName}

Powered by Lexflow`,
  };
}

export function signingOtpEmail(input: { clientName: string; firmName: string; code: string }) {
  return {
    subject: "Your Lexflow verification code",
    text: `Hi ${input.clientName},

Your verification code is:

${input.code}

This code expires in 10 minutes.

If you did not request this code, you can ignore this email.

Regards,

${input.firmName}

Powered by Lexflow`,
  };
}

export const SIGNED_AGREEMENT_ATTACHMENT_NAME = "Signed Costs Agreement.pdf";

export function signedClientCopyEmail(input: {
  clientName: string;
  firmName: string;
}) {
  return {
    subject: `Your signed costs agreement – ${input.firmName}`,
    text: `Hi ${input.clientName},

Your costs agreement with ${input.firmName} has been signed successfully.

A copy of the signed agreement is attached for your records.

If you have any questions, please contact ${input.firmName}.

Regards,

${input.firmName}

Powered by Lexflow`,
  };
}

export function signedFirmCopyEmail(input: {
  clientName: string;
  signedAt: string;
  signingMethod: string;
}) {
  return {
    subject: `Signed costs agreement received – ${input.clientName}`,
    text: `${input.clientName} has completed the Lexflow signing process.

The executed costs agreement is attached.

Signed:
${input.signedAt}

Signing method:
${input.signingMethod}`,
  };
}
