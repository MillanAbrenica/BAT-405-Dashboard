import "./globals.css";
import type { Metadata } from "next";
import { Archivo } from "next/font/google";

/* One family; the width axis does the typographic work (expanded figures and headings, normal-width body). */
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });

export const metadata: Metadata = {
  title: "EduPulse — Program Chair Dashboard",
  description: "BAT 405 analytics dashboard integrating Student & Faculty Portal and SETE data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
