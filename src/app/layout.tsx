import type { Metadata } from "next";
import Link from "next/link";
import localFont from "next/font/local";
import { ASSET_BASE_PATH } from "@/lib/config";
import BrandLogo from "@/components/BrandLogo";
import { CollectionSearchProvider } from "@/components/CollectionSearchContext";
import HeaderNav from "@/components/HeaderNav";
import "./globals.css";

const manrope = localFont({
  src: "../../public/fonts/manrope-variable.ttf",
  variable: "--font-manrope",
  display: "swap",
  weight: "200 800",
});

export const metadata: Metadata = {
  title: { default: "Vitrine — A considered collection", template: "%s · Vitrine" },
  description: "Track, compare, and grow your watch wishlist and collection.",
  applicationName: "Vitrine",
  icons: {
    icon: [
      { url: `${ASSET_BASE_PATH}/brand/vitrine-icon.svg`, type: "image/svg+xml" },
      { url: `${ASSET_BASE_PATH}/brand/favicon-32.png`, sizes: "32x32", type: "image/png" },
    ],
    apple: `${ASSET_BASE_PATH}/brand/apple-touch-icon.png`,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>
        <CollectionSearchProvider>
          <div className="min-h-screen">
            <header className="border-b border-cocoa-200 bg-white">
              <div className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-4 px-4 py-5">
                <Link href="/" aria-label="Vitrine home" className="shrink-0 rounded-sm">
                  <BrandLogo />
                </Link>
                <HeaderNav />
              </div>
            </header>
            <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
            <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-cocoa-400">
              Vitrine · A considered collection.
            </footer>
          </div>
        </CollectionSearchProvider>
      </body>
    </html>
  );
}
