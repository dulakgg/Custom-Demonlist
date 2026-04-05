"use client";

import { useEffect, useState } from "react";
import { IoIosColorPalette } from "react-icons/io";

type ThemeListResponse = {
  themes?: string[];
};

const STORAGE_KEY = "theme";
const THEME_COOKIE = "theme";

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

  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${THEME_COOKIE}=${encodeURIComponent(theme)}; Path=/; Max-Age=${oneYear}; SameSite=Lax`;
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
    } catch { }
  }, [theme]);

  const hasThemes = themes.length > 0;

  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className={className}>
      <label className="sr-only" htmlFor="theme-select">
        Select theme
      </label>
      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => setModalOpen((prev) => !prev)}
          disabled={isLoadingThemes}
          className="cursor-pointer rounded-full inline border border-(--primary) bg-(--primary) p-1.5 px-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-wait disabled:opacity-80"
        >
          <div className="flex items-center gap-2">
            <IoIosColorPalette size={20}/>
            {isLoadingThemes ? "Loading..." : themeLabel(theme || "Default")}
          </div>
        </button>

        {modalOpen && (
          <div className="absolute right-0 mt-2 w-25 max-w-[calc(100vw-1rem)] rounded-xl border border-(--primary) bg-(--background) shadow-lg p-2 flex flex-col gap-1 z-50">

            {isLoadingThemes ? (
              <span className="text-sm text-(--text) px-2 py-1">
                Loading themes...
              </span>
            ) : hasThemes ? (
              themes.map((name) => (
                <button
                  key={name}
                  onClick={() => {
                    setTheme(name);
                    setModalOpen(false);
                  }}
                  className={`text-center text-(--text) px-3 py-1 rounded-lg hover:bg-(--secondary) transition ${theme === name ? "bg-(--secondary) font-semibold" : ""
                    }`}
                >
                  {themeLabel(name)}
                </button>
              ))
            ) : (
              <span className="text-sm text-(--text) px-2 py-1">
                No themes found
              </span>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
