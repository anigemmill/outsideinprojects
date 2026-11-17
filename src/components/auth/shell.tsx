import Link from "next/link";

/** Layout for the sign-in and account pages: neutral Outside In branding, not any one product's. */
export function AuthShell({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-12">
      <p className="text-sm font-medium tracking-wide text-[var(--color-text-muted)]">
        <Link href="/" className="underline-offset-4 hover:underline">
          Outside In account
        </Link>
      </p>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="flex flex-col gap-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">{children}</div>
      {footer && <div className="flex flex-col gap-2 text-sm">{footer}</div>}
    </main>
  );
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-[var(--color-link)] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]">
      {children}
    </Link>
  );
}
