import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
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
  title: { default: "Planogram", template: "%s · Planogram" },
  description:
    "A visual, first-principles learning map for retail math, data science, ML engineering and agentic AI.",
};

const nav = [
  { href: "/", label: "Store map" },
  { href: "/check", label: "Floor Check" },
  { href: "/review", label: "Review" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Apply a saved theme before paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('planogram:theme');if(t)document.documentElement.dataset.theme=t}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <header className="no-print border-b border-line bg-surface-1/80 backdrop-blur sticky top-0 z-30">
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:gap-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span
                aria-hidden
                className="grid h-7 w-7 place-items-center rounded-md bg-accent text-sm text-white"
              >
                P
              </span>
              Planogram
            </Link>
            <nav className="ml-auto flex items-center gap-0.5 text-sm sm:gap-1">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded-md px-2 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink sm:px-2.5"
                >
                  {n.label}
                </Link>
              ))}
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="no-print border-t border-line px-4 py-6 text-center text-xs text-muted">
          Bolt &amp; Beam is a fictional retailer. All data is synthetic or public. Progress is
          stored only in this browser.
        </footer>
      </body>
    </html>
  );
}
