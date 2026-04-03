"use client";

import { useEffect, useState } from "react";

type ThemeListResponse = {
  themes?: string[];
};

const STORAGE_KEY = "theme";

function themeLabel(name: string): string {
  return name.replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function applyTheme(theme: string) {
  document.documentElement.setAttribute("data-theme", theme);

  let link = document.head.querySelector<HTMLLinkElement>('link[data-theme-sheet="1"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "stylesheet";
    link.setAttribute("data-theme-sheet", "1");
    document.head.appendChild(link);
  }

  const href = `/themes/${encodeURIComponent(theme)}.css`;
  if (link.getAttribute("href") !== href) {
    link.setAttribute("href", href);
  }
}

export default function ThemeSwitch({ className }: { className?: string }) {
  const [themes, setThemes] = useState<string[]>([]);
  const [theme, setTheme] = useState<string>("");
  const [isLoadingThemes, setIsLoadingThemes] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    async function loadThemes() {
      setIsLoadingThemes(true);

      try {
        const response = await fetch("/api/themes", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load themes");
        }

        const payload = (await response.json()) as ThemeListResponse;
        const availableThemes = Array.isArray(payload.themes) ? payload.themes : [];

        if (cancelled) {
          return;
        }

        setThemes(availableThemes);

        const storedTheme = window.localStorage.getItem(STORAGE_KEY);
        const htmlTheme = document.documentElement.getAttribute("data-theme");
        const preferredTheme = storedTheme || htmlTheme || "";
        const initialTheme = availableThemes.includes(preferredTheme)
          ? preferredTheme
          : (availableThemes[0] || preferredTheme);

        setTheme(initialTheme);
      } catch {
        if (!cancelled) {
          setThemes([]);
          setTheme(document.documentElement.getAttribute("data-theme") || "");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingThemes(false);
        }
      }
    }

    void loadThemes();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!theme) {
      return;
    }

    applyTheme(theme);

    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  const hasThemes = themes.length > 0;

  return (
    <div className={className}>
      <label className="sr-only" htmlFor="theme-select">
        Select theme
      </label>
      <select
        id="theme-select"
        value={hasThemes ? theme : ""}
        onChange={(event) => setTheme(event.target.value)}
        disabled={isLoadingThemes || !hasThemes}
        className="cursor-pointer rounded-full border border-(--primary) bg-(--primary) px-3 py-1.5 pr-8 text-sm font-semibold text-white transition hover:brightness-110 outline-none focus:border-(--secondary) focus:ring-2 focus:ring-[color-mix(in_srgb,var(--secondary)_40%,transparent)] disabled:cursor-wait disabled:opacity-80"
        title="Theme"
        aria-label="Theme"
      >
        {hasThemes ? (
          themes.map((name) => (
            <option key={name} value={name}>
              {themeLabel(name)}
            </option>
          ))
        ) : (
          <option value="">No themes found</option>
        )}
      </select>
    </div>
  );
}
