import LeaderboardClient from "./LeaderboardClient";
import { prisma } from "@/lib/prisma";

type LeaderboardRecord = {
  id: string;
  playerDisplayName: string;
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

export const dynamic = "force-dynamic";

async function getLeaderboardLevels(): Promise<LeaderboardLevel[]> {
  const levels = await prisma.level.findMany({
    include: {
      records: {
        orderBy: [{ completedAt: "desc" }, { id: "asc" }],
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
      playerDisplayName: record.playerDisplayName,
      playerUsername: record.playerUsername,
      isListedPlayer: record.isListedPlayer,
      completedAt: record.completedAt?.toISOString(),
      videoUrl: record.videoUrl,
    })),
  }));
}

export default async function LeaderboardPage() {
  const levels = await getLeaderboardLevels();

  return (
    <main className="min-h-dvh px-2 pb-4 pt-1 text-(--text) md:px-3 md:pb-6 md:pt-1">
      <LeaderboardClient levels={levels} />
    </main>
  );
}
