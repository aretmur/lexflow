"use client";

import { useActionState } from "react";
import { uploadRequiredAttachmentAction } from "@/app/actions/attachments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormActionState } from "@/lib/validations";

const initialState: FormActionState = {};

export function AttachmentUploadForm() {
  const [state, formAction, pending] = useActionState(
    uploadRequiredAttachmentAction,
    initialState,
  );

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <div className="space-y-2">
        <Label htmlFor="file">PDF</Label>
        <Input id="file" name="file" type="file" accept="application/pdf" required />
      </div>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-ink">{state.message}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Uploading…" : "Upload version"}
      </Button>
    </form>
  );
}
