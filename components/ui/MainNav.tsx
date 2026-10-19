"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";

const primary = [
  { href: "/", label: "Store map" },
  { href: "/plan", label: "Plan" },
  { href: "/review", label: "Review" },
  { href: "/check", label: "Floor Check" },
];

const more = [
  { href: "/models/model-arena", label: "Model Arena" },
  { href: "/graph", label: "Concept Graph" },
  { href: "/threads", label: "Golden Threads" },
  { href: "/exercises", label: "Exercises" },
];

const linkClass = (active: boolean) =>
  `rounded-md px-2 py-1.5 sm:px-2.5 ${active ? "text-ink bg-surface-2" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`;

/** Wide screens: the four main links plus a "More" menu. Narrow screens: one "Menu" button with everything. */
export function MainNav() {
  const path = usePathname();
  const moreRef = useRef<HTMLDetailsElement>(null);
  const mobileRef = useRef<HTMLDetailsElement>(null);
  const close = () => {
    if (moreRef.current) moreRef.current.open = false;
    if (mobileRef.current) mobileRef.current.open = false;
  };
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const menu = (items: typeof more) => (
    <div className="absolute right-0 top-full z-40 mt-1 min-w-48 rounded-xl border border-line bg-surface-1 p-1 shadow-lg">
      {items.map((n) => (
        <Link key={n.href} href={n.href} onClick={close} className={`block ${linkClass(isActive(n.href))}`}>
          {n.label}
        </Link>
      ))}
    </div>
  );
  return (
    <>
      <nav aria-label="Main" className="ml-auto hidden items-center gap-1 text-sm md:flex">
        {primary.map((n) => (
          <Link key={n.href} href={n.href} className={linkClass(isActive(n.href))} aria-current={isActive(n.href) ? "page" : undefined}>
            {n.label}
          </Link>
        ))}
        <details ref={moreRef} className="relative">
          <summary className={`cursor-pointer list-none ${linkClass(more.some((n) => isActive(n.href)))}`}>More ▾</summary>
          {menu(more)}
        </details>
      </nav>
      <nav aria-label="Main" className="ml-auto text-sm md:hidden">
        <details ref={mobileRef} className="relative">
          <summary className={`cursor-pointer list-none ${linkClass(false)}`} data-testid="mobile-menu">
            Menu ▾
          </summary>
          {menu([...primary, ...more])}
        </details>
      </nav>
    </>
  );
}
