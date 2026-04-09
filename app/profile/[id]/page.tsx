import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { isAdminFromCandidates } from "@/lib/adminPlayers";
import { getProfilesLeaderboard } from "@/lib/profileLeaderboard";
import { CACHE_TAGS } from "@/lib/routes";
import { unstable_cache } from "next/cache";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import ProfilePageClient from "./ProfilePageClient";
import players from "@/players.json";

function normalizePlayerName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

const listedPlayers = new Set(players.map((player) => normalizePlayerName(player)).filter(Boolean));

type Props = {
  params: Promise<{ id: string }>;
};

const getCachedLeaderboardLevelOrder = unstable_cache(
  async () => {
    return prisma.level.findMany({
      select: {
        levelId: true,
      },
      orderBy: [{ legacy: "asc" }, { position: "asc" }, { levelName: "asc" }],
    });
  },
  ["profile-page-level-order", CACHE_TAGS.leaderboardLevels],
  {
    revalidate: 60,
    tags: [CACHE_TAGS.leaderboardLevels],
  },
);

export default async function ProfilePage({ params }: Props) {
  const { id } = await params;

  const userId = Number(id);

  if (Number.isNaN(userId)) {
    return notFound();
  }

  const [session, user, profilesLeaderboard] = await Promise.all([
    getServerSession(authOptions),
    prisma.user.findUnique({
      where: { id: userId },
    }),
    getProfilesLeaderboard(),
  ]);

  if (!user) {
    return notFound();
  }

  const isListedProfile = listedPlayers.has(normalizePlayerName(user.discord_username || user.username));

  const [profileRecords, leaderboardLevelOrder] = await Promise.all([
    user.discord_username
      ? prisma.levelRecord.findMany({
          where: {
            playerUsername: {
              equals: user.discord_username,
              mode: "insensitive",
            },
          },
          include: {
            level: {
              select: {
                levelId: true,
                levelName: true,
                position: true,
                points: true,
                twoPlayer: true,
                legacy: true,
                thumbnailUrl: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    getCachedLeaderboardLevelOrder(),
  ]);

  const leaderboardRankByLevelId = new Map<number, number>();
  for (const [index, level] of leaderboardLevelOrder.entries()) {
    leaderboardRankByLevelId.set(level.levelId, index + 1);
  }

  // Show best local list placements first.
  const sortedProfileRecords = [...profileRecords].sort((left, right) => {
    const leftRank = leaderboardRankByLevelId.get(left.level.levelId) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = leaderboardRankByLevelId.get(right.level.levelId) ?? Number.MAX_SAFE_INTEGER;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    const leftCompletedAt = left.completedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightCompletedAt = right.completedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;

    if (leftCompletedAt !== rightCompletedAt) {
      return leftCompletedAt - rightCompletedAt;
    }

    return left.id.localeCompare(right.id);
  });

  const currentProfileEntry = profilesLeaderboard.find((entry) => entry.userId === user.id);
  const profileRank = currentProfileEntry?.position ?? null;
  const profilePoints = currentProfileEntry?.points ?? 0;
  const profileCompletionCount = currentProfileEntry?.completions ?? sortedProfileRecords.length;

  const sessionUser = session?.user as { id?: number | string; discordId?: string } | undefined;
  const sessionUserId = Number(sessionUser?.id);
  const sessionDiscordId = sessionUser?.discordId?.trim();

  const requestingUser = sessionDiscordId
    ? await prisma.user.findUnique({
        where: { discordId: sessionDiscordId },
        select: {
          username: true,
          discord_username: true,
        },
      })
    : null;

  const isOwnProfile = Number.isFinite(sessionUserId) && sessionUserId === user.id;
  const canRefreshProfile = isAdminFromCandidates([
    requestingUser?.discord_username,
    requestingUser?.username,
  ]);

  return (
    <ProfilePageClient
      user={{
        id: user.id,
        username: user.username,
        discordId: user.discordId,
        discordUsername: user.discord_username,
        avatar: user.avatar,
        createdAt: user.createdAt.toISOString(),
      }}
      records={sortedProfileRecords.map((record) => ({
        id: record.id,
        completedAt: record.completedAt?.toISOString() ?? null,
        videoUrl: record.videoUrl,
        leaderboardRank: leaderboardRankByLevelId.get(record.level.levelId) ?? null,
        levelPosition: record.levelPosition,
        levelPoints: record.levelPoints,
        levelTwoPlayer: record.levelTwoPlayer,
        level: {
          levelId: record.level.levelId,
          levelName: record.level.levelName,
          position: record.level.position,
          points: record.level.points,
          twoPlayer: record.level.twoPlayer,
          legacy: record.level.legacy,
          thumbnailUrl: record.level.thumbnailUrl,
        },
      }))}
      isOwnProfile={isOwnProfile}
      canRefreshProfile={canRefreshProfile}
      isListedProfile={isListedProfile}
      profileRank={profileRank}
      profilePoints={profilePoints}
      profileCompletionCount={profileCompletionCount}
    />
  );
}