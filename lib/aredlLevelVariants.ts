const API_BASE = "https://api.aredl.net/v2/api/aredl";
const REQUEST_TIMEOUT_MS = 12_000;
const REQUEST_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 650;

type AredlLevelCatalogEntry = {
  id?: string;
  level_id: number;
  name?: string;
  position?: number;
  points?: number | null;
  legacy?: boolean;
  two_player?: boolean | null;
  tags?: string[];
  description?: string;
  song?: number | null;
  edel_enjoyment?: number | null;
  is_edel_pending?: boolean | null;
  gddl_tier?: number | null;
  nlw_tier?: string | null;
  publisher?: {
    username?: string;
    global_name?: string;
  };
};

export type AredlLevelVariant = {
  aredlId: string | null;
  levelId: number;
  levelName: string | null;
  position: number | null;
  points: number | null;
  legacy: boolean | null;
  twoPlayer: boolean | null;
  tags: string[];
  description: string | null;
  song: number | null;
  edelEnjoyment: number | null;
  isEdelPending: boolean | null;
  gddlTier: number | null;
  nlwTier: string | null;
  publisherUsername: string | null;
  publisherGlobal: string | null;
};

export type AredlLevelVariantLookup = {
  byVariantKey: Map<string, AredlLevelVariant>;
  canonicalByLevelId: Map<number, AredlLevelVariant>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toSafeLevelId(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.round(value);
  return rounded > 0 ? rounded : null;
}

function toFiniteNumber(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function toSafeInt(value: number | null | undefined): number | null {
  const numeric = toFiniteNumber(value);
  return numeric === null ? null : Math.round(numeric);
}

function toVariantKey(levelId: number, twoPlayer: boolean): string {
  return `${levelId}:${twoPlayer ? "2p" : "solo"}`;
}

function normalizeVariant(entry: AredlLevelCatalogEntry): AredlLevelVariant | null {
  const levelId = toSafeLevelId(entry.level_id);

  if (!levelId) {
    return null;
  }

  const twoPlayer = typeof entry.two_player === "boolean" ? entry.two_player : null;

  return {
    aredlId: normalizeString(entry.id),
    levelId,
    levelName: normalizeString(entry.name),
    position: toFiniteNumber(entry.position),
    points: toSafeInt(entry.points),
    legacy: typeof entry.legacy === "boolean" ? entry.legacy : null,
    twoPlayer,
    tags: Array.isArray(entry.tags) ? entry.tags.filter((value): value is string => typeof value === "string") : [],
    description: normalizeString(entry.description),
    song: toSafeInt(entry.song),
    edelEnjoyment: toFiniteNumber(entry.edel_enjoyment),
    isEdelPending: typeof entry.is_edel_pending === "boolean" ? entry.is_edel_pending : null,
    gddlTier: toFiniteNumber(entry.gddl_tier),
    nlwTier: normalizeString(entry.nlw_tier),
    publisherUsername: normalizeString(entry.publisher?.username),
    publisherGlobal: normalizeString(entry.publisher?.global_name),
  };
}

function canonicalRank(variant: AredlLevelVariant): number {
  const preferSolo = variant.twoPlayer === false ? 20 : variant.twoPlayer === null ? 10 : 0;
  const hasPoints = variant.points !== null ? 2 : 0;
  const hasPosition = variant.position !== null ? 1 : 0;

  return preferSolo + hasPoints + hasPosition;
}

async function fetchJsonWithRetry<T>(url: string): Promise<T | null> {
  for (let attempt = 0; attempt <= REQUEST_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
      });

      if (response.ok) {
        return (await response.json()) as T;
      }

      const shouldRetry = response.status === 429 || response.status >= 500;
      if (!shouldRetry || attempt === REQUEST_RETRIES) {
        return null;
      }
    } catch {
      if (attempt === REQUEST_RETRIES) {
        return null;
      }
    } finally {
      clearTimeout(timeout);
    }

    await sleep(RETRY_BASE_DELAY_MS * (attempt + 1));
  }

  return null;
}

export async function fetchAredlLevelCatalog(): Promise<AredlLevelCatalogEntry[] | null> {
  const payload = await fetchJsonWithRetry<unknown>(`${API_BASE}/levels`);

  if (!Array.isArray(payload)) {
    return null;
  }

  return payload as AredlLevelCatalogEntry[];
}

export function buildAredlLevelVariantLookup(levelEntries: AredlLevelCatalogEntry[]): AredlLevelVariantLookup {
  const byVariantKey = new Map<string, AredlLevelVariant>();
  const canonicalByLevelId = new Map<number, AredlLevelVariant>();

  for (const levelEntry of levelEntries) {
    const variant = normalizeVariant(levelEntry);

    if (!variant) {
      continue;
    }

    if (typeof variant.twoPlayer === "boolean") {
      const key = toVariantKey(variant.levelId, variant.twoPlayer);
      if (!byVariantKey.has(key)) {
        byVariantKey.set(key, variant);
      }
    }

    const existingCanonical = canonicalByLevelId.get(variant.levelId);
    if (!existingCanonical || canonicalRank(variant) > canonicalRank(existingCanonical)) {
      canonicalByLevelId.set(variant.levelId, variant);
    }
  }

  return {
    byVariantKey,
    canonicalByLevelId,
  };
}

export function inferRecordTwoPlayer(
  explicitTwoPlayer: boolean | null | undefined,
  levelName: string | null | undefined,
): boolean | null {
  if (typeof explicitTwoPlayer === "boolean") {
    return explicitTwoPlayer;
  }

  const normalizedName = normalizeString(levelName);
  if (normalizedName && /\(2p\)/i.test(normalizedName)) {
    return true;
  }

  return null;
}

export function resolveAredlLevelVariant(
  lookup: AredlLevelVariantLookup,
  levelId: number,
  twoPlayer: boolean | null | undefined,
): AredlLevelVariant | null {
  if (typeof twoPlayer === "boolean") {
    const exactVariant = lookup.byVariantKey.get(toVariantKey(levelId, twoPlayer));
    if (exactVariant) {
      return exactVariant;
    }
  }

  return lookup.canonicalByLevelId.get(levelId) ?? null;
}
