export function firmSigningEmailIdentity(firm: {
  name: string;
  practice_name?: string | null;
  signing_sender_name?: string | null;
  signing_sender_email?: string | null;
  signing_reply_to_email?: string | null;
}) {
  const displayName =
    firm.signing_sender_name?.trim() || firm.practice_name?.trim() || firm.name.trim();
  const senderEmail = firm.signing_sender_email?.trim() || null;
  return {
    displayName,
    senderEmail,
    replyTo: firm.signing_reply_to_email?.trim() || null,
  };
}
