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

// Settles light or dark before the first paint, rather than a frame later as
// a flash of the other one. A choice made in the header wins; failing that the
// system is asked. It is a fixed string with nothing interpolated into it.
const resolveTheme = `try{var s=localStorage.getItem("theme");document.documentElement.dataset.theme=s==="dark"||s==="light"?s:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-AU"
      className={`${body.variable} ${display.variable} ${mono.variable} h-full antialiased`}
      // The script writes this attribute before React sees the page.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: resolveTheme }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
