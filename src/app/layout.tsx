import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

// Body: a plain grotesque, so the interface itself reads as neutral.
const body = Geist({
  variable: "--font-body",
  subsets: ["latin"],
});

// Headings: a serif with optical sizing, because what this product makes is a
// document, and it should look like one from the first screen.
const display = Source_Serif_4({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz"],
});

// The rendered Guide and Envelope, which are Markdown and stay monospaced.
const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Handover",
  description:
    "A guided conversation that records what the people you leave behind will need to know.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-AU"
      className={`${body.variable} ${display.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
