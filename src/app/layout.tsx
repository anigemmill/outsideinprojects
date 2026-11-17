import type { Metadata } from "next";
import "./globals.css";

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
