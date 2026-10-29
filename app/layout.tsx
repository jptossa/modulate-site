import type { Metadata } from "next";
import { Instrument_Sans, Instrument_Serif } from "next/font/google";
import { Suspense } from "react";
import { ChatWidget } from "@/components/chat/ChatWidget";
import "../styles/tokens.css";
import "../styles/bundle.css";
import "../components/ds/motion.css";
import "./globals.css";

const sans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const serif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Modulate — find your next career route",
    template: "%s · Modulate",
  },
  description:
    "Modulate shows which roles your skills already connect to, and what the job market says about each one.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>
        {children}
        {/* usePathname inside needs Suspense under cacheComponents; the widget has nothing to show until it loads. */}
        <Suspense fallback={null}>
          <ChatWidget />
        </Suspense>
      </body>
    </html>
  );
}
