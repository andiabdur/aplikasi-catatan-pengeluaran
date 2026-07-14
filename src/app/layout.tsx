import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import SWRegister from "@/components/sw-register";
import { NavigationProgress } from "@/components/navigation-progress";
import { ThemeScript } from "@/components/theme-script";

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
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
        {children}
      </body>
    </html>
  );
}
