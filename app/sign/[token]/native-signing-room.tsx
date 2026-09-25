"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  completeNativeSigningAction,
  sendSigningOtpAction,
  verifySigningOtpAction,
} from "@/app/actions/public-signing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDocumentDate } from "@/lib/documents/formatters";
import type { NativeSessionView } from "@/lib/signatures/native-workflow";

type ReadySession = Extract<NativeSessionView, { status: "ready" }>;
type OtpSession = Extract<NativeSessionView, { status: "needs_otp" }>;

export function NativeSigningRoom({
  token,
  session,
}: {
  token: string;
  session: ReadySession | OtpSession;
}) {
  if (session.status === "needs_otp") {
    return <OtpStep token={token} session={session} />;
  }
  return <ReadyStep token={token} session={session} />;
}

function OtpStep({ token, session }: { token: string; session: OtpSession }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    sendSigningOtpAction(token).then((result) => {
      if (cancelled) {
        return;
      }
      if (result.error) {
        setError(result.error);
        return;
      }
      setSent(true);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function verify() {
    setPending(true);
    setError(null);
    const result = await verifySigningOtpAction(token, code);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="mx-auto max-w-md space-y-5 py-8">
      <h2 className="font-serif text-2xl">Verify your email</h2>
      <p className="text-sm leading-6 text-ink-muted">
        A 6-digit code was sent to {session.signerEmail}. Enter it to review and
        sign the costs agreement. You do not need a Lexflow account.
      </p>
      {sent ? (
        <p className="text-sm text-ink">Code sent. It expires in 10 minutes.</p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="space-y-2">
        <Label htmlFor="otp">One-time code</Label>
        <Input
          id="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={pending || code.length !== 6} onClick={verify}>
          {pending ? "Checking…" : "Continue"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setError(null);
            const result = await sendSigningOtpAction(token);
            setPending(false);
            if (result.error) {
              setError(result.error);
              return;
            }
            setSent(true);
          }}
        >
          Resend code
        </Button>
      </div>
    </div>
  );
}

function ReadyStep({ token, session }: { token: string; session: ReadySession }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState<{
    clientCopySent: boolean;
    clientCopyMaskedEmail: string;
  } | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [pageScale, setPageScale] = useState(1);
  const [signerName, setSignerName] = useState(session.signerName);
  const [signedDate, setSignedDate] = useState(formatDocumentDate(new Date().toISOString()));
  const [signerCapacity, setSignerCapacity] = useState("Client");
  const [initials, setInitials] = useState<CapturedMark>({
    kind: "type",
    png: "",
    text: session.signerName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 4)
      .toUpperCase(),
  });
  const [signature, setSignature] = useState<CapturedMark>({
    kind: "type",
    png: "",
    text: session.signerName,
  });

  async function submit() {
    const pages = session.requirePageInitials
      ? Array.from({ length: session.pageCount }, (_, index) => index + 1)
      : [];
    if (session.requirePageInitials && !hasMark(initials)) {
      setError("Add your initials before signing.");
      return;
    }
    if (!hasMark(signature)) {
      setError("Add your signature before signing.");
      return;
    }
    setPending(true);
    setError(null);
    const data = new FormData();
    data.set("token", token);
    data.set("consentAccepted", consentAccepted ? "true" : "false");
    data.set("requirePageInitials", session.requirePageInitials ? "true" : "false");
    data.set("signerName", signerName);
    data.set("signedDate", signedDate);
    data.set("signerCapacity", signerCapacity);
    data.set("signatureKind", signature.kind);
    data.set("signaturePng", signature.png);
    data.set("signatureText", signature.text);
    data.set("initialsKind", initials.kind);
    data.set("initialsPng", initials.png);
    data.set("initialsText", initials.text);
    data.set("initialledPages", JSON.stringify(pages));
    const result = await completeNativeSigningAction(data);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setComplete({
      clientCopySent: Boolean(result.clientCopySent),
      clientCopyMaskedEmail: result.clientCopyMaskedEmail ?? "",
    });
  }

  if (complete) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-16 text-center">
        <h2 className="font-serif text-2xl">SIGNED SUCCESSFULLY</h2>
        <p className="text-sm leading-6 text-ink-muted">
          Your signed agreement has been received.
          {complete.clientCopySent && complete.clientCopyMaskedEmail
            ? ` A copy has been emailed to ${complete.clientCopyMaskedEmail}.`
            : " A copy could not be emailed automatically. Your lawyer still has the signed agreement."}
        </p>
        <p className="text-sm leading-6 text-ink-muted">You may close this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm leading-6 text-ink-muted">
        Review the full costs agreement pack below, including any appended
        information sheet. Do not sign until you have read it. This is an
        electronic signature captured by Lexflow. It is not a qualified
        electronic signature.
      </p>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-medium">Agreement pack</p>
          <Button type="button" variant="ghost" onClick={() => setPageScale((value) => Math.max(0.7, value - 0.1))}>
            Zoom out
          </Button>
          <Button type="button" variant="ghost" onClick={() => setPageScale((value) => Math.min(1.8, value + 0.1))}>
            Zoom in
          </Button>
        </div>
        <div className="overflow-auto border border-rule bg-paper-raised">
          <iframe
            title="Costs agreement pack"
            src={`/sign/${token}/pack`}
            className="min-h-[70vh] w-full origin-top-left bg-paper-raised"
            style={{ transform: `scale(${pageScale})`, width: `${100 / pageScale}%` }}
          />
        </div>
      </div>

      {session.requirePageInitials ? (
        <div className="space-y-4 border border-rule bg-paper-raised px-4 py-5">
          <h2 className="font-serif text-xl">Initials</h2>
          <p className="text-sm leading-6 text-ink-muted">
            These initials are applied to every page of the agreement pack,
            including the information sheet.
          </p>
          <MarkPad label="Initials" value={initials} onChange={setInitials} compact />
        </div>
      ) : null}

      <div className="space-y-4 border border-rule bg-paper-raised px-4 py-5">
        <h2 className="font-serif text-xl">Sign</h2>
        <MarkPad label="Signature" value={signature} onChange={setSignature} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="signerName">Full name</Label>
            <Input
              id="signerName"
              value={signerName}
              onChange={(event) => setSignerName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signedDate">Date</Label>
            <Input
              id="signedDate"
              value={signedDate}
              onChange={(event) => setSignedDate(event.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="signerCapacity">Capacity</Label>
            <Input
              id="signerCapacity"
              value={signerCapacity}
              onChange={(event) => setSignerCapacity(event.target.value)}
              placeholder="Client"
            />
          </div>
        </div>
        <label className="flex items-start gap-3 text-sm leading-6">
          <input
            type="checkbox"
            className="mt-1"
            checked={consentAccepted}
            onChange={(event) => setConsentAccepted(event.target.checked)}
          />
          <span>{session.consentText}</span>
        </label>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="button" className="h-12 px-6 text-base" disabled={pending} onClick={submit}>
        {pending ? "Signing…" : "Sign"}
      </Button>
    </div>
  );
}

type CapturedMark = {
  kind: "draw" | "type";
  png: string;
  text: string;
};

function hasMark(mark: CapturedMark) {
  return mark.kind === "draw" ? Boolean(mark.png) : Boolean(mark.text.trim());
}

function MarkPad({
  label,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  value: CapturedMark;
  onChange: (value: CapturedMark) => void;
  compact?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    context.fillStyle = "#f7f4ee";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#0d1218";
    context.lineWidth = 2;
    context.lineCap = "round";
  }, []);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function commit(canvas: HTMLCanvasElement) {
    onChange({ ...value, kind: "draw", png: canvas.toDataURL("image/png") });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={value.kind === "draw" ? "primary" : "secondary"}
          onClick={() => onChange({ ...value, kind: "draw" })}
        >
          Draw
        </Button>
        <Button
          type="button"
          variant={value.kind === "type" ? "primary" : "secondary"}
          onClick={() => onChange({ ...value, kind: "type" })}
        >
          Type
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            const canvas = canvasRef.current;
            const context = canvas?.getContext("2d");
            if (canvas && context) {
              context.fillStyle = "#f7f4ee";
              context.fillRect(0, 0, canvas.width, canvas.height);
            }
            onChange({ kind: value.kind, png: "", text: "" });
          }}
        >
          Clear
        </Button>
      </div>
      {value.kind === "draw" ? (
        <canvas
          ref={canvasRef}
          width={compact ? 280 : 440}
          height={compact ? 90 : 140}
          className="w-full touch-none border border-rule-strong bg-paper"
          onPointerDown={(event) => {
            drawing.current = true;
            const canvas = canvasRef.current;
            const context = canvas?.getContext("2d");
            if (!canvas || !context) {
              return;
            }
            const { x, y } = point(event);
            context.beginPath();
            context.moveTo(x, y);
            canvas.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drawing.current) {
              return;
            }
            const canvas = canvasRef.current;
            const context = canvas?.getContext("2d");
            if (!canvas || !context) {
              return;
            }
            const { x, y } = point(event);
            context.lineTo(x, y);
            context.stroke();
          }}
          onPointerUp={(event) => {
            drawing.current = false;
            const canvas = canvasRef.current;
            if (canvas) {
              commit(canvas);
            }
            canvasRef.current?.releasePointerCapture(event.pointerId);
          }}
        />
      ) : (
        <Input
          aria-label={`Type ${label}`}
          value={value.text}
          onChange={(event) => onChange({ ...value, kind: "type", text: event.target.value })}
          className="font-serif text-2xl"
        />
      )}
    </div>
  );
}
