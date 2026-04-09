import LeaderboardClient from "./LeaderboardClient";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { isAdminFromCandidates } from "@/lib/adminPlayers";
import { CACHE_TAGS } from "@/lib/routes";
import { unstable_cache } from "next/cache";
import { getServerSession } from "next-auth";

type LeaderboardRecord = {
  id: string;
  playerUsername: string;
  isListedPlayer: boolean;
  completedAt: string | undefined;
  videoUrl: string | null;
};

type LeaderboardLevel = {
  levelId: number;
  levelName: string;
  position: number;
  legacy: boolean;
  thumbnailUrl: string;
  records: LeaderboardRecord[];
};

const getCachedLeaderboardLevels = unstable_cache(
  async (): Promise<LeaderboardLevel[]> => {
    const levels = await prisma.level.findMany({
      include: {
        records: {
          // Show completions in chronological order.
          orderBy: [{ completedAt: "asc" }, { id: "asc" }],
        },
      },
      orderBy: [{ position: "asc" }, { levelName: "asc" }],
    });

    return levels.map((level) => ({
      levelId: level.levelId,
      levelName: level.levelName,
      position: level.position,
      legacy: level.legacy,
      thumbnailUrl: level.thumbnailUrl,
      records: level.records.map((record) => ({
        id: record.id,
        playerUsername: record.playerUsername,
        isListedPlayer: record.isListedPlayer,
        completedAt: record.completedAt?.toISOString(),
        videoUrl: record.videoUrl,
      })),
    }));
  },
  [CACHE_TAGS.leaderboardLevels],
  {
    revalidate: 60,
    tags: [CACHE_TAGS.leaderboardLevels],
  },
);

async function canRunMassRefresh(): Promise<boolean> {
  // Keep admin-only controls hidden for regular users.
  const session = await getServerSession(authOptions);
  const discordId = (session?.user as { discordId?: string } | undefined)?.discordId?.trim();

  if (!discordId) {
    return false;
  }

  const user = await prisma.user.findUnique({
    where: { discordId },
    select: {
      username: true,
      discord_username: true,
    },
  });

  if (!user) {
    return false;
  }

  return isAdminFromCandidates([user.discord_username, user.username]);
}

async function getLeaderboardLevels(): Promise<LeaderboardLevel[]> {
  return getCachedLeaderboardLevels();
}

export default async function LeaderboardPage() {
  const [levels, canMassRefresh] = await Promise.all([
    getLeaderboardLevels(),
    canRunMassRefresh(),
  ]);

  return (
    <main className="min-h-dvh px-2 pb-4 pt-1 text-(--text) md:px-3 md:pb-6 md:pt-1">
      <LeaderboardClient levels={levels} canMassRefresh={canMassRefresh} />
    </main>
  );
}
