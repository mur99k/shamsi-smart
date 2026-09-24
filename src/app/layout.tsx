import type { Metadata } from "next";
import "./globals.css";
import { SolarProvider } from "@/components/dashboard/SolarProvider";
import AppShell from "@/components/dashboard/AppShell";

export const metadata: Metadata = {
  title: "SolarWise — Intelligent Solar Energy Management",
  description:
    "AI-powered recommendation prototype for managing solar surplus energy. Simulation only.",
  metadataBase: new URL("https://shamsi-smart.vercel.app"),
  icons: { icon: "/logo-solarwise.png" },
  openGraph: {
    title: "SolarWise — Intelligent Solar Energy Management",
    description: "AI-powered recommendation prototype for managing solar surplus energy. Simulation only.",
    url: "https://shamsi-smart.vercel.app/",
    siteName: "SolarWise",
    locale: "ar_SA",
    type: "website",
    images: [{ url: "/logo.png", width: 1189, height: 750, alt: "SolarWise logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SolarWise — Intelligent Solar Energy Management",
    description: "AI-powered recommendation prototype for managing solar surplus energy.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Root layout persists across all App Router pages. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased"><SolarProvider><AppShell>{children}</AppShell></SolarProvider></body>
    </html>
  );
}
