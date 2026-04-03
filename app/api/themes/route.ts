import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

const THEMES_DIR = join(process.cwd(), "public", "themes");
const VALID_THEME_NAME = /^[a-z0-9-_]+$/i;

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entries = await readdir(THEMES_DIR, { withFileTypes: true });
    const themes = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".css"))
      .map((entry) => entry.name.replace(/\.css$/i, ""))
      .filter((name) => VALID_THEME_NAME.test(name))
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      themes: Array.from(new Set(themes)),
    });
  } catch {
    return NextResponse.json({ themes: [] });
  }
}