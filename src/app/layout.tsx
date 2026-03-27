import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kalshi Intel — Prediction Market Scanner",
  description: "Real-time intelligence scanner for Kalshi prediction markets. Velocity tracking, volume anomalies, correlation clusters.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full" style={{ background: '#0a0a0f' }}>{children}</body>
    </html>
  );
}
