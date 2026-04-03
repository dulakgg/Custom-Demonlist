"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ThemeSwitch = dynamic(() => import("@/components/ThemeSwitch"), {
  ssr: false,
  loading: () => (
    <div
      className="h-9 w-32 rounded-full border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_16%,var(--background))]"
      aria-hidden="true"
    />
  ),
});

const navItems = [
  { href: "/leaderboard", label: "Leaderboard" },
];

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-(--border) bg-[color-mix(in_srgb,var(--background)_88%,transparent)] backdrop-blur-md">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 md:px-6" aria-label="Primary">
        <Link
          href="/"
          className="flex items-center gap-2 text-[0.75rem] uppercase tracking-[0.16em] text-(--accent)"
        >
          Custom Demonlist
        </Link>

        <div className="flex items-center gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-(--primary) text-white"
                    : "border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_16%,var(--background))] text-(--primary) hover:bg-[color-mix(in_srgb,var(--primary)_26%,var(--background))]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <ThemeSwitch className="shrink-0" />
        </div>
      </nav>
    </header>
  );
}
