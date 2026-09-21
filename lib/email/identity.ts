export function firmSigningEmailIdentity(firm: {
  name: string;
  practice_name?: string | null;
  signing_sender_name?: string | null;
  signing_reply_to_email?: string | null;
}) {
  const displayName =
    firm.signing_sender_name?.trim() || firm.practice_name?.trim() || firm.name.trim();
  return {
    displayName,
    replyTo: firm.signing_reply_to_email?.trim() || null,
  };
}
