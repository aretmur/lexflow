import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-paper-raised hover:bg-accent-hover disabled:bg-rule disabled:text-ink-muted",
  secondary:
    "border border-rule-strong bg-paper-raised text-ink hover:border-ink disabled:opacity-50",
  ghost: "text-ink-muted hover:text-ink disabled:opacity-50",
  danger: "bg-danger text-paper-raised hover:opacity-90 disabled:opacity-50",
};

export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-10 items-center justify-center px-4 text-sm font-medium tracking-wide transition-colors disabled:cursor-not-allowed",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
