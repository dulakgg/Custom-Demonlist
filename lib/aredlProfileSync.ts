import players from "@/players.json";
import { prisma } from "@/lib/prisma";
import {
  buildAredlLevelVariantLookup,
  fetchAredlLevelCatalog,
  inferRecordTwoPlayer,
  resolveAredlLevelVariant,
} from "@/lib/aredlLevelVariants";

const API_BASE = "https://api.aredl.net/v2/api/aredl";
const REQUEST_TIMEOUT_MS = 12_000;

export type CompletionRecord = {
  id: string;
  created_at?: string;
  video_url: string | null;
  level: {
    level_id: number;
    name: string;
    position: number;
    points?: number | null;
    two_player?: boolean | null;
    legacy?: boolean;
  };
};

export type PlayerProfileResponse = {
  username: string;
  global_name?: string | null;
  records?: CompletionRecord[];
};

export type SyncUserProfileResult =
  | {
      status: "success";
      userId: number;
      discordUsername: string;
      levelsUpserted: number;
      recordsStored: number;
    }
  | {
      status: "invalid-discord-id" | "user-not-found" | "profile-not-found";
    }
  | {
      status: "error";
      message: string;
    };

function normalizeUsername(username: string | null | undefined): string | null {
  if (!username) {
    return null;
  }

  const trimmed = username.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toSafeLevelId(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.round(value);
  return rounded > 0 ? rounded : null;
}

function toSafeInt(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.round(value);
}

function toSafeNumber(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

async function fetchPlayerProfile(identifier: string): Promise<PlayerProfileResponse | null> {
  const trimmedIdentifier = identifier.trim();

  if (!trimmedIdentifier) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}/profile/${encodeURIComponent(trimmedIdentifier)}`, {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as PlayerProfileResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncUserProfileFromAredl(discordId: string): Promise<SyncUserProfileResult> {
  const trimmedDiscordId = discordId.trim();

  if (!trimmedDiscordId) {
    return { status: "invalid-discord-id" };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { discordId: trimmedDiscordId },
      select: {
        id: true,
        discord_username: true,
      },
    });

    if (!user) {
      return { status: "user-not-found" };
    }

    const profile = await fetchPlayerProfile(trimmedDiscordId);

    if (!profile) {
      return { status: "profile-not-found" };
    }

    const profileUsername = normalizeUsername(profile.username);
    if (!profileUsername) {
      return { status: "profile-not-found" };
    }

    const playerDisplayName = normalizeUsername(profile.global_name) ?? profileUsername;
    const listedPlayers = new Set(players.map((username) => username.trim().toLowerCase()).filter(Boolean));
    const isListedPlayer = listedPlayers.has(profileUsername.toLowerCase());

    const candidateRecordRows = [] as Array<{
      id: string;
      levelId: number;
      playerDisplayName: string;
      playerUsername: string;
      isListedPlayer: boolean;
      levelPosition: number | null;
      levelPoints: number | null;
      levelTwoPlayer: boolean | null;
      completedAt: Date | null;
      videoUrl: string | null;
    }>;
    const candidateLevelMetadataById = new Map<
      number,
      {
        levelName: string | null;
        points: number | null;
        twoPlayer: boolean | null;
      }
    >();
    const levelVariantPresenceById = new Map<
      number,
      {
        hasSolo: boolean;
        hasTwoPlayer: boolean;
      }
    >();
    const candidateLevelIds = new Set<number>();

    for (const record of profile.records ?? []) {
      const recordId = normalizeUsername(record.id);
      const levelId = toSafeLevelId(record.level?.level_id);

      if (!recordId || !levelId) {
        continue;
      }

      const levelName = normalizeUsername(record.level?.name);
      const levelPoints = toSafeInt(record.level?.points);
      const twoPlayer = inferRecordTwoPlayer(record.level?.two_player, levelName);

      const previousMetadata = candidateLevelMetadataById.get(levelId);
      candidateLevelMetadataById.set(levelId, {
        levelName: levelName ?? previousMetadata?.levelName ?? null,
        points: levelPoints ?? previousMetadata?.points ?? null,
        twoPlayer: twoPlayer ?? previousMetadata?.twoPlayer ?? null,
      });

      const variantPresence = levelVariantPresenceById.get(levelId) ?? {
        hasSolo: false,
        hasTwoPlayer: false,
      };

      if (twoPlayer === true) {
        variantPresence.hasTwoPlayer = true;
      }

      if (twoPlayer === false) {
        variantPresence.hasSolo = true;
      }

      levelVariantPresenceById.set(levelId, variantPresence);

      candidateLevelIds.add(levelId);
      candidateRecordRows.push({
        id: recordId,
        levelId,
        playerDisplayName,
        playerUsername: profileUsername,
        isListedPlayer,
        levelPosition: toSafeNumber(record.level?.position),
        levelPoints,
        levelTwoPlayer: twoPlayer,
        completedAt: parseOptionalDate(record.created_at),
        videoUrl: record.video_url,
      });
    }

    if (candidateLevelIds.size > 0) {
      const levelCatalog = await fetchAredlLevelCatalog();

      if (levelCatalog) {
        const levelVariantLookup = buildAredlLevelVariantLookup(levelCatalog);

        for (const levelId of candidateLevelIds) {
          const levelMetadata = candidateLevelMetadataById.get(levelId);
          const variantPresence = levelVariantPresenceById.get(levelId);
          const preferredTwoPlayer = variantPresence?.hasSolo && variantPresence?.hasTwoPlayer
            ? null
            : variantPresence?.hasTwoPlayer
              ? true
              : variantPresence?.hasSolo
                ? false
                : levelMetadata?.twoPlayer ?? null;
          const resolvedVariant = resolveAredlLevelVariant(levelVariantLookup, levelId, preferredTwoPlayer);

          if (!resolvedVariant) {
            continue;
          }

          candidateLevelMetadataById.set(levelId, {
            levelName: resolvedVariant.levelName ?? levelMetadata?.levelName ?? null,
            points: resolvedVariant.points ?? levelMetadata?.points ?? null,
            twoPlayer: variantPresence?.hasSolo && variantPresence?.hasTwoPlayer
              ? null
              : resolvedVariant.twoPlayer ?? levelMetadata?.twoPlayer ?? null,
          });
        }

        for (const candidateRecordRow of candidateRecordRows) {
          const resolvedVariant = resolveAredlLevelVariant(
            levelVariantLookup,
            candidateRecordRow.levelId,
            candidateRecordRow.levelTwoPlayer,
          );

          if (!resolvedVariant) {
            continue;
          }

          candidateRecordRow.levelPosition = resolvedVariant.position ?? candidateRecordRow.levelPosition;
          candidateRecordRow.levelPoints = resolvedVariant.points ?? candidateRecordRow.levelPoints;
          candidateRecordRow.levelTwoPlayer = resolvedVariant.twoPlayer ?? candidateRecordRow.levelTwoPlayer;
        }
      }
    }

    const existingLevels = await prisma.level.findMany({
      where: {
        levelId: {
          in: Array.from(candidateLevelIds),
        },
      },
      select: {
        levelId: true,
        levelName: true,
        points: true,
        twoPlayer: true,
      },
    });

    const allowedLevelIds = new Set(existingLevels.map((level) => level.levelId));
    const recordRows = candidateRecordRows.filter((row) => allowedLevelIds.has(row.levelId));
    const levelMetadataUpdates = existingLevels
      .map((level) => {
        const metadata = candidateLevelMetadataById.get(level.levelId);
        if (!metadata) {
          return null;
        }

        const nextLevelName = metadata.levelName ?? level.levelName;
        const nextPoints = metadata.points ?? level.points;
        const nextTwoPlayer = metadata.twoPlayer ?? level.twoPlayer;

        if (
          nextLevelName === level.levelName
          && nextPoints === level.points
          && nextTwoPlayer === level.twoPlayer
        ) {
          return null;
        }

        return {
          levelId: level.levelId,
          levelName: nextLevelName,
          points: nextPoints,
          twoPlayer: nextTwoPlayer,
        };
      })
      .filter((update): update is { levelId: number; levelName: string; points: number | null; twoPlayer: boolean | null } => update !== null);

    const usernamesToReplace = Array.from(
      new Set([normalizeUsername(user.discord_username), profileUsername].filter((value): value is string => Boolean(value))),
    );

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          discord_username: profileUsername,
        },
      });

      for (const update of levelMetadataUpdates) {
        await tx.level.update({
          where: {
            levelId: update.levelId,
          },
          data: {
            levelName: update.levelName,
            points: update.points,
            twoPlayer: update.twoPlayer,
          },
        });
      }

      if (usernamesToReplace.length > 0) {
        await tx.levelRecord.deleteMany({
          where: {
            playerUsername: {
              in: usernamesToReplace,
            },
          },
        });
      }

      if (recordRows.length > 0) {
        await tx.levelRecord.createMany({
          data: recordRows,
          skipDuplicates: true,
        });
      }
    });

    return {
      status: "success",
      userId: user.id,
      discordUsername: profileUsername,
      levelsUpserted: allowedLevelIds.size,
      recordsStored: recordRows.length,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown profile sync error.",
    };
  }
}
