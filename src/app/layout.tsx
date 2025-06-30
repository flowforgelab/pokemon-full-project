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
  description: "Build, analyze, and manage your Pokemon Trading Card Game decks with AI-powered recommendations",
  keywords: ["Pokemon", "TCG", "Trading Card Game", "Deck Builder", "Pokemon Cards", "Deck Analysis"],
  authors: [{ name: "Pokemon TCG Community" }],
  creator: "Pokemon TCG Community",
  manifest: "/manifest.json",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://pokemon-tcg-deck-builder.vercel.app'),
  openGraph: {
    title: "Pokemon TCG Deck Builder",
    description: "Build, analyze, and manage your Pokemon Trading Card Game decks with AI-powered recommendations",
    url: "/",
    siteName: "Pokemon TCG Deck Builder",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Pokemon TCG Deck Builder - Build winning decks",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pokemon TCG Deck Builder",
    description: "Build, analyze, and manage your Pokemon Trading Card Game decks with AI-powered recommendations",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: "/icons/icon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-icon-180x180.png", sizes: "180x180", type: "image/png" },
    ],
  },
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
