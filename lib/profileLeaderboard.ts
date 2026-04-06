import { prisma } from "@/lib/prisma";

export type ProfileLeaderboardEntry = {
  userId: number;
  username: string;
  discordId: string;
  discordUsername: string;
  avatar: string | null;
  points: number;
  completions: number;
  position: number;
};

function normalizePlayerName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export async function getProfilesLeaderboard(): Promise<ProfileLeaderboardEntry[]> {
  const [usersWithProfiles, scoredRecords] = await Promise.all([
    prisma.user.findMany({
      where: {
        discord_username: {
          not: null,
        },
      },
      select: {
        id: true,
        username: true,
        discordId: true,
        discord_username: true,
        avatar: true,
      },
    }),
    prisma.levelRecord.findMany({
      select: {
        playerUsername: true,
        level: {
          select: {
            points: true,
          },
        },
      },
    }),
  ]);

  const profileUserIdByDiscordUsername = new Map<string, number>();
  for (const profileUser of usersWithProfiles) {
    const normalized = normalizePlayerName(profileUser.discord_username);
    if (!normalized) {
      continue;
    }

    profileUserIdByDiscordUsername.set(normalized, profileUser.id);
  }

  const pointsByUserId = new Map<number, number>();
  const completionsByUserId = new Map<number, number>();

  for (const profileUser of usersWithProfiles) {
    pointsByUserId.set(profileUser.id, 0);
    completionsByUserId.set(profileUser.id, 0);
  }

  for (const record of scoredRecords) {
    const normalizedUsername = normalizePlayerName(record.playerUsername);
    const profileUserId = profileUserIdByDiscordUsername.get(normalizedUsername);

    if (!profileUserId) {
      continue;
    }

    pointsByUserId.set(profileUserId, (pointsByUserId.get(profileUserId) ?? 0) + (record.level.points ?? 0));
    completionsByUserId.set(profileUserId, (completionsByUserId.get(profileUserId) ?? 0) + 1);
  }

  return usersWithProfiles
    .map((profileUser) => {
      const discordUsername = (profileUser.discord_username ?? "").trim();

      return {
        userId: profileUser.id,
        username: profileUser.username,
        discordId: profileUser.discordId,
        discordUsername,
        avatar: profileUser.avatar,
        points: pointsByUserId.get(profileUser.id) ?? 0,
        completions: completionsByUserId.get(profileUser.id) ?? 0,
        position: 0,
      };
    })
    .sort((a, b) => b.points - a.points || b.completions - a.completions || a.username.localeCompare(b.username))
    .map((entry, index) => ({
      ...entry,
      position: index + 1,
    }));
}
