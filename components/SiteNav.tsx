"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import Image from "next/image";
import { HiMenu, HiX } from "react-icons/hi";

const ThemeSwitch = dynamic(() => import("@/components/ThemeSwitch"), {
  ssr: false,
  loading: () => (
    <div className="h-9 w-32 rounded-full border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_16%,var(--background))]" />
  ),
});

export default function SiteNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated" && session?.user;
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [{ href: "/leaderboard", label: "Leaderboard" }];

  const nickname = session?.user?.name || "Discord user";
  const id = isAuthed ? (session.user as any).id : null;

  const user = isAuthed ? session.user : null;

  const avatarUrl =
    user && (user as any).avatar && (user as any).discordId
      ? `https://cdn.discordapp.com/avatars/${(user as any).discordId
      }/${(user as any).avatar}.png`
      : "/images/default-avatar.jpg";

  return (
    <header className=" top-0 z-50 relative border-b border-(--border) bg-[color-mix(in_srgb,var(--background)_88%,transparent)] backdrop-blur-md">
      <nav
        className="mx-auto flex w-full max-w-6xl items-center px-4 py-3 md:px-6"
        aria-label="Primary"
      >
        {/* LOGO */}
        <Link
          href="/"
          className="flex items-center gap-2 text-4xl mr-5 uppercase tracking-[0.16em] text-(--accent)"
        >
          MOTD
        </Link>

        <ThemeSwitch className="shrink-0 m-0" />

        {/* DESKTOP NAV */}
        <div className="hidden md:flex w-full justify-end">
          <div className="flex items-center gap-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${isActive
                      ? "bg-(--primary) text-white"
                      : "border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_16%,var(--background))] text-(--primary) hover:bg-[color-mix(in_srgb,var(--primary)_26%,var(--background))]"
                    }`}
                >
                  {item.label}
                </Link>
              );
            })}

            {/* AUTH DESKTOP */}
            {status === "loading" ? (
              <div className="h-9 w-20 animate-pulse rounded-full border border-(--border)" />
            ) : status === "authenticated" ? (
              <div className="flex">
                <Link
                  href={`/profile/${id}`}
                  className="hidden rounded-l-full border border-(--border) p-1.5 px-3 text-sm md:inline-flex"
                >
                  {nickname}
                </Link>
                <Image
                  src={avatarUrl}
                  alt="User avatar"
                  width={32}
                  height={32}
                  className="rounded-r-full"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => signIn("discord", { callbackUrl: "/" })}
                className="rounded-full border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_16%,var(--background))] px-3 py-1.5 text-sm font-semibold text-(--primary) hover:bg-[color-mix(in_srgb,var(--primary)_26%,var(--background))]"
              >
                Login
              </button>
            )}
          </div>
        </div>

        {/* MOBILE BUTTON */}
        <button
          className="ml-auto md:hidden p-2 rounded-full border border-(--border)"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <HiX size={22} /> : <HiMenu size={22} />}
        </button>
      </nav>

      {/* MOBILE MENU */}
      {mobileOpen && (
        <div className="md:hidden absolute left-0 top-full w-full border-b border-(--border) bg-[color-mix(in_srgb,var(--background)_95%,transparent)] backdrop-blur-md">
          <div className="flex flex-col gap-2 p-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-full border border-(--primary) px-3 py-2 text-sm text-(--primary)"
              >
                {item.label}
              </Link>
            ))}

            {/* AUTH MOBILE */}
            {status === "loading" ? (
              <div className="h-9 w-full animate-pulse rounded-full border border-(--border)" />
            ) : status === "authenticated" ? (
              <div className="flex items-center justify-between rounded-full border border-(--border) px-3 py-2">
                <span className="text-sm">{nickname}</span>

                <Image
                  src={avatarUrl}
                  alt="User avatar"
                  width={28}
                  height={28}
                  className="rounded-full"
                />
              </div>
            ) : (
              <button
                onClick={() => {
                  setMobileOpen(false);
                  signIn("discord", { callbackUrl: "/" });
                }}
                className="rounded-full border border-(--primary) px-3 py-2 text-sm text-(--primary)"
              >
                Login
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}