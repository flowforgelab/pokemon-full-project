import type { Metadata } from "next";
import { ClerkProvider } from '@/components/providers/clerk-provider';
import { TRPCProvider } from './providers';
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
        <ClerkProvider>
          <TRPCProvider>
            {children}
          </TRPCProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
