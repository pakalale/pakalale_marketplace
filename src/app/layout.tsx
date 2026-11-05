import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import SuppressExtensionErrors from "@/components/SuppressExtensionErrors";
import ContextMenuBlocker from "@/components/ContextMenuBlocker";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { themeInitScript } from "@/lib/theme";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Pakalale — Your Local Trading Platform",
  description:
    "Connect with local shops across Lusaka's major trading areas. Find products, compare prices, and support your community.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      translate="no"
      className={`${inter.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the saved theme before first paint (light is the default). */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full bg-background text-foreground antialiased">
        <ThemeProvider>
          <SuppressExtensionErrors />
          <ContextMenuBlocker />
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "var(--popover)",
                color: "var(--popover-foreground)",
                border: "1px solid var(--border)",
              },
              success: {
                iconTheme: {
                  primary: "var(--primary)",
                  secondary: "var(--primary-foreground)",
                },
              },
              error: {
                iconTheme: {
                  primary: "var(--destructive)",
                  secondary: "var(--popover)",
                },
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
