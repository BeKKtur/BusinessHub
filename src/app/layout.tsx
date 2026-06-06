import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "BusinessHub — CRM for Service Businesses",
    template: "%s · BusinessHub"
  },
  description:
    "BusinessHub is a CRM platform for service businesses to manage clients, appointments, services, finance analytics and Telegram reminders.",
  applicationName: "BusinessHub",
  keywords: [
    "BusinessHub",
    "CRM",
    "service business CRM",
    "appointments",
    "clients",
    "finance analytics",
    "Telegram reminders"
  ],
  authors: [{ name: "BusinessHub", url: "https://t.me/JustTriple_B" }],
  creator: "BusinessHub",
  publisher: "BusinessHub",
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "BusinessHub",
    title: "BusinessHub — CRM for Service Businesses",
    description:
      "Manage clients, appointments, services, finance analytics and Telegram reminders for your service business.",
    url: "/"
  },
  twitter: {
    card: "summary",
    title: "BusinessHub — CRM for Service Businesses",
    description:
      "Manage clients, appointments, services, finance analytics and Telegram reminders for your service business."
  },
  icons: {
    icon: "/icon.svg"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
