import type { Metadata } from "next";
import Link from "next/link";
import { IS_STATIC } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: "Watch Researcher",
  description: "Track, compare, and grow your watch wishlist and collection.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
              <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
                <span aria-hidden className="text-xl">⌚</span>
                Watch Researcher
              </Link>
              <nav className="flex items-center gap-2">
                <Link href="/" className="btn-secondary">
                  Collection
                </Link>
                {!IS_STATIC && (
                  <Link href="/watch/quick" className="btn-primary">
                    + Add watch
                  </Link>
                )}
              </nav>
            </div>
          </header>
          {IS_STATIC && (
            <div className="border-b border-amber-200 bg-amber-50">
              <div className="mx-auto max-w-6xl px-4 py-2 text-center text-xs text-amber-800">
                📖 Read-only published view — edit your collection locally and push to update.
              </div>
            </div>
          )}
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-slate-400">
            Watch Researcher · your personal collection, tracked in one place
          </footer>
        </div>
      </body>
    </html>
  );
}
