import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import SWRegister from "@/components/sw-register";
import { NavigationProgress } from "@/components/navigation-progress";
import { ThemeScript } from "@/components/theme-script";
import { ChatProvider } from "@/contexts/chat-context";

export const metadata: Metadata = {
  title: "Catatan Pengeluaran Keluarga",
  description: "Pencatatan & analisis pengeluaran keluarga",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Catatan",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF8F5" },
    { media: "(prefers-color-scheme: dark)", color: "#141210" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        <SWRegister />
        <ChatProvider>
          {children}
        </ChatProvider>
      </body>
    </html>
  );
}
