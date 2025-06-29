import type { Metadata } from "next";
import { ClerkProvider } from '@clerk/nextjs';
import { TRPCProvider } from './providers';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pokemon TCG Deck Builder",
  description: "Build and analyze your Pokemon Trading Card Game decks",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1917" }
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <ThemeProvider>
          <ClerkProvider>
            <TRPCProvider>
              {children}
            </TRPCProvider>
          </ClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
