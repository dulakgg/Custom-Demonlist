import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
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
const THEME_BOOTSTRAP_SCRIPT = `(() => {
  try {
    const storedTheme = window.localStorage.getItem("theme");
    const theme = storedTheme || "${DEFAULT_THEME}";
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);

    const link = document.head.querySelector('link[data-theme-sheet="1"]');
    if (link) {
      link.setAttribute("href", "/themes/" + encodeURIComponent(theme) + ".css");
    }

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      suppressHydrationWarning
      className={`${inter.variable} ${poppins.variable} h-full antialiased`}
    >
      <head>
        <link rel="stylesheet" href={`/themes/${DEFAULT_THEME}.css`} data-theme-sheet="1" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
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
