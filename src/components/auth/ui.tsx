"use client";

import { useId } from "react";
import { useFormStatus } from "react-dom";

export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  error,
  hint,
  inputMode,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  error?: string;
  hint?: string;
  inputMode?: "numeric" | "email" | "text";
  defaultValue?: string;
}) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-[var(--color-text-muted)]">
          {hint}
        </p>
      )}
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        defaultValue={defaultValue}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="min-h-11 rounded-md border border-[var(--color-border-control)] bg-[var(--color-surface)] px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 aria-[invalid=true]:border-[var(--color-danger)]"
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ children, variant = "primary", name, value }: { children: React.ReactNode; variant?: "primary" | "secondary"; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  const styles =
    variant === "primary"
      ? "bg-[var(--color-action)] text-[var(--color-on-action)]"
      : "border border-[var(--color-border-control)] bg-[var(--color-surface)] text-[var(--color-text)]";
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-disabled={pending}
      className={`min-h-11 rounded-md px-4 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)] disabled:opacity-70 ${styles}`}
    >
      {pending ? "Working…" : children}
    </button>
  );
}

export function FormMessage({ error, notice }: { error?: string; notice?: string }) {
  if (error)
    return (
      <p role="alert" className="rounded-md border border-[var(--color-danger)] px-3 py-2 text-sm text-[var(--color-danger)]">
        {error}
      </p>
    );
  if (notice)
    return (
      <p role="status" className="rounded-md border border-[var(--color-success)] px-3 py-2 text-sm text-[var(--color-success)]">
        {notice}
      </p>
    );
  return null;
}
