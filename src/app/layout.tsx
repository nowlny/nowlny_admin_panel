import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
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
  title: "Nowlny Admin",
  description: "Nowlny Admin Panel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
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
