import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EduPulse — Program Chair Dashboard",
  description: "BAT 405 analytics dashboard integrating Student & Faculty Portal and SETE data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
