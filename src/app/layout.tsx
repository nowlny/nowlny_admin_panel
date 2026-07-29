import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { ConfirmProvider } from "./components/ui/ConfirmDialog";
import { I18nProvider } from "../lib/i18n";
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
    default: "Nowlny Admin",
    template: "%s · Nowlny Admin",
  },
  description: "Operations portal for the Nowlny delivery platform.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

/**
 * Applies the stored theme and language before first paint.
 *
 * The theme was previously applied in a `useEffect`, so every dark-mode user
 * saw a white flash on each load and every light-mode user saw a dark boot
 * screen. Language has the same problem but worse: Arabic operators would see
 * the whole panel laid out start-to-right and then snap. This runs
 * synchronously in `<head>`, before the browser paints.
 */
const bootScript = `
(function () {
  try {
    var stored = window.localStorage.getItem("nowlny_theme");
    var dark = stored
      ? stored === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
  try {
    var locale = window.localStorage.getItem("nowlny_locale");
    if (locale === "ar" || locale === "en") {
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <I18nProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </I18nProvider>
        <Toaster 
          position="top-center" 
          toastOptions={{
            className: '!bg-white dark:!bg-zinc-900 !text-zinc-900 dark:!text-white !border !border-zinc-200 dark:!border-zinc-800 !rounded-2xl !shadow-xl !text-sm !font-semibold !max-w-md !break-words text-center',
            style: {
              padding: '16px',
            },
            success: {
              iconTheme: {
                primary: '#f97316', // orange-500
                secondary: '#fff',
              },
            },
            error: {
              className: '!bg-red-50 dark:!bg-red-500/10 !text-red-600 dark:!text-red-400 !border-red-200 dark:!border-red-500/20 !border !rounded-2xl !shadow-xl !text-sm !font-semibold !max-w-md !break-words text-center',
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </body>
    </html>
  );
}
