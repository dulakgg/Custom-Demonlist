"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";
import { HiMenu, HiX } from "react-icons/hi";

const ThemeSwitch = dynamic(() => import("@/components/ThemeSwitch"), {
  ssr: false,
  loading: () => (
    <div className="h-9 w-32 rounded-full border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_16%,var(--background))]" />
  ),
});

type SessionUser = {
  id?: number | string;
  name?: string | null;
  discordId?: string;
  avatar?: string | null;
};

export default function SiteNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated" && session?.user;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const desktopMenuRef = useRef<HTMLDivElement | null>(null);

  const navItems = [
    { href: "/leaderboard", label: "List" },
    { href: "/profiles", label: "Leaderboard" },
  ];

  const user = isAuthed ? (session.user as SessionUser) : null;
  const nickname = user?.name || "Discord user";
  const id = user?.id ?? null;

  const avatarUrl =
    user?.avatar && user.discordId
      ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png`
      : "/images/default-avatar.jpg";

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!desktopMenuRef.current) {
        return;
      }

      const target = event.target as Node | null;
      if (target && !desktopMenuRef.current.contains(target)) {
        setDesktopMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

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
              <div className="relative" ref={desktopMenuRef}>
                <button
                  type="button"
                  onClick={() => setDesktopMenuOpen((value) => !value)}
                  className="flex cursor-pointer items-center"
                >
                  <span className="inline-flex h-9 items-center rounded-l-full border border-(--border) border-r-0 bg-[color-mix(in_srgb,var(--background)_90%,transparent)] px-3 text-sm">
                    {nickname}
                  </span>
                  <Image
                    src={avatarUrl}
                    alt="User avatar"
                    width={36}
                    height={36}
                    className="rounded-r-full border border-(--border)"
                  />
                </button>

                {desktopMenuOpen ? (
                  <div className="absolute right-0 z-50 mt-2 flex w-25 max-w-[calc(100vw-1rem)] flex-col gap-1 rounded-xl border border-(--primary) bg-(--background) p-2 shadow-lg">
                    <Link
                      href={id ? `/profile/${id}` : "/login"}
                      onClick={() => setDesktopMenuOpen(false)}
                      className="rounded-lg px-3 py-1 text-center text-(--text) transition hover:bg-(--secondary)"
                    >
                      Profile
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setDesktopMenuOpen(false);
                        signOut({ callbackUrl: "/login" });
                      }}
                      className="cursor-pointer rounded-lg px-3 py-1 text-center text-(--text) transition hover:bg-(--secondary)"
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}
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
              <div className="rounded-xl border border-(--border) p-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm">{nickname}</span>
                  <Image
                    src={avatarUrl}
                    alt="User avatar"
                    width={28}
                    height={28}
                    className="rounded-full"
                  />
                </div>
                <div className="mt-2 grid gap-1">
                  <Link
                    href={id ? `/profile/${id}` : "/login"}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg border border-(--border) px-3 py-2 text-sm text-(--text)"
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      signOut({ callbackUrl: "/login" });
                    }}
                    className="cursor-pointer rounded-lg border border-(--border) px-3 py-2 text-left text-sm text-(--text)"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
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