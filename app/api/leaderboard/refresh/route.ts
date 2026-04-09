import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CACHE_TAGS, ROUTES } from "@/lib/routes";
import players from "../../../../players.json";

const API_BASE = "https://api.aredl.net/v2/api/aredl";
const PROFILE_CONCURRENCY = 1;
const DETAILS_CONCURRENCY = 1;
const REQUEST_TIMEOUT_MS = 12_000;
const REQUEST_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 650;
const BETWEEN_REQUEST_DELAY_MS = 1_000;
const PHASE_PAUSE_MS = 2_000;
const RECORD_INSERT_CHUNK_SIZE = 500;
const WEBHOOK_PROGRESS_STEP_PERCENT = 5;
const DISCORD_REFRESH_WEBHOOK_URL = process.env.LEADERBOARD_REFRESH_DISCORD_WEBHOOK_URL;

let refreshInProgress = false;

type CompletionRecord = {
  id: string;
  created_at?: string;
  video_url: string | null;
  level: {
    level_id: number;
    name: string;
    position: number;
    points?: number | null;
    legacy?: boolean;
    two_player?: boolean | null;
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
  points: number | null;
  legacy: boolean;
  twoPlayer: boolean | null;
  thumbnailUrl: string;
  records: AggregatedRecord[];
};

type RefreshStage = "starting" | "profiles" | "details" | "database" | "done" | "failed";

type ProgressUpdate = {
  stage: RefreshStage;
  completed?: number;
  total?: number;
  note?: string;
  force?: boolean;
};

type DiscordWebhookCreateResponse = {
  id?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toPercent(completed: number, total: number): number {
  if (total <= 0) {
    return 100;
  }

  return Math.max(0, Math.min(100, Math.floor((completed / total) * 100)));
}

function buildDiscordWebhookMessageUrl(webhookUrl: string, messageId?: string, wait = false): string {
  const url = new URL(webhookUrl);

  if (messageId) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}/messages/${messageId}`;
  }

  if (wait) {
    url.searchParams.set("wait", "true");
  } else {
    url.searchParams.delete("wait");
  }

  return url.toString();
}

function formatWebhookContent(update: ProgressUpdate): string {
  const lines = [`Leaderboard refresh: ${update.stage}`];

  if (typeof update.completed === "number" && typeof update.total === "number") {
    lines.push(`Progress: ${update.completed}/${update.total} (${toPercent(update.completed, update.total)}%)`);
  }

  if (update.note) {
    lines.push(update.note);
  }

  lines.push(`Updated: ${new Date().toISOString()}`);
  return lines.join("\n");
}

function createDiscordProgressReporter(webhookUrl: string | undefined) {
  let messageId: string | null = null;
  let lastProgressKey = "";

  return async (update: ProgressUpdate): Promise<void> => {
    if (!webhookUrl) {
      return;
    }

    const percent =
      typeof update.completed === "number" && typeof update.total === "number"
        ? toPercent(update.completed, update.total)
        : 0;
    const progressBucket = Math.floor(percent / WEBHOOK_PROGRESS_STEP_PERCENT);
    const progressKey = `${update.stage}:${progressBucket}`;

    if (!update.force && progressKey === lastProgressKey) {
      return;
    }

    const payload = { content: formatWebhookContent(update) };

    try {
      if (!messageId) {
        const createResponse = await fetch(buildDiscordWebhookMessageUrl(webhookUrl, undefined, true), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });

        if (!createResponse.ok) {
          return;
        }

        const created = (await createResponse.json()) as DiscordWebhookCreateResponse;
        messageId = created.id ?? null;
      } else {
        await fetch(buildDiscordWebhookMessageUrl(webhookUrl, messageId), {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });
      }

      lastProgressKey = progressKey;
    } catch {
      // Webhook failures should never interrupt refresh.
    }
  };
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
  onProgress?: (result: R, index: number, completed: number, total: number) => Promise<void>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let completed = 0;

  async function runWorker() {
    while (true) {
      const current = nextIndex;
      if (current >= items.length) {
        return;
      }

      nextIndex += 1;
      const result = await mapper(items[current], current);
      results[current] = result;
      completed += 1;

      if (onProgress) {
        await onProgress(result, current, completed, items.length);
      }

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

function buildLeaderboardLevels(listedPlayerUsernames: string[], profiles: PlayerProfileResponse[]): AggregatedLevel[] {
  const listedPlayers = new Set(listedPlayerUsernames.map((username) => username.trim().toLowerCase()).filter(Boolean));
  const levelMap = new Map<number, AggregatedLevel>();

  for (const profile of profiles) {
    const playerUsername = profile.username.trim();
    const playerDisplayName = (profile.global_name || playerUsername).trim();
    const isListedPlayer = listedPlayers.has(playerUsername.toLowerCase());

    for (const record of profile.records ?? []) {
      const levelPoints = toSafeInt(record.level.points);
      const levelTwoPlayer = typeof record.level.two_player === "boolean" ? record.level.two_player : null;

      if (!levelMap.has(record.level.level_id)) {
        levelMap.set(record.level.level_id, {
          levelId: record.level.level_id,
          levelName: record.level.name,
          position: record.level.position,
          points: levelPoints,
          legacy: Boolean(record.level.legacy),
          twoPlayer: levelTwoPlayer,
          thumbnailUrl: levelThumbnail(record.level.level_id),
          records: [],
        });
      }

      const existingLevel = levelMap.get(record.level.level_id);
      if (existingLevel) {
        if (levelPoints !== null) {
          existingLevel.points = levelPoints;
        }

        if (levelTwoPlayer !== null) {
          existingLevel.twoPlayer = levelTwoPlayer;
        }
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
  const reportProgress = createDiscordProgressReporter(DISCORD_REFRESH_WEBHOOK_URL);

  try {
    const listedPlayerUsernames = players.map((username) => username.trim()).filter(Boolean);
    const registeredProfileUsernames = (
      await prisma.user.findMany({
        where: {
          discord_username: {
            not: null,
          },
        },
        select: {
          discord_username: true,
        },
      })
    )
      .map((user) => user.discord_username?.trim() ?? "")
      .filter(Boolean);

    const profileIdentifiers = [] as string[];
    const seenProfileIdentifiers = new Set<string>();

    for (const identifier of [...listedPlayerUsernames, ...registeredProfileUsernames]) {
      const normalized = identifier.toLowerCase();
      if (seenProfileIdentifiers.has(normalized)) {
        continue;
      }

      seenProfileIdentifiers.add(normalized);
      profileIdentifiers.push(identifier);
    }

    await reportProgress({
      stage: "starting",
      note: `Queued profiles: ${profileIdentifiers.length} (listed: ${listedPlayerUsernames.length}, users: ${registeredProfileUsernames.length})`,
      force: true,
    });

    await sleep(PHASE_PAUSE_MS);

    const profileResponses = await mapWithConcurrency(
      profileIdentifiers,
      PROFILE_CONCURRENCY,
      async (username) => fetchPlayerProfile(username),
      async (profile, index, completed, total) => {
        const username = profileIdentifiers[index] ?? "unknown";
        await reportProgress({
          stage: "profiles",
          completed,
          total,
          note: profile ? `Fetched profile: ${username}` : `Missing profile: ${username}`,
          force: completed === total,
        });
      },
    );

    await sleep(PHASE_PAUSE_MS);

    const profiles = profileResponses.filter((profile): profile is PlayerProfileResponse => profile !== null);
    const levels = buildLeaderboardLevels(listedPlayerUsernames, profiles);
    const totalRecords = levels.reduce((sum, level) => sum + level.records.length, 0);

    const detailResponses = await mapWithConcurrency(
      levels,
      DETAILS_CONCURRENCY,
      async (level) => fetchLevelDetails(level.levelId),
      async (details, index, completed, total) => {
        const level = levels[index];
        await reportProgress({
          stage: "details",
          completed,
          total,
          note: details
            ? `Fetched level details: #${level.levelId} ${level.levelName}`
            : `Missing level details: #${level.levelId} ${level.levelName}`,
          force: completed === total,
        });
      },
    );
    const detailsByLevelId = new Map<number, LevelDetailsResponse>();

    for (let index = 0; index < levels.length; index += 1) {
      const details = detailResponses[index];
      if (details) {
        detailsByLevelId.set(levels[index].levelId, details);
      }
    }

    await reportProgress({
      stage: "database",
      note: `Writing ${levels.length} levels and ${totalRecords} records to database.`,
      force: true,
    });

    await sleep(PHASE_PAUSE_MS);

    const levelRows = levels.map((level) => {
      const details = detailsByLevelId.get(level.levelId);
      const position = toFiniteNumber(details?.position) ?? toFiniteNumber(level.position) ?? 0;
      const detailsTwoPlayer = typeof details?.two_player === "boolean" ? details.two_player : null;
      const mergedTwoPlayer =
        level.twoPlayer === true || detailsTwoPlayer === true
          ? true
          : detailsTwoPlayer ?? level.twoPlayer ?? null;
      const mergedPoints = toSafeInt(details?.points) ?? level.points;

      return {
        levelId: level.levelId,
        levelName: details?.name?.trim() || level.levelName,
        position,
        legacy: details?.legacy ?? level.legacy,
        thumbnailUrl: level.thumbnailUrl,
        aredlId: details?.id ?? null,
        points: mergedPoints,
        twoPlayer: mergedTwoPlayer,
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
    });

    const recordRows = levels.flatMap((level) =>
      level.records.map((record) => ({
        id: record.id,
        levelId: level.levelId,
        playerDisplayName: record.playerDisplayName,
        playerUsername: record.playerUsername,
        isListedPlayer: record.isListedPlayer,
        completedAt: parseOptionalDate(record.completedAt),
        videoUrl: record.videoUrl,
      })),
    );

    await prisma.$transaction(
      async (tx) => {
        await tx.levelRecord.deleteMany();
        await tx.level.deleteMany();

        if (levelRows.length === 0) {
          return;
        }

        await tx.level.createMany({ data: levelRows });

        for (let index = 0; index < recordRows.length; index += RECORD_INSERT_CHUNK_SIZE) {
          await tx.levelRecord.createMany({
            data: recordRows.slice(index, index + RECORD_INSERT_CHUNK_SIZE),
            skipDuplicates: true,
          });
        }
      },
      {
        maxWait: 15_000,
        timeout: 180_000,
      },
    );

    revalidateTag(CACHE_TAGS.leaderboardLevels, "max");
    revalidateTag(CACHE_TAGS.profilesLeaderboard, "max");
    revalidatePath(ROUTES.leaderboard);
    revalidatePath(ROUTES.profiles);

    await reportProgress({
      stage: "done",
      note: `Refresh complete: ${levels.length} levels, ${totalRecords} records, ${detailsByLevelId.size} detailed levels.`,
      force: true,
    });

    return NextResponse.json({
      message: "Leaderboard cache refreshed.",
      refreshedAt: new Date().toISOString(),
      levels: levels.length,
      records: totalRecords,
      fetchedProfiles: profiles.length,
      missingProfiles: profileIdentifiers.length - profiles.length,
      levelsWithDetails: detailsByLevelId.size,
    });
  } catch (error) {
    await reportProgress({
      stage: "failed",
      note: error instanceof Error ? error.message : "Unknown refresh error.",
      force: true,
    });

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