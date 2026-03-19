import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppStateProvider } from "@/lib/store";
import Navbar from "@/components/dashboard/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Aligned Portfolio Dashboard",
  description: "Unified property management dashboard for AppFolio portfolios",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <AppStateProvider>
          <Navbar />
          <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </main>
        </AppStateProvider>
      </body>
    </html>
  );
}
