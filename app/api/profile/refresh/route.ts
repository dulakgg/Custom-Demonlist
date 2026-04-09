import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncUserProfileFromAredl } from "@/lib/aredlProfileSync";
import { prisma } from "@/lib/prisma";
import players from "@/players.json";
import { isAdminFromCandidates } from "@/lib/adminPlayers";
import { CACHE_TAGS, profileByIdRoute, ROUTES } from "@/lib/routes";

type SessionUser = {
  discordId?: string;
};

const PROFILE_REFRESH_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const PROFILE_REFRESH_WEBHOOK_URL =
  process.env.PROFILE_REFRESH_DISCORD_WEBHOOK_URL || process.env.LEADERBOARD_REFRESH_DISCORD_WEBHOOK_URL;
const COOLDOWN_EXEMPT_PLAYERS = new Set(players.map((player) => player.trim().toLowerCase()).filter(Boolean));

type ProgressStage = "starting" | "blocked" | "syncing" | "done" | "failed";

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

function formatWebhookContent(stage: ProgressStage, note: string): string {
  return [`Profile refresh: ${stage}`, note, `Updated: ${new Date().toISOString()}`].join("\n");
}

function createWebhookReporter(webhookUrl: string | undefined) {
  let messageId: string | null = null;

  return async (stage: ProgressStage, note: string): Promise<void> => {
    if (!webhookUrl) {
      return;
    }

    const payload = {
      content: formatWebhookContent(stage, note),
    };

    try {
      if (!messageId) {
        const response = await fetch(buildDiscordWebhookMessageUrl(webhookUrl, undefined, true), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const created = (await response.json()) as { id?: string };
        messageId = created.id ?? null;
      } else {
        await fetch(buildDiscordWebhookMessageUrl(webhookUrl, messageId), {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });
      }
    } catch {
      // Webhook delivery must not break profile refresh.
    }
  };
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

function formatNextAllowedAt(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

async function refreshOwnProfile(request: NextRequest) {
  const reportProgress = createWebhookReporter(PROFILE_REFRESH_WEBHOOK_URL);

  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  const sessionDiscordId = user?.discordId?.trim();
  const requestedDiscordId = request.nextUrl.searchParams.get("discordId")?.trim();

  const requester = sessionDiscordId
    ? await prisma.user.findUnique({
        where: { discordId: sessionDiscordId },
        select: {
          username: true,
          discord_username: true,
        },
      })
    : null;
  const requesterIsAdmin = isAdminFromCandidates([
    requester?.discord_username,
    requester?.username,
  ]);

  const expectedSecret = process.env.PROFILE_REFRESH_SECRET || process.env.LEADERBOARD_REFRESH_SECRET;
  const providedSecret = readProvidedSecret(request);
  const hasValidSecret = expectedSecret && providedSecret
    ? secretsMatch(expectedSecret, providedSecret)
    : false;

  if (providedSecret && !hasValidSecret) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  let discordId: string | undefined;

  if (hasValidSecret) {
    discordId = requestedDiscordId || sessionDiscordId;
  } else if (sessionDiscordId) {
    const wantsOtherProfile = requestedDiscordId && requestedDiscordId !== sessionDiscordId;

    if (wantsOtherProfile) {
      if (!requesterIsAdmin) {
        return NextResponse.json({ message: "Forbidden." }, { status: 403 });
      }

      discordId = requestedDiscordId;
    } else {
      discordId = sessionDiscordId;
    }
  }

  if (!discordId) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const localUser = await prisma.user.findUnique({
    where: { discordId },
    select: {
      id: true,
      discord_username: true,
      lastProfileRefreshAt: true,
    },
  });

  if (!localUser) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }

  await reportProgress("starting", `Starting profile refresh for user #${localUser.id}.`);

  const lastRefreshAt = localUser.lastProfileRefreshAt as Date | null;
  const isCooldownExempt = COOLDOWN_EXEMPT_PLAYERS.has((localUser.discord_username ?? "").trim().toLowerCase());
  const now = Date.now();
  if (!isCooldownExempt && lastRefreshAt) {
    const elapsed = now - lastRefreshAt.getTime();

    if (elapsed < PROFILE_REFRESH_COOLDOWN_MS) {
      const nextAllowedAt = new Date(lastRefreshAt.getTime() + PROFILE_REFRESH_COOLDOWN_MS);
      await reportProgress("blocked", `Blocked by cooldown for user #${localUser.id}.`);

      return NextResponse.json(
        {
          message: `Profile can be refreshed once per day. Next refresh available: ${formatNextAllowedAt(nextAllowedAt)}.`,
          nextRefreshAt: nextAllowedAt.toISOString(),
        },
        { status: 429 },
      );
    }
  }

  await reportProgress("syncing", `Syncing AREDL profile for user #${localUser.id}.`);

  const result = await syncUserProfileFromAredl(discordId);

  if (result.status === "invalid-discord-id") {
    await reportProgress("failed", "Invalid Discord ID provided.");
    return NextResponse.json({ message: "Invalid Discord ID." }, { status: 400 });
  }

  if (result.status === "user-not-found") {
    await reportProgress("failed", "User was not found during profile refresh.");
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }

  if (result.status === "profile-not-found") {
    await reportProgress("failed", "AREDL profile not found for this Discord account.");
    return NextResponse.json(
      { message: "AREDL profile was not found for this Discord account." },
      { status: 404 },
    );
  }

  if (result.status === "error") {
    await reportProgress("failed", result.message);
    return NextResponse.json({ message: result.message }, { status: 500 });
  }

  if (result.status !== "success") {
    await reportProgress("failed", "Unknown profile refresh failure.");
    return NextResponse.json({ message: "Profile refresh failed." }, { status: 500 });
  }

  await prisma.user.update({
    where: { id: result.userId },
    data: {
      lastProfileRefreshAt: new Date(),
    },
  });

  revalidateTag(CACHE_TAGS.profilesLeaderboard, "max");
  revalidateTag(CACHE_TAGS.leaderboardLevels, "max");
  revalidatePath(profileByIdRoute(result.userId));
  revalidatePath(ROUTES.leaderboard);
  revalidatePath(ROUTES.profiles);

  await reportProgress(
    "done",
    `Refresh complete for user #${result.userId}: ${result.recordsStored} records (${result.levelsUpserted} levels).`,
  );

  return NextResponse.json({
    message: "Profile refreshed.",
    userId: result.userId,
    discordUsername: result.discordUsername,
    levelsUpserted: result.levelsUpserted,
    recordsStored: result.recordsStored,
    refreshedAt: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  return refreshOwnProfile(request);
}

export async function POST(request: NextRequest) {
  return refreshOwnProfile(request);
}
