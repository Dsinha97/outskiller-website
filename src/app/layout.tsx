import type { Metadata } from "next";
import { Fragment_Mono, Instrument_Sans, Spectral } from "next/font/google";
import "./globals.css";

const sans = Instrument_Sans({ variable: "--font-sans", subsets: ["latin"] });
const serif = Spectral({ variable: "--font-serif", subsets: ["latin"], weight: ["300", "400"], style: ["normal", "italic"] });
const mono = Fragment_Mono({ variable: "--font-mono", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: { default: "Outskiller Sprint HQ", template: "%s · Outskiller Sprint HQ" },
  description: "Team workspace for the Apart Research AI Collusion Research Sprint, Oct 23–25, 2026.",
  robots: { index: false, follow: false },
};

// Applies a saved theme before first paint so the page never flashes the wrong one.
const themeInit = `try{var t=localStorage.getItem("hq-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
