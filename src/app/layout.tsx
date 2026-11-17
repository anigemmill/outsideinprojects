import type { Metadata } from "next";
import "./globals.css";

// Every page here depends on the visitor's session, so nothing is prerendered at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Outside In account",
  description: "One account for every Outside In product.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-NZ">
      <body>{children}</body>
    </html>
  );
}
