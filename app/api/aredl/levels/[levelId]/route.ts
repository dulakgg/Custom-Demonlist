import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ levelId: string }>;
};

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

  const publisher =
    level.publisherUsername || level.publisherGlobal
      ? {
          username: level.publisherUsername,
          global_name: level.publisherGlobal,
        }
      : undefined;

  return NextResponse.json({
    id: level.aredlId ?? String(level.levelId),
    level_id: level.levelId,
    position: level.position,
    name: level.levelName,
    points: level.points,
    legacy: level.legacy,
    two_player: level.twoPlayer,
    tags: level.tags,
    description: level.description ?? "",
    song: level.song,
    edel_enjoyment: level.edelEnjoyment,
    is_edel_pending: level.isEdelPending,
    gddl_tier: level.gddlTier,
    nlw_tier: level.nlwTier,
    publisher,
  });
}
