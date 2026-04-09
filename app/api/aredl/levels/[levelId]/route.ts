import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const API_BASE = "https://api.aredl.net/v2/api/aredl";
const REQUEST_TIMEOUT_MS = 8_000;

type RouteParams = {
  params: Promise<{ levelId: string }>;
};

type LiveLevelDetails = {
  id?: string;
  level_id: number;
  position?: number;
  name?: string;
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

function toSafeNumber(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function toSafeInt(value: number | null | undefined): number | null {
  const safe = toSafeNumber(value);
  return safe === null ? null : Math.round(safe);
}

async function fetchLiveLevelDetails(levelId: number): Promise<LiveLevelDetails | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}/levels/${encodeURIComponent(String(levelId))}`, {
      cache: "force-cache",
      next: {
        revalidate: 900,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as LiveLevelDetails;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(_: Request, { params }: RouteParams) {
  const { levelId } = await params;
  const id = Number(levelId);

  if (!Number.isFinite(id)) {
    return NextResponse.json({ message: "Invalid level id" }, { status: 400 });
  }

  const level = await prisma.level.findUnique({
    where: { levelId: id },
    select: {
      aredlId: true,
      levelId: true,
      position: true,
      levelName: true,
      points: true,
      legacy: true,
      twoPlayer: true,
      tags: true,
      description: true,
      song: true,
      edelEnjoyment: true,
      isEdelPending: true,
      gddlTier: true,
      nlwTier: true,
      publisherUsername: true,
      publisherGlobal: true,
    },
  });

  if (!level) {
    return NextResponse.json(
      { message: "Level not found in cache. Refresh the leaderboard first." },
      { status: 404 },
    );
  }

  const needsLiveReconcile =
    level.points == null
    || level.twoPlayer == null
    || (/\(2p\)/i.test(level.levelName) && level.twoPlayer !== true);

  let liveDetails: LiveLevelDetails | null = null;

  if (needsLiveReconcile) {
    liveDetails = await fetchLiveLevelDetails(level.levelId);

    if (liveDetails) {
      const livePoints = toSafeInt(liveDetails.points);
      const livePosition = toSafeNumber(liveDetails.position);
      const liveSong = toSafeInt(liveDetails.song);
      const liveEnjoyment = toSafeNumber(liveDetails.edel_enjoyment);
      const liveGddlTier = toSafeNumber(liveDetails.gddl_tier);

      await prisma.level.update({
        where: {
          levelId: level.levelId,
        },
        data: {
          aredlId: liveDetails.id ?? level.aredlId,
          levelName: liveDetails.name?.trim() || level.levelName,
          position: livePosition ?? level.position,
          points: livePoints ?? level.points,
          legacy: typeof liveDetails.legacy === "boolean" ? liveDetails.legacy : level.legacy,
          twoPlayer: typeof liveDetails.two_player === "boolean" ? liveDetails.two_player : level.twoPlayer,
          tags: Array.isArray(liveDetails.tags) ? liveDetails.tags : level.tags,
          description: liveDetails.description ?? level.description,
          song: liveSong ?? level.song,
          edelEnjoyment: liveEnjoyment ?? level.edelEnjoyment,
          isEdelPending:
            typeof liveDetails.is_edel_pending === "boolean" ? liveDetails.is_edel_pending : level.isEdelPending,
          gddlTier: liveGddlTier ?? level.gddlTier,
          nlwTier: liveDetails.nlw_tier ?? level.nlwTier,
          publisherUsername: liveDetails.publisher?.username ?? level.publisherUsername,
          publisherGlobal: liveDetails.publisher?.global_name ?? level.publisherGlobal,
        },
      });
    }
  }

  const resolvedLevel = {
    aredlId: liveDetails?.id ?? level.aredlId,
    levelId: level.levelId,
    position: toSafeNumber(liveDetails?.position) ?? level.position,
    levelName: liveDetails?.name?.trim() || level.levelName,
    points: toSafeInt(liveDetails?.points) ?? level.points,
    legacy: typeof liveDetails?.legacy === "boolean" ? liveDetails.legacy : level.legacy,
    twoPlayer: typeof liveDetails?.two_player === "boolean" ? liveDetails.two_player : level.twoPlayer,
    tags: Array.isArray(liveDetails?.tags) ? liveDetails.tags : level.tags,
    description: liveDetails?.description ?? level.description,
    song: toSafeInt(liveDetails?.song) ?? level.song,
    edelEnjoyment: toSafeNumber(liveDetails?.edel_enjoyment) ?? level.edelEnjoyment,
    isEdelPending: typeof liveDetails?.is_edel_pending === "boolean" ? liveDetails.is_edel_pending : level.isEdelPending,
    gddlTier: toSafeNumber(liveDetails?.gddl_tier) ?? level.gddlTier,
    nlwTier: liveDetails?.nlw_tier ?? level.nlwTier,
    publisherUsername: liveDetails?.publisher?.username ?? level.publisherUsername,
    publisherGlobal: liveDetails?.publisher?.global_name ?? level.publisherGlobal,
  };

  const publisher =
    resolvedLevel.publisherUsername || resolvedLevel.publisherGlobal
      ? {
          username: resolvedLevel.publisherUsername,
          global_name: resolvedLevel.publisherGlobal,
        }
      : undefined;

  return NextResponse.json({
    id: resolvedLevel.aredlId ?? String(resolvedLevel.levelId),
    level_id: resolvedLevel.levelId,
    position: resolvedLevel.position,
    name: resolvedLevel.levelName,
    points: resolvedLevel.points,
    legacy: resolvedLevel.legacy,
    two_player: resolvedLevel.twoPlayer,
    tags: resolvedLevel.tags,
    description: resolvedLevel.description ?? "",
    song: resolvedLevel.song,
    edel_enjoyment: resolvedLevel.edelEnjoyment,
    is_edel_pending: resolvedLevel.isEdelPending,
    gddl_tier: resolvedLevel.gddlTier,
    nlw_tier: resolvedLevel.nlwTier,
    publisher,
  });
}
