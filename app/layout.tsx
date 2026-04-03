import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, Poppins } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import SiteNav from "@/components/SiteNav";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Custom Demonlist",
  description: "Custom demonlist description lol",
};

const DEFAULT_THEME = "bacon";
const STORAGE_KEY = "theme";
const THEME_COOKIE = "theme";
const VALID_THEME_NAME = /^[a-z0-9-_]+$/i;

function pickTheme(value: string | undefined): string {
  if (!value) {
    return DEFAULT_THEME;
  }

  return VALID_THEME_NAME.test(value) ? value : DEFAULT_THEME;
}

function buildThemeBootstrapScript(fallbackTheme: string): string {
  return `(() => {
  try {
    const validTheme = /^[a-z0-9-_]+$/i;
    const root = document.documentElement;
    const storedTheme = window.localStorage.getItem("${STORAGE_KEY}");
    const baseTheme = root.getAttribute("data-theme") || "${fallbackTheme}";
    const theme = storedTheme && validTheme.test(storedTheme) ? storedTheme : baseTheme;

    root.setAttribute("data-theme", theme);

    const link = document.head.querySelector('link[data-theme-sheet="1"]');
    if (link) {
      link.setAttribute("href", "/themes/" + encodeURIComponent(theme) + ".css");
    }

    const oneYear = 60 * 60 * 24 * 365;
    document.cookie = "${THEME_COOKIE}=" + encodeURIComponent(theme) + "; Path=/; Max-Age=" + oneYear + "; SameSite=Lax";

    const computed = getComputedStyle(root);
    const accent = computed.getPropertyValue("--accent").trim();
    const secondary = computed.getPropertyValue("--secondary").trim();
    const primary = computed.getPropertyValue("--primary").trim();
    const hover = computed.getPropertyValue("--hover").trim();

    if (!accent) {
      root.style.setProperty("--accent", secondary || primary || "#ffadfd");
    }

    if (!hover) {
      root.style.setProperty("--hover", "color-mix(in oklab, var(--primary) 16%, var(--background))");
    }
  } catch {}
})();`;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialTheme = pickTheme(cookieStore.get(THEME_COOKIE)?.value);

  return (
    <html
      lang="en"
      data-theme={initialTheme}
      suppressHydrationWarning
      className={`${inter.variable} ${poppins.variable} h-full antialiased`}
    >
      <head>
        <link rel="stylesheet" href={`/themes/${initialTheme}.css`} data-theme-sheet="1" />
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {buildThemeBootstrapScript(initialTheme)}
        </Script>
      </head>
      <body
        className="min-h-full flex flex-col"
        style={{
          backgroundColor: "var(--background, #ffffff)",
          color: "var(--text, #111111)",
        }}
      >
        <SiteNav />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
