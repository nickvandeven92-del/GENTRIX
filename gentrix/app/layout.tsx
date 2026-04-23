import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { PortalPwaRoot } from "@/components/portal/portal-pwa-root";
import { NavigationProgress } from "@/components/navigation-progress";
import { GentrixAnalyticsRoot } from "@/components/analytics/gentrix-analytics-root";
import { GentrixIframeAnalyticsListener } from "@/components/analytics/gentrix-iframe-analytics-listener";
import { ADMIN_DASHBOARD_THEME_STORAGE_KEY } from "@/lib/admin/dashboard-theme";
import { PUBLIC_BRAND } from "@/lib/constants";
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
  title: {
    default: PUBLIC_BRAND,
    template: "%s",
  },
  description: "Premium webdesign en digitale ervaringen.",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: process.env.NEXT_PUBLIC_PWA_SHORT_NAME ?? "Portaal",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="nl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Script
          id="admin-dashboard-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(!/^\\/admin(\\/|$)/.test(location.pathname))return;var k=${JSON.stringify(ADMIN_DASHBOARD_THEME_STORAGE_KEY)};var d=document.documentElement;d.classList.remove("admin-theme-light","admin-theme-dark","admin-theme-glass","dark");d.classList.add("admin-theme-light");try{localStorage.setItem(k,"light");}catch(e2){}}catch(e){}})();`,
          }}
        />
        <NavigationProgress />
        <Suspense fallback={null}>
          <GentrixAnalyticsRoot />
        </Suspense>
        <GentrixIframeAnalyticsListener />
        {children}
        <PortalPwaRoot />
      </body>
    </html>
  );
}
