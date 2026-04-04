import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import players from "../../../../players.json";

const API_BASE = "https://api.aredl.net/v2/api/aredl";
const PROFILE_CONCURRENCY = 2;
const DETAILS_CONCURRENCY = 2;
const REQUEST_TIMEOUT_MS = 12_000;
const REQUEST_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 450;
const BETWEEN_REQUEST_DELAY_MS = 130;

let refreshInProgress = false;

type CompletionRecord = {
  id: string;
  created_at?: string;
  video_url: string | null;
  level: {
    level_id: number;
    name: string;
    position: number;
    legacy?: boolean;
  };
};

type PlayerProfileResponse = {
  username: string;
  global_name?: string | null;
  records?: CompletionRecord[];
};

type LevelDetailsResponse = {
  id: string;
  level_id: number;
  position: number;
  name: string;
  points?: number | null;
  legacy?: boolean;
  two_player?: boolean;
  tags?: string[];
  description?: string;
  song?: number | null;
  edel_enjoyment?: number | null;
  is_edel_pending?: boolean;
  gddl_tier?: number | null;
  nlw_tier?: string | null;
  publisher?: {
    username?: string;
    global_name?: string;
  };
};

type AggregatedRecord = {
  id: string;
  playerDisplayName: string;
  playerUsername: string;
  isListedPlayer: boolean;
  completedAt: string | undefined;
  videoUrl: string | null;
};

type AggregatedLevel = {
  levelId: number;
  levelName: string;
  position: number;
  legacy: boolean;
  thumbnailUrl: string;
  records: AggregatedRecord[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function levelThumbnail(levelId: number): string {
  return `https://raw.githubusercontent.com/All-Rated-Extreme-Demon-List/Thumbnails/main/levels/cards/${levelId}.webp`;
}

function parseOptionalDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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

function readProvidedSecret(request: NextRequest): string | null {
  const fromQuery = request.nextUrl.searchParams.get("secret");
  if (fromQuery) {
    return fromQuery;
  }

  const fromHeader = request.headers.get("x-refresh-secret");
  if (fromHeader) {
    return fromHeader;
  }

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  return null;
}

function secretsMatch(expectedSecret: string, providedSecret: string): boolean {
  const expected = Buffer.from(expectedSecret);
  const provided = Buffer.from(providedSecret);

  if (expected.length !== provided.length) {
    return false;
  }

  return timingSafeEqual(expected, provided);
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

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const current = nextIndex;
      if (current >= items.length) {
        return;
      }

      nextIndex += 1;
      results[current] = await mapper(items[current], current);

      if (BETWEEN_REQUEST_DELAY_MS > 0) {
        await sleep(BETWEEN_REQUEST_DELAY_MS);
      }
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

async function fetchPlayerProfile(username: string): Promise<PlayerProfileResponse | null> {
  return fetchJsonWithRetry<PlayerProfileResponse>(`${API_BASE}/profile/${encodeURIComponent(username)}`);
}

async function fetchLevelDetails(levelId: number): Promise<LevelDetailsResponse | null> {
  return fetchJsonWithRetry<LevelDetailsResponse>(`${API_BASE}/levels/${levelId}`);
}

function buildLeaderboardLevels(usernames: string[], profiles: PlayerProfileResponse[]): AggregatedLevel[] {
  const listedPlayers = new Set(usernames.map((username) => username.toLowerCase()));
  const levelMap = new Map<number, AggregatedLevel>();

  for (const profile of profiles) {
    const playerUsername = profile.username.trim();
    const playerDisplayName = (profile.global_name || playerUsername).trim();
    const isListedPlayer = listedPlayers.has(playerUsername.toLowerCase());

    for (const record of profile.records ?? []) {
      if (!levelMap.has(record.level.level_id)) {
        levelMap.set(record.level.level_id, {
          levelId: record.level.level_id,
          levelName: record.level.name,
          position: record.level.position,
          legacy: Boolean(record.level.legacy),
          thumbnailUrl: levelThumbnail(record.level.level_id),
          records: [],
        });
      }

      levelMap.get(record.level.level_id)?.records.push({
        id: record.id,
        playerDisplayName,
        playerUsername,
        isListedPlayer,
        completedAt: record.created_at,
        videoUrl: record.video_url,
      });
    }
  }

  return Array.from(levelMap.values());
}

async function refreshLeaderboard(request: NextRequest): Promise<NextResponse> {
  const providedSecret = readProvidedSecret(request);
  const expectedSecret = process.env.LEADERBOARD_REFRESH_SECRET;

  if (!expectedSecret) {
    return NextResponse.json(
      { message: "Missing LEADERBOARD_REFRESH_SECRET in environment." },
      { status: 500 },
    );
  }

  if (!providedSecret || !secretsMatch(expectedSecret, providedSecret)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  if (refreshInProgress) {
    return NextResponse.json(
      { message: "Refresh already in progress. Please wait and try again." },
      { status: 429 },
    );
  }

  refreshInProgress = true;

  try {
    const usernames = players.map((username) => username.trim()).filter(Boolean);
    const profileResponses = await mapWithConcurrency(
      usernames,
      PROFILE_CONCURRENCY,
      async (username) => fetchPlayerProfile(username),
    );
    const profiles = profileResponses.filter((profile): profile is PlayerProfileResponse => profile !== null);
    const levels = buildLeaderboardLevels(usernames, profiles);

    const detailResponses = await mapWithConcurrency(levels, DETAILS_CONCURRENCY, async (level) =>
      fetchLevelDetails(level.levelId),
    );
    const detailsByLevelId = new Map<number, LevelDetailsResponse>();

    for (let index = 0; index < levels.length; index += 1) {
      const details = detailResponses[index];
      if (details) {
        detailsByLevelId.set(levels[index].levelId, details);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.levelRecord.deleteMany();
      await tx.level.deleteMany();

      if (levels.length === 0) {
        return;
      }

      await tx.level.createMany({
        data: levels.map((level) => {
          const details = detailsByLevelId.get(level.levelId);
          const position = toFiniteNumber(details?.position) ?? toFiniteNumber(level.position) ?? 0;

          return {
            levelId: level.levelId,
            levelName: details?.name?.trim() || level.levelName,
            position,
            legacy: details?.legacy ?? level.legacy,
            thumbnailUrl: level.thumbnailUrl,
            aredlId: details?.id ?? null,
            points: toSafeInt(details?.points),
            twoPlayer: details?.two_player ?? null,
            tags: details?.tags ?? [],
            description: details?.description || null,
            song: toSafeInt(details?.song),
            edelEnjoyment: toFiniteNumber(details?.edel_enjoyment),
            isEdelPending: details?.is_edel_pending ?? null,
            gddlTier: toFiniteNumber(details?.gddl_tier),
            nlwTier: details?.nlw_tier || null,
            publisherUsername: details?.publisher?.username || null,
            publisherGlobal: details?.publisher?.global_name || null,
          };
        }),
      });

      for (const level of levels) {
        if (level.records.length === 0) {
          continue;
        }

        await tx.levelRecord.createMany({
          data: level.records.map((record) => ({
            id: record.id,
            levelId: level.levelId,
            playerDisplayName: record.playerDisplayName,
            playerUsername: record.playerUsername,
            isListedPlayer: record.isListedPlayer,
            completedAt: parseOptionalDate(record.completedAt),
            videoUrl: record.videoUrl,
          })),
          skipDuplicates: true,
        });
      }
    });

    revalidatePath("/leaderboard");

    return NextResponse.json({
      message: "Leaderboard cache refreshed.",
      refreshedAt: new Date().toISOString(),
      levels: levels.length,
      records: levels.reduce((sum, level) => sum + level.records.length, 0),
      fetchedProfiles: profiles.length,
      missingProfiles: usernames.length - profiles.length,
      levelsWithDetails: detailsByLevelId.size,
    });
  } catch {
    return NextResponse.json(
      { message: "Refresh failed. Try again in a moment." },
      { status: 500 },
    );
  } finally {
    refreshInProgress = false;
  }
}

export async function GET(request: NextRequest) {
  return refreshLeaderboard(request);
}

export async function POST(request: NextRequest) {
  return refreshLeaderboard(request);
}