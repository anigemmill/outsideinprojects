import { z } from "zod";

// Same minimum as Findable (12 characters) and as the Supabase Auth setting.
export const PASSWORD_MIN = 12;
const PASSWORD_MAX = 256;

export const email = z.string().trim().toLowerCase().pipe(z.email({ error: "Enter a valid email address." }).max(254));

export const password = z
  .string()
  .min(PASSWORD_MIN, { error: `Use at least ${PASSWORD_MIN} characters.` })
  .max(PASSWORD_MAX, { error: `Use at most ${PASSWORD_MAX} characters.` });

export const SignInInput = z.object({ email, password: z.string().min(1, { error: "Enter your password." }).max(PASSWORD_MAX) });
export const SignUpInput = z.object({ email, password });
export const EmailOnlyInput = z.object({ email });
export const NewPasswordInput = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { error: "The passwords don't match.", path: ["confirm"] });
export const TotpCodeInput = z.object({
  factorId: z.string().min(1).max(100),
  code: z.string().trim().regex(/^\d{6}$/, { error: "Enter the 6-digit code from your authenticator app." }),
});

export type FieldErrors = Partial<Record<string, string>>;

/** Turns a FormData into checked values, or field-level messages for the form. */
export function parseForm<T extends z.ZodType>(schema: T, form: FormData): { ok: true; data: z.infer<T> } | { ok: false; errors: FieldErrors } {
  const result = schema.safeParse(Object.fromEntries(form));
  if (result.success) return { ok: true, data: result.data };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return { ok: false, errors };
}
