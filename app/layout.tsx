import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ladang Alir",
  description: "Pengurusan petak, jadual penanaman dan pengeluaran serentak ladang.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ms">
      <body className="antialiased">{children}</body>
    </html>
  );
}
