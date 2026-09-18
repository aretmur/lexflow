import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const signupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name is too long"),
  email: z.email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password is too long"),
});

export const firmNameSchema = z
  .string()
  .trim()
  .min(2, "Firm name must be at least 2 characters")
  .max(200, "Firm name is too long");

export const createFirmSchema = z.object({
  name: firmNameSchema,
  practiceName: z.string().trim().max(200).optional(),
});

export const updateFirmSchema = z.object({
  name: firmNameSchema,
  practiceName: z.string().trim().max(200).optional(),
  abn: z.string().trim().max(20).optional(),
  email: z.union([z.literal(""), z.email("Enter a valid email address")]).optional(),
  phone: z.string().trim().max(40).optional(),
  addressLine1: z.string().trim().max(200).optional(),
  addressLine2: z.string().trim().max(200).optional(),
  suburb: z.string().trim().max(100).optional(),
  state: z.string().trim().max(40).optional(),
  postcode: z.string().trim().max(12).optional(),
});

export type FormActionState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

export function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
