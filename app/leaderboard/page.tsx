import LeaderboardClient from "./LeaderboardClient";
import players from "../../players.json";

type PlayerProfileResponse = {
  username: string;
  global_name?: string | null;
  records?: CompletionRecord[];
};

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

const API_BASE = "https://api.aredl.net/v2/api/aredl";

async function fetchPlayerProfile(username: string): Promise<PlayerProfileResponse | null> {
  const response = await fetch(`${API_BASE}/profile/${encodeURIComponent(username)}`, {
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as PlayerProfileResponse;
}

function levelThumbnail(levelId: number): string {
  return `https://raw.githubusercontent.com/All-Rated-Extreme-Demon-List/Thumbnails/main/levels/cards/${levelId}.webp`;
}

async function getLeaderboardLevels(): Promise<LeaderboardLevel[]> {
  const listedPlayers = new Set(players.map((username) => username.toLowerCase()));
  const profileResponses = await Promise.all(players.map((username) => fetchPlayerProfile(username)));
  const profiles = profileResponses.filter((profile): profile is PlayerProfileResponse => profile !== null);

  const levelMap = new Map<number, LeaderboardLevel>();

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

  return Array.from(levelMap.values()).sort((a, b) => {
    if (a.position !== b.position) {
      return a.position - b.position;
    }

    return a.levelName.localeCompare(b.levelName);
  });
}

export default async function LeaderboardPage() {
  const levels = await getLeaderboardLevels();

  return (
    <main
      className="min-h-dvh px-2 pb-4 pt-1 text-(--text) md:px-3 md:pb-6 md:pt-1"
      style={{
        background:
          "radial-gradient(circle at 8% 11%, color-mix(in srgb, var(--accent, var(--primary)) 22%, transparent), transparent 38%), radial-gradient(circle at 82% 6%, color-mix(in srgb, var(--secondary, var(--primary)) 24%, transparent), transparent 40%), linear-gradient(172deg, var(--background), color-mix(in srgb, var(--background) 75%, var(--primary)))",
      }}
    >
      <LeaderboardClient levels={levels} />
    </main>
  );
}
