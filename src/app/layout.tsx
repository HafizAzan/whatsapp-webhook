import type { Metadata } from "next";
import { Geist_Mono, Outfit } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "PulseBridge — Message Automation Hub",
  description: "WhatsApp webhooks, smart replies, broadcasting and automation control center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${geistMono.variable} h-full antialiased`}>
      <body
        suppressHydrationWarning
        className={`${outfit.className} h-full overflow-hidden bg-(--bg-base) text-(--text)`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
